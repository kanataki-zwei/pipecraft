# backend/pipecraft/api/schemas.py

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DBType(str, Enum):
    postgres = "postgres"
    mysql = "mysql"


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
