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
    ForeignKey,  
)

from sqlalchemy.orm import relationship  


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

class WriteMode(str, enum.Enum):
    TRUNCATE_INSERT = "truncate_insert"
    # Later we can add: APPEND, UPSERT, etc.
    

class Sync(Base):
    __tablename__ = "syncs"

    id = Column(Integer, primary_key=True, index=True)

    # Human-friendly unique name for the sync
    name = Column(String(100), unique=True, nullable=False, index=True)

    description = Column(String(500), nullable=True)

    # Source side
    source_connection_id = Column(
        Integer,
        ForeignKey("connections.id", ondelete="RESTRICT"),
        nullable=False,
    )
    source_table = Column(String(255), nullable=False)

    # Destination side
    dest_connection_id = Column(
        Integer,
        ForeignKey("connections.id", ondelete="RESTRICT"),
        nullable=False,
    )
    dest_schema = Column(String(255), nullable=True)  # nullable: some DBs might not use schema
    dest_table = Column(String(255), nullable=False)

    # For v0 we only support truncate-insert, but model is future-proof
    write_mode = Column(
        Enum(WriteMode),
        nullable=False,
        default=WriteMode.TRUNCATE_INSERT,
    )

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # Optional relationships back to Connection
    source_connection = relationship(
        "Connection",
        foreign_keys=[source_connection_id],
        lazy="joined",
    )
    dest_connection = relationship(
        "Connection",
        foreign_keys=[dest_connection_id],
        lazy="joined",
    )

    def __repr__(self) -> str:
        return (
            f"<Sync(name={self.name!r}, source={self.source_table!r}, "
            f"dest={self.dest_schema}.{self.dest_table})>"
        )
    
class SyncStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id = Column(Integer, primary_key=True, index=True)

    sync_id = Column(
        Integer,
        ForeignKey("syncs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status = Column(
        Enum(SyncStatus),
        nullable=False,
        default=SyncStatus.PENDING,
    )

    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    row_count = Column(Integer, nullable=True)  # rows copied (we'll fill later)
    error_message = Column(String(2000), nullable=True)

    sync = relationship("Sync", backref="runs")

    def __repr__(self) -> str:
        return (
            f"<SyncRun(id={self.id}, sync_id={self.sync_id}, "
            f"status={self.status.value!r}, row_count={self.row_count})>"
        )
