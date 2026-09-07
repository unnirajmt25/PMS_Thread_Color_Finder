"""Milestone 3. Thread + ThreadIdentifier.

Thread is the canonical, deduplicated color-of-thread record. It is
deliberately NOT keyed by any vendor-supplied code — the profiler confirmed
numeric codes are reused across different sheets/sources for unrelated
colors, so a source code can never be the primary key (spec section 8).

ThreadIdentifier holds the actual vendor-supplied codes (one row per
Source that reports a code for this Thread), which is what lets a future
re-import of an updated chart re-attach its rows to the *same* Thread by
matching on (SourceId, IdentifierType, NormalizedValue) instead of creating
a duplicate.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.mssql import BIT, NVARCHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from idy_thread.db.base import Base
from idy_thread.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from idy_thread.domain.colors.models import Color
    from idy_thread.domain.product_lines.models import ProductLine


class Thread(Base, TimestampMixin):
    __tablename__ = "Thread"

    ThreadId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ProductLineId: Mapped[int] = mapped_column(ForeignKey("ProductLine.ProductLineId"), nullable=False)
    CanonicalName: Mapped[Optional[str]] = mapped_column(NVARCHAR(200))
    Status: Mapped[str] = mapped_column(NVARCHAR(20), nullable=False, default="ACTIVE")
    Metadata: Mapped[Optional[str]] = mapped_column(NVARCHAR(None))

    ProductLine: Mapped["ProductLine"] = relationship(back_populates="Threads")
    Identifiers: Mapped[list["ThreadIdentifier"]] = relationship(
        back_populates="Thread", cascade="all, delete-orphan"
    )
    Colors: Mapped[list["Color"]] = relationship(back_populates="Thread", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Thread {self.ThreadId} {self.CanonicalName!r}>"


class ThreadIdentifier(Base, TimestampMixin):
    __tablename__ = "ThreadIdentifier"
    __table_args__ = (
        UniqueConstraint("SourceId", "IdentifierType", "NormalizedValue", name="uq_source_type_value"),
    )

    ThreadIdentifierId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ThreadId: Mapped[int] = mapped_column(ForeignKey("Thread.ThreadId", ondelete="CASCADE"), nullable=False)
    SourceId: Mapped[int] = mapped_column(ForeignKey("Source.SourceId"), nullable=False)
    IdentifierType: Mapped[str] = mapped_column(NVARCHAR(50), nullable=False)
    IdentifierValue: Mapped[str] = mapped_column(NVARCHAR(100), nullable=False)
    NormalizedValue: Mapped[str] = mapped_column(NVARCHAR(100), nullable=False)
    IsPrimary: Mapped[bool] = mapped_column(BIT, nullable=False, default=True)

    Thread: Mapped["Thread"] = relationship(back_populates="Identifiers")

    def __repr__(self) -> str:
        return f"<ThreadIdentifier {self.IdentifierType}={self.IdentifierValue!r} ThreadId={self.ThreadId}>"
