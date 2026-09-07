"""Milestone 3. Source/distributor entity — NOT the same as Manufacturer/Brand.

A Source is whoever handed us a thread chart (a distributor, a promo-products
supplier, a direct manufacturer feed) — see docs/ARCHITECTURE.md for why this
is kept separate from Manufacturer/Brand/ProductLine: a distributor can
resell threads made by several different manufacturers.

``SourceCode`` is the stable, admin-controlled key used to match a
re-uploaded/updated chart back to this same Source instead of creating a
duplicate. ``NormalizedName`` backs a fuzzy-match *suggestion* at upload time
(see docs/DATABASE.md, "Vendor re-import matching") but is never used to
silently merge records — a human confirms the match.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import CheckConstraint
from sqlalchemy.dialects.mssql import NVARCHAR
from sqlalchemy.orm import Mapped, mapped_column

from idy_thread.db.base import Base
from idy_thread.db.mixins import TimestampMixin


class Source(Base, TimestampMixin):
    __tablename__ = "Source"
    __table_args__ = (
        CheckConstraint("Status IN ('ACTIVE','INACTIVE','MERGED')", name="status_valid"),
    )

    SourceId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    SourceCode: Mapped[str] = mapped_column(NVARCHAR(50), unique=True, nullable=False)
    Name: Mapped[str] = mapped_column(NVARCHAR(200), nullable=False)
    NormalizedName: Mapped[str] = mapped_column(NVARCHAR(200), unique=True, nullable=False)
    SourceType: Mapped[Optional[str]] = mapped_column(NVARCHAR(50))
    Status: Mapped[str] = mapped_column(NVARCHAR(20), nullable=False, default="ACTIVE")
    Description: Mapped[Optional[str]] = mapped_column(NVARCHAR(None))
    Metadata: Mapped[Optional[str]] = mapped_column(NVARCHAR(None))

    def __repr__(self) -> str:
        return f"<Source {self.SourceCode!r} {self.Name!r}>"
