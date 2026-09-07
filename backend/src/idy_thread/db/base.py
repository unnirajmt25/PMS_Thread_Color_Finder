"""Milestone 2/3. SQLAlchemy engine/session setup, Base declarative class.

A naming convention is applied to every constraint/index SQLAlchemy emits so
Alembic autogenerate produces stable, predictable names (``fk_thread_...``)
instead of driver-assigned ones that vary run to run and are unreadable in
migration diffs.
"""

from __future__ import annotations

from sqlalchemy import BigInteger, MetaData, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from idy_thread.config.settings import get_settings

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    # Every bare `Mapped[int]` (every PK and FK in this project) becomes
    # BIGINT, not the SQLAlchemy-default 32-bit INT — surrogate keys are
    # required to be BIGINT IDENTITY per spec section 8. Centralized here
    # instead of repeated per column.
    type_annotation_map = {int: BigInteger}  # noqa: RUF012 - SQLAlchemy's documented DeclarativeBase API


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(settings.database_url, future=True)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False, future=True)
    return _session_factory
