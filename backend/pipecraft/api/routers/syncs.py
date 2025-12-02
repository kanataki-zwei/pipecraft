# backend/pipecraft/api/routers/syncs.py

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from pipecraft.api.deps import get_db
from pipecraft.api import schemas
from pipecraft.db import models

router = APIRouter(
    prefix="/syncs",
    tags=["syncs"],
)


@router.post(
    "/",
    response_model=schemas.SyncOut,
    status_code=status.HTTP_201_CREATED,
)
def create_sync(
    sync_in: schemas.SyncCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new Sync definition linking a source table to a destination table.
    """

    # Ensure name is unique
    existing = (
        db.query(models.Sync)
        .filter(models.Sync.name == sync_in.name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sync with this name already exists.",
        )

    # Validate source connection exists
    source_conn = (
        db.query(models.Connection)
        .filter(models.Connection.id == sync_in.source_connection_id)
        .first()
    )
    if not source_conn:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source connection not found.",
        )

    # Validate dest connection exists
    dest_conn = (
        db.query(models.Connection)
        .filter(models.Connection.id == sync_in.dest_connection_id)
        .first()
    )
    if not dest_conn:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination connection not found.",
        )

    # Create Sync row
    sync = models.Sync(
        name=sync_in.name,
        description=sync_in.description,
        source_connection_id=sync_in.source_connection_id,
        source_table=sync_in.source_table,
        dest_connection_id=sync_in.dest_connection_id,
        dest_schema=sync_in.dest_schema,
        dest_table=sync_in.dest_table,
        write_mode=models.WriteMode(sync_in.write_mode.value),
    )

    db.add(sync)
    db.commit()
    db.refresh(sync)

    return sync


@router.get("/", response_model=List[schemas.SyncOut])
def list_syncs(db: Session = Depends(get_db)):
    """
    List all Syncs.
    """
    syncs = db.query(models.Sync).order_by(models.Sync.name).all()
    return syncs
