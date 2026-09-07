"""Milestone 3. DataQualityIssue — the persisted form of the profiler's
in-memory QualityWarning (see infrastructure/parsers/workbook_profiler.py).
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, func
from sqlalchemy.dialects.mssql import NVARCHAR
from sqlalchemy.orm import Mapped, mapped_column

from idy_thread.db.base import Base

_SEVERITIES = ("INFO", "WARNING", "ERROR", "CRITICAL")


class DataQualityIssue(Base):
    __tablename__ = "DataQualityIssue"
    __table_args__ = (
        CheckConstraint("Severity IN (" + ",".join(f"'{s}'" for s in _SEVERITIES) + ")", name="severity_valid"),
        CheckConstraint("Status IN ('OPEN','RESOLVED','IGNORED')", name="status_valid"),
    )

    DataQualityIssueId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ImportBatchId: Mapped[int] = mapped_column(
        ForeignKey("ImportBatch.ImportBatchId", ondelete="CASCADE"), nullable=False
    )
    # NOT ondelete=CASCADE: SQL Server rejects multiple cascade paths, and
    # RawRecord already cascades from ImportBatch via SourceFile ->
    # SourceWorksheet -> RawRecord, so DataQualityIssue.ImportBatchId's own
    # CASCADE already cleans these rows up when a whole batch is deleted.
    RawRecordId: Mapped[Optional[int]] = mapped_column(ForeignKey("RawRecord.RawRecordId"))
    Severity: Mapped[str] = mapped_column(NVARCHAR(10), nullable=False)
    IssueType: Mapped[str] = mapped_column(NVARCHAR(100), nullable=False)
    FieldName: Mapped[Optional[str]] = mapped_column(NVARCHAR(200))
    Message: Mapped[str] = mapped_column(NVARCHAR(1000), nullable=False)
    SuggestedResolution: Mapped[Optional[str]] = mapped_column(NVARCHAR(500))
    Status: Mapped[str] = mapped_column(NVARCHAR(20), nullable=False, default="OPEN")
    CreatedAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), nullable=False)
    ResolvedAt: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ResolvedBy: Mapped[Optional[str]] = mapped_column(NVARCHAR(200))

    def __repr__(self) -> str:
        return f"<DataQualityIssue {self.Severity} {self.IssueType!r}>"
