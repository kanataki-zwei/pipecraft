# backend/pipecraft/api/routers/syncs.py

from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError

from pipecraft.api.deps import get_db
from pipecraft.api import schemas
from pipecraft.db import models

# Reuse DB URL builder from connections router
from pipecraft.api.routers.connections import build_db_url

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

def split_table_identifier(conn: models.Connection, table: str) -> tuple[str, str]:
    """
    Split a table identifier into (schema, table_name).

    For v0:
    - Postgres:
        "schema.table" -> (schema, table)
        "table"        -> ("public", table)
    - MySQL:
        schema is effectively the database; we treat `table` as the table name.
    """
    if conn.db_type == models.DBType.POSTGRES:
        if "." in table:
            schema, tbl = table.split(".", 1)
        else:
            schema, tbl = "public", table
        return schema, tbl

    elif conn.db_type == models.DBType.MYSQL:
        return conn.database, table

    else:
        raise ValueError(f"Unsupported db_type: {conn.db_type}")

@router.post("/{sync_id}/run", response_model=schemas.SyncRunOut)
def run_sync(
    sync_id: int,
    db: Session = Depends(get_db),
):
    """
    Run a Sync:

    1. Look up Sync + source/dest connections.
    2. SELECT * from source_table.
    3. TRUNCATE destination table.
    4. INSERT all rows into destination.
    5. Record row_count, status, and any error.

    Limitations in v0:
    - Source and destination must have compatible schemas (same columns).
    - No column mapping or type casting yet.
    - Synchronous operation (runs inside this HTTP request).
    """
    sync = db.query(models.Sync).filter(models.Sync.id == sync_id).first()
    if not sync:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sync with id={sync_id} not found.",
        )

    # Load source/dest connections
    source_conn = (
        db.query(models.Connection)
        .filter(models.Connection.id == sync.source_connection_id)
        .first()
    )
    dest_conn = (
        db.query(models.Connection)
        .filter(models.Connection.id == sync.dest_connection_id)
        .first()
    )

    if not source_conn or not dest_conn:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source or destination connection not found.",
        )

    # Create a new run, mark as RUNNING
    run = models.SyncRun(
        sync_id=sync.id,
        status=models.SyncStatus.RUNNING,
        started_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        # Build DB URLs and engines
        src_url = build_db_url(source_conn)
        dest_url = build_db_url(dest_conn)

        src_engine = create_engine(src_url, pool_pre_ping=True)
        dest_engine = create_engine(dest_url, pool_pre_ping=True)

        # Determine fully qualified source/dest tables
        src_schema, src_table = split_table_identifier(source_conn, sync.source_table)

        if source_conn.db_type == models.DBType.POSTGRES:
            qualified_src = f"{src_schema}.{src_table}"
        else:
            # MySQL
            qualified_src = src_table

        # Destination
        dest_schema = sync.dest_schema
        dest_table = sync.dest_table

        if dest_conn.db_type == models.DBType.POSTGRES and dest_schema:
            qualified_dest = f"{dest_schema}.{dest_table}"
        elif dest_conn.db_type == models.DBType.MYSQL and dest_schema:
            # For MySQL, schema is effectively the database, but we still allow dest_schema
            qualified_dest = f"{dest_schema}.{dest_table}"
        else:
            qualified_dest = dest_table

        # 1) Read all rows from source
        with src_engine.connect() as src:
            result = src.execute(text(f"SELECT * FROM {qualified_src}"))
            # SQLAlchemy 2.x: use the mapping view to get column-name -> value dicts
            rows = [dict(r._mapping) for r in result]

        row_count = len(rows)

        # 2) Ensure destination table exists, then TRUNCATE + 3) INSERT
        insp_dest = inspect(dest_engine)

        if dest_conn.db_type == models.DBType.POSTGRES:
            table_exists = insp_dest.has_table(dest_table, schema=dest_schema)
        elif dest_conn.db_type == models.DBType.MYSQL:
            table_exists = insp_dest.has_table(dest_table)
        else:
            raise ValueError(f"Unsupported dest db_type: {dest_conn.db_type}")

        # If destination table doesn't exist, create it based on source columns
        if not table_exists:
            insp_src = inspect(src_engine)

            if source_conn.db_type == models.DBType.POSTGRES:
                src_cols = insp_src.get_columns(src_table, schema=src_schema)
            elif source_conn.db_type == models.DBType.MYSQL:
                src_cols = insp_src.get_columns(src_table)
            else:
                raise ValueError(f"Unsupported source db_type: {source_conn.db_type}")

            if not src_cols:
                raise RuntimeError(
                    "Cannot auto-create destination table: source table has no columns."
                )

            # For v0, we map all columns to TEXT/VARCHAR for simplicity
            if dest_conn.db_type == models.DBType.POSTGRES:
                col_defs = ", ".join(f"{c['name']} TEXT" for c in src_cols)

                with dest_engine.begin() as dest:
                    if dest_schema:
                        dest.execute(text(f"CREATE SCHEMA IF NOT EXISTS {dest_schema}"))
                    dest.execute(text(f"CREATE TABLE {qualified_dest} ({col_defs})"))

            elif dest_conn.db_type == models.DBType.MYSQL:
                col_defs = ", ".join(f"{c['name']} VARCHAR(255)" for c in src_cols)

                with dest_engine.begin() as dest:
                    dest.execute(text(f"CREATE TABLE IF NOT EXISTS {qualified_dest} ({col_defs})"))

        # Now TRUNCATE and INSERT in one transaction
        with dest_engine.begin() as dest:
            dest.execute(text(f"TRUNCATE TABLE {qualified_dest}"))

            if row_count > 0:
                # Use column names from the first row
                columns = list(rows[0].keys())
                cols_str = ", ".join(columns)
                placeholders = ", ".join(f":{c}" for c in columns)

                insert_sql = text(
                    f"INSERT INTO {qualified_dest} ({cols_str}) "
                    f"VALUES ({placeholders})"
                )
                dest.execute(insert_sql, rows)


        # Update run as SUCCESS
        run.status = models.SyncStatus.SUCCESS
        run.row_count = row_count
        run.ended_at = datetime.utcnow()
        run.error_message = None

        db.add(run)
        db.commit()
        db.refresh(run)

    except (SQLAlchemyError, Exception) as e:
        db.rollback()
        run.status = models.SyncStatus.FAILED
        run.error_message = str(e)
        run.ended_at = datetime.utcnow()
        db.add(run)
        db.commit()
        db.refresh(run)

    return run

