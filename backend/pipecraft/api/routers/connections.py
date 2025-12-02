# backend/pipecraft/api/routers/connections.py

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text, inspect      
from sqlalchemy.exc import SQLAlchemyError

from pipecraft.api.deps import get_db
from pipecraft.api import schemas
from pipecraft.db import models



router = APIRouter(
    prefix="/connections",
    tags=["connections"],
)

def build_db_url(conn: models.Connection) -> str:
    """
    Build a SQLAlchemy URL for the given connection config.
    Supports postgres and mysql for v0.
    """
    if conn.db_type == models.DBType.POSTGRES:
        driver = "postgresql+psycopg2"
    elif conn.db_type == models.DBType.MYSQL:
        driver = "mysql+pymysql"
    else:
        raise ValueError(f"Unsupported db_type: {conn.db_type}")

    # NOTE: v0 assumes username/password are safe to interpolate directly.
    # Later we can add URL-encoding if needed.
    return f"{driver}://{conn.username}:{conn.password}@{conn.host}:{conn.port}/{conn.database}"


def test_db_connection(db_url: str) -> tuple[bool, str | None]:
    """
    Try connecting to the database and running a simple SELECT 1.
    Returns (success, error_message).
    """
    try:
        engine = create_engine(db_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except SQLAlchemyError as e:
        # Extract a readable error message
        msg = str(e.__cause__ or e)
        return False, msg

def list_tables_for_connection(conn: models.Connection) -> list[dict]:
    """
    Return a list of tables for the given connection.

    For v0:
    - Postgres: only schema 'public' for now.
    - MySQL: uses the current database, no separate schema concept.
    """
    db_url = build_db_url(conn)
    engine = create_engine(db_url, pool_pre_ping=True)
    insp = inspect(engine)

    tables: list[dict] = []

    if conn.db_type == models.DBType.POSTGRES:
        schema = "public"
        for table_name in insp.get_table_names(schema=schema):
            tables.append({"schema": schema, "table": table_name})

    elif conn.db_type == models.DBType.MYSQL:
        # MySQL: database from connection is effectively the "schema"
        schema = conn.database
        for table_name in insp.get_table_names():
            tables.append({"schema": schema, "table": table_name})

    else:
        # Should not happen in v0
        raise ValueError(f"Unsupported db_type: {conn.db_type}")

    return tables

@router.post(
    "/",
    response_model=schemas.ConnectionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_connection(
    conn_in: schemas.ConnectionCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new connection (postgres or mysql).
    Connection name must be unique.
    """
    existing = (
        db.query(models.Connection)
        .filter(models.Connection.name == conn_in.name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connection with this name already exists.",
        )

    conn = models.Connection(
        name=conn_in.name,
        db_type=conn_in.db_type.value,
        host=conn_in.host,
        port=conn_in.port,
        database=conn_in.database,
        username=conn_in.username,
        password=conn_in.password,
        is_source=conn_in.is_source,
        is_destination=conn_in.is_destination,
    )

    db.add(conn)
    db.commit()
    db.refresh(conn)

    return conn


@router.get("/", response_model=List[schemas.ConnectionOut])
def list_connections(db: Session = Depends(get_db)):
    """
    List all stored connections.
    """
    connections = db.query(models.Connection).order_by(models.Connection.name).all()
    return connections

@router.post("/{name}/test")
def test_connection(
    name: str,
    db: Session = Depends(get_db),
):
    """
    Test a stored connection by name.
    Attempts a simple SELECT 1 on the target DB.

    Response example:
    {
      "status": "success",
      "message": "Connection successful."
    }
    or
    {
      "status": "error",
      "message": "Connection failed.",
      "details": "error text..."
    }
    """
    conn = (
        db.query(models.Connection)
        .filter(models.Connection.name == name)
        .first()
    )

    if not conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{name}' not found.",
        )

    db_url = build_db_url(conn)
    ok, error = test_db_connection(db_url)

    if ok:
        return {
            "status": "success",
            "message": "Connection successful.",
        }
    else:
        return {
            "status": "error",
            "message": "Connection failed.",
            "details": error,
        }

@router.get("/{name}/tables")
def list_tables(
    name: str,
    db: Session = Depends(get_db),
):
    """
    List tables available for a given connection.

    Returns a structure like:
    {
      "connection": "local_postgres",
      "tables": [
        {"schema": "public", "table": "users"},
        {"schema": "public", "table": "orders"}
      ]
    }
    """
    conn = (
        db.query(models.Connection)
        .filter(models.Connection.name == name)
        .first()
    )

    if not conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{name}' not found.",
        )

    try:
        tables = list_tables_for_connection(conn)
    except SQLAlchemyError as e:
        msg = str(e.__cause__ or e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list tables: {msg}",
        )

    return {
        "connection": conn.name,
        "tables": tables,
    }
