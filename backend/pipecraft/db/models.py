# backend/pipecraft/db/models.py

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Integer,
    String,
    UniqueConstraint,
)

from .base import Base


class DBType(str, enum.Enum):
    POSTGRES = "postgres"
    MYSQL = "mysql"


class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, index=True)

    # Unique human-friendly identifier for this connection
    name = Column(String(100), unique=True, nullable=False, index=True)

    # "postgres" or "mysql"
    db_type = Column(Enum(DBType), nullable=False)

    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    database = Column(String(255), nullable=False)

    username = Column(String(255), nullable=False)

    # NOTE: For v0 we keep this as plain text.
    # Later we can encrypt or integrate with a secrets manager.
    password = Column(String(255), nullable=False)

    # Whether this connection can be used as a source and/or destination
    is_source = Column(Boolean, nullable=False, default=True)
    is_destination = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("name", name="uq_connections_name"),
    )

    def __repr__(self) -> str:
        return (
            f"<Connection(name={self.name!r}, db_type={self.db_type.value!r}, "
            f"is_source={self.is_source}, is_destination={self.is_destination})>"
        )
