"""
src/backend/database.py
───────────────────────
SQLAlchemy database engine and session factory.

Uses SQLite by default (zero external dependency, file-backed persistence).
Switch to PostgreSQL by setting DATABASE_URL in the environment:

    DATABASE_URL=postgresql+asyncpg://user:pass@localhost/trialguard

The session is synchronous to keep the engine glue simple and to avoid
requiring asyncpg in environments where it isn't installed.  The existing
FastAPI routes are synchronous (def, not async def) for the same reason.

Table creation
──────────────
Tables are created automatically the first time the app starts via the
`init_db()` call in main.py lifespan.  In production, use Alembic migrations
instead.
"""

from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///./trialguard.db",   # default: file-backed SQLite next to cwd
)

# For SQLite we must pass check_same_thread=False so that the same connection
# can be used from different request threads in FastAPI's thread-pool.
_connect_args = {"check_same_thread": False} if _DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    _DATABASE_URL,
    connect_args=_connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    """Shared SQLAlchemy declarative base for all ORM models."""
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def init_db() -> None:
    """Create all tables that do not yet exist.  Idempotent."""
    # Import models so their table definitions are registered on Base.metadata
    import src.backend.db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)


def get_db():
    """
    FastAPI dependency that yields a database session and closes it afterwards.

    Usage in route:
        from src.backend.database import get_db
        from sqlalchemy.orm import Session

        @router.post("/foo")
        def foo(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
