from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# For v0, we store PipeCraft metadata (connections, syncs, runs) in a local SQLite file.
DATABASE_URL = "sqlite:///./pipecraft.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # multithreaded use
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db():
    """
    Initialize the metadata database.

    For now this just ensures all tables defined on Base are created.
    """
    from sqlalchemy import inspect

    inspector = inspect(engine)
    # This will create tables for any models that inherit from Base
    Base.metadata.create_all(bind=engine)
