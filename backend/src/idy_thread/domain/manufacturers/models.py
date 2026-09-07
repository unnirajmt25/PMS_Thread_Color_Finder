"""Milestone 3. Manufacturer entity, plus ManufacturerAlias.

ManufacturerAlias exists because the real vendor charts spell the same
manufacturer inconsistently across sheets/files — confirmed by profiling all
30 workbooks, whose sheet names include "RA SS Rayon", "Robison Anton SS
Rayon", *and* "Robinson Anton SS Rayon" (an actual misspelling, not just an
abbreviation) all referring to one manufacturer. Rather than hard-code a
fix, every known spelling/abbreviation is stored as a row here pointing at
the one canonical Manufacturer, so import-time matching is a table lookup
that can grow as new variants are discovered — never a code change.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.mssql import NVARCHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from idy_thread.db.base import Base
from idy_thread.db.mixins import TimestampMixin


class Manufacturer(Base, TimestampMixin):
    __tablename__ = "Manufacturer"

    ManufacturerId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    Name: Mapped[str] = mapped_column(NVARCHAR(200), nullable=False)
    NormalizedName: Mapped[str] = mapped_column(NVARCHAR(200), unique=True, nullable=False)
    Country: Mapped[Optional[str]] = mapped_column(NVARCHAR(100))
    Status: Mapped[str] = mapped_column(NVARCHAR(20), nullable=False, default="ACTIVE")
    Metadata: Mapped[Optional[str]] = mapped_column(NVARCHAR(None))

    Aliases: Mapped[list["ManufacturerAlias"]] = relationship(
        back_populates="Manufacturer", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Manufacturer {self.Name!r}>"


class ManufacturerAlias(Base, TimestampMixin):
    __tablename__ = "ManufacturerAlias"

    ManufacturerAliasId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ManufacturerId: Mapped[int] = mapped_column(
        ForeignKey("Manufacturer.ManufacturerId", ondelete="CASCADE"), nullable=False
    )
    Alias: Mapped[str] = mapped_column(NVARCHAR(200), nullable=False)
    NormalizedAlias: Mapped[str] = mapped_column(NVARCHAR(200), unique=True, nullable=False)

    Manufacturer: Mapped["Manufacturer"] = relationship(back_populates="Aliases")

    def __repr__(self) -> str:
        return f"<ManufacturerAlias {self.Alias!r} -> ManufacturerId={self.ManufacturerId}>"
