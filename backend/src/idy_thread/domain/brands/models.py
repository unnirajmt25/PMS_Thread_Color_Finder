"""Milestone 3. Brand entity — belongs to a Manufacturer.

For most vendor charts profiled so far, Brand mirrors the Manufacturer
1:1 (e.g. "Robison-Anton" is both the manufacturer and the brand). The
column is kept separate from Manufacturer, rather than collapsed into it,
because a manufacturer *can* sell under more than one brand — flattening
the two would force a schema change the day that shows up. See
docs/DATABASE.md for the resolved Manufacturer/Brand/ProductLine split.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.mssql import NVARCHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from idy_thread.db.base import Base
from idy_thread.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from idy_thread.domain.product_lines.models import ProductLine


class Brand(Base, TimestampMixin):
    __tablename__ = "Brand"
    __table_args__ = (UniqueConstraint("ManufacturerId", "NormalizedName", name="uq_manufacturer_name"),)

    BrandId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ManufacturerId: Mapped[int] = mapped_column(ForeignKey("Manufacturer.ManufacturerId"), nullable=False)
    Name: Mapped[str] = mapped_column(NVARCHAR(200), nullable=False)
    NormalizedName: Mapped[str] = mapped_column(NVARCHAR(200), nullable=False)
    Status: Mapped[str] = mapped_column(NVARCHAR(20), nullable=False, default="ACTIVE")
    Metadata: Mapped[Optional[str]] = mapped_column(NVARCHAR(None))

    ProductLines: Mapped[list["ProductLine"]] = relationship(back_populates="Brand")

    def __repr__(self) -> str:
        return f"<Brand {self.Name!r}>"
