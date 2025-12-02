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
    
def list_schemas_for_connection(conn: models.Connection) -> list[str]:
    """
    Return a list of schemas for the given connection.

    For v0:
    - Postgres: filter out system schemas (pg_*, information_schema).
    - MySQL: we treat the current database as a single schema.
    """
    db_url = build_db_url(conn)
    engine = create_engine(db_url, pool_pre_ping=True)
    insp = inspect(engine)

    if conn.db_type == models.DBType.POSTGRES:
        all_schemas = insp.get_schema_names()
        # Filter out system schemas for convenience
        filtered = [
            s for s in all_schemas
            if not s.startswith("pg_") and s != "information_schema"
        ]
        return filtered

    elif conn.db_type == models.DBType.MYSQL:
        # MySQL: effectively one logical schema per database for our purposes
        return [conn.database]

    else:
        raise ValueError(f"Unsupported db_type: {conn.db_type}")


def list_tables_for_connection(conn: models.Connection, schema: str) -> list[dict]:
    """
    Return a list of tables for the given connection and schema.

    For v0:
    - Postgres: use the given schema.
    - MySQL: schema is effectively the database; we ignore the param
      and use conn.database but still return it as 'schema' in the result.
    """
    db_url = build_db_url(conn)
    engine = create_engine(db_url, pool_pre_ping=True)
    insp = inspect(engine)

    tables: list[dict] = []

    if conn.db_type == models.DBType.POSTGRES:
        for table_name in insp.get_table_names(schema=schema):
            tables.append({"schema": schema, "table": table_name})

    elif conn.db_type == models.DBType.MYSQL:
        # SQLAlchemy will list tables for the current database
        actual_schema = conn.database
        for table_name in insp.get_table_names():
            tables.append({"schema": actual_schema, "table": table_name})

    else:
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

@router.get("/{name}/schemas")
def list_schemas(
    name: str,
    db: Session = Depends(get_db),
):
    """
    List schemas available for a given connection.

    Example response:
    {
      "connection": "local_postgres",
      "schemas": ["public", "analytics"]
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
        schemas_list = list_schemas_for_connection(conn)
    except SQLAlchemyError as e:
        msg = str(e.__cause__ or e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list schemas: {msg}",
        )

    return {
        "connection": conn.name,
        "schemas": schemas_list,
    }

@router.get("/{name}/tables")
def list_tables(
    name: str,            # path param
    schema: str,          # query param
    db: Session = Depends(get_db),
):
    """
    List tables for a given connection and schema.

    Call pattern:
    1. GET /connections/{name}/schemas  -> choose a schema
    2. GET /connections/{name}/tables?schema=public
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
        tables = list_tables_for_connection(conn, schema=schema)
    except SQLAlchemyError as e:
        msg = str(e.__cause__ or e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list tables: {msg}",
        )

    return {
        "connection": conn.name,
        "schema": schema,
        "tables": tables,
    }

