"""Milestone 3. Color entity.

A Thread can have more than one Color row over time: the vendor-supplied
RGB/PMS values are ground truth (`CalculationMethod='VENDOR_SUPPLIED'`);
anything this platform derives later (Lab, XYZ, Delta E) is tagged with the
method/version that produced it so a calculated value is never confused
with what the vendor actually published (spec section 12).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, ForeignKey, Numeric
from sqlalchemy.dialects.mssql import NVARCHAR, TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from idy_thread.db.base import Base
from idy_thread.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from idy_thread.domain.threads.models import Thread


class Color(Base, TimestampMixin):
    __tablename__ = "Color"
    __table_args__ = (
        # No Red/Green/Blue range CHECK: TINYINT is already unsigned 0-255
        # in SQL Server, so a BETWEEN 0 AND 255 constraint would be dead
        # code duplicating what the column type already guarantees.
        CheckConstraint("HexCode LIKE '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'", name="hex_format"),
    )

    ColorId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ThreadId: Mapped[int] = mapped_column(ForeignKey("Thread.ThreadId", ondelete="CASCADE"), nullable=False)

    Red: Mapped[Optional[int]] = mapped_column(TINYINT)
    Green: Mapped[Optional[int]] = mapped_column(TINYINT)
    Blue: Mapped[Optional[int]] = mapped_column(TINYINT)
    HexCode: Mapped[Optional[str]] = mapped_column(NVARCHAR(7))

    PmsCode: Mapped[Optional[str]] = mapped_column(NVARCHAR(50))
    PmsName: Mapped[Optional[str]] = mapped_column(NVARCHAR(100))

    LabL: Mapped[Optional[float]] = mapped_column(Numeric(6, 3))
    LabA: Mapped[Optional[float]] = mapped_column(Numeric(6, 3))
    LabB: Mapped[Optional[float]] = mapped_column(Numeric(6, 3))
    XValue: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    YValue: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    ZValue: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))

    CalculationMethod: Mapped[str] = mapped_column(NVARCHAR(50), nullable=False, default="VENDOR_SUPPLIED")
    CalculationVersion: Mapped[Optional[str]] = mapped_column(NVARCHAR(20))

    Thread: Mapped["Thread"] = relationship(back_populates="Colors")

    def __repr__(self) -> str:
        return f"<Color ThreadId={self.ThreadId} #{self.HexCode}>"
