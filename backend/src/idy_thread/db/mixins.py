"""Shared column mixins for domain models.

Every table gets ``CreatedAt``/``UpdatedAt`` (spec section 8 naming
conventions, restated in docs/DATABASE.md). Kept as a mixin so it's applied
consistently instead of retyped per entity.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    CreatedAt: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.sysutcdatetime(), nullable=False
    )
    UpdatedAt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysutcdatetime(),
        onupdate=func.sysutcdatetime(),
        nullable=False,
    )
