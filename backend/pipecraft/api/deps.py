# backend/pipecraft/api/deps.py

from typing import Generator

from sqlalchemy.orm import Session

from pipecraft.db.base import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a database session.
    Closes the session after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
