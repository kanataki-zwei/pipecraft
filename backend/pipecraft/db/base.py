from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# For v0, we store PipeCraft metadata (connections, syncs, runs) in a local SQLite file.
DATABASE_URL = "sqlite:///./pipecraft.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for SQLite + multithreaded use
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db():
    """
    Initialize the metadata database.

    This will create tables for all models that inherit from Base,
    such as Connection.
    """
    # Import models so they are registered with SQLAlchemy's metadata
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
