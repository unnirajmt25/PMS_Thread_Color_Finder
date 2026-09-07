"""Milestone 3. ProductLine entity — belongs to a Brand.

This is the "SS Rayon" / "Super Brite Poly" / "Polyneon" part of a sheet
name like "Robison Anton SS Rayon" — split out from Brand so material,
weight, and finish can be tracked per line instead of jammed into a free
-text brand name. See docs/DATABASE.md for the Manufacturer/Brand
/ProductLine split rationale.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.mssql import NVARCHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from idy_thread.db.base import Base
from idy_thread.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from idy_thread.domain.brands.models import Brand
    from idy_thread.domain.threads.models import Thread


class ProductLine(Base, TimestampMixin):
    __tablename__ = "ProductLine"
    __table_args__ = (UniqueConstraint("BrandId", "NormalizedName", name="uq_brand_name"),)

    ProductLineId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    BrandId: Mapped[int] = mapped_column(ForeignKey("Brand.BrandId"), nullable=False)
    Name: Mapped[str] = mapped_column(NVARCHAR(200), nullable=False)
    NormalizedName: Mapped[str] = mapped_column(NVARCHAR(200), nullable=False)
    ThreadType: Mapped[Optional[str]] = mapped_column(NVARCHAR(100))
    Material: Mapped[Optional[str]] = mapped_column(NVARCHAR(100))
    Weight: Mapped[Optional[str]] = mapped_column(NVARCHAR(50))
    Finish: Mapped[Optional[str]] = mapped_column(NVARCHAR(100))
    Status: Mapped[str] = mapped_column(NVARCHAR(20), nullable=False, default="ACTIVE")
    Metadata: Mapped[Optional[str]] = mapped_column(NVARCHAR(None))

    Brand: Mapped["Brand"] = relationship(back_populates="ProductLines")
    Threads: Mapped[list["Thread"]] = relationship(back_populates="ProductLine")

    def __repr__(self) -> str:
        return f"<ProductLine {self.Name!r}>"
