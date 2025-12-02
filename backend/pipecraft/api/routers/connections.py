# backend/pipecraft/api/routers/connections.py

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from pipecraft.api.deps import get_db
from pipecraft.api import schemas
from pipecraft.db import models

router = APIRouter(
    prefix="/connections",
    tags=["connections"],
)


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
