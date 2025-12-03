# backend/pipecraft/api/schemas.py

from enum import Enum
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, Field


class DBType(str, Enum):
    postgres = "postgres"
    mysql = "mysql"

class WriteMode(str, Enum):
    truncate_insert = "truncate_insert"
    # Later: append = "append", upsert = "upsert", etc.

class SyncStatus(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


class SyncRunOut(BaseModel):
    id: int
    sync_id: int
    status: SyncStatus
    started_at: datetime
    ended_at: Optional[datetime] = None
    row_count: Optional[int] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True
        orm_mode = True

class SyncBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=500)

    source_connection_id: int
    source_table: str

    dest_connection_id: int
    dest_schema: Optional[str] = None
    dest_table: str

    write_mode: WriteMode = WriteMode.truncate_insert


class SyncCreate(SyncBase):
    """
    For now, creation schema is same as base.
    """
    pass


class SyncOut(BaseModel):
    id: int
    name: str
    description: Optional[str]

    source_connection_id: int
    source_table: str

    dest_connection_id: int
    dest_schema: Optional[str]
    dest_table: str

    write_mode: WriteMode

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2; if v1, orm_mode = True
        orm_mode = True

class ConnectionBase(BaseModel):
    name: str = Field(..., max_length=100)
    db_type: DBType
    host: str
    port: int
    database: str
    username: str
    password: str
    is_source: bool = True
    is_destination: bool = True


class ConnectionCreate(ConnectionBase):
    """
    For now, creation schema is same as base.
    """
    pass


class ConnectionOut(BaseModel):
    id: int
    name: str
    db_type: DBType
    host: str
    port: int
    database: str
    username: str
    is_source: bool
    is_destination: bool

    class Config:
        from_attributes = True  # Pydantic v2 (if v1, use orm_mode = True)
        orm_mode = True
