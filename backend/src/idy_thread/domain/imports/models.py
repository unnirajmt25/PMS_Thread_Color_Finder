"""Milestone 3. Import provenance chain: ImportBatch -> SourceFile ->
SourceWorksheet -> RawRecord, plus FieldMapping.

Nothing here is ever discarded once written (spec section 8's full
provenance requirement): a RawRecord is the untouched row as it appeared in
the workbook, independent of how normalization later interprets it. Deleting
an entire ImportBatch (e.g. cleaning up a duplicate/failed upload) cascades
to its own files/worksheets/rows/mappings — but Source/Manufacturer/
Thread/Color master data is never touched by that cascade.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.mssql import BIT, NVARCHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from idy_thread.db.base import Base
from idy_thread.db.mixins import TimestampMixin

_IMPORT_BATCH_STATUSES = (
    "UPLOADED",
    "ANALYZING",
    "ANALYZED",
    "VALIDATING",
    "NEEDS_REVIEW",
    "APPROVED",
    "IMPORTING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
)


class ImportBatch(Base, TimestampMixin):
    __tablename__ = "ImportBatch"
    __table_args__ = (
        CheckConstraint(
            "Status IN (" + ",".join(f"'{s}'" for s in _IMPORT_BATCH_STATUSES) + ")",
            name="status_valid",
        ),
    )

    ImportBatchId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Nullable: a brand-new upload starts with no confirmed Source until the
    # user confirms (or rejects) the fuzzy-match suggestion during ANALYZING.
    SourceId: Mapped[Optional[int]] = mapped_column(ForeignKey("Source.SourceId"))
    Status: Mapped[str] = mapped_column(NVARCHAR(20), nullable=False, default="UPLOADED")
    ParserVersion: Mapped[Optional[str]] = mapped_column(NVARCHAR(50))
    NormalizerVersion: Mapped[Optional[str]] = mapped_column(NVARCHAR(50))
    FileCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    RowCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    AcceptedCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    RejectedCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    WarningCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ErrorCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    CreatedBy: Mapped[Optional[str]] = mapped_column(NVARCHAR(200))

    Files: Mapped[list["SourceFile"]] = relationship(back_populates="ImportBatch", cascade="all, delete-orphan")
    FieldMappings: Mapped[list["FieldMapping"]] = relationship(
        back_populates="ImportBatch", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ImportBatch {self.ImportBatchId} {self.Status}>"


class SourceFile(Base, TimestampMixin):
    __tablename__ = "SourceFile"

    SourceFileId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ImportBatchId: Mapped[int] = mapped_column(
        ForeignKey("ImportBatch.ImportBatchId", ondelete="CASCADE"), nullable=False
    )
    OriginalFileName: Mapped[str] = mapped_column(NVARCHAR(300), nullable=False)
    StoredFileName: Mapped[str] = mapped_column(NVARCHAR(300), nullable=False)
    FileType: Mapped[str] = mapped_column(NVARCHAR(20), nullable=False)
    FileSizeBytes: Mapped[int] = mapped_column(nullable=False)
    Sha256: Mapped[str] = mapped_column(NVARCHAR(64), nullable=False)
    Metadata: Mapped[Optional[str]] = mapped_column(NVARCHAR(None))

    ImportBatch: Mapped["ImportBatch"] = relationship(back_populates="Files")
    Worksheets: Mapped[list["SourceWorksheet"]] = relationship(
        back_populates="SourceFile", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<SourceFile {self.OriginalFileName!r}>"


class SourceWorksheet(Base, TimestampMixin):
    __tablename__ = "SourceWorksheet"

    SourceWorksheetId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    SourceFileId: Mapped[int] = mapped_column(
        ForeignKey("SourceFile.SourceFileId", ondelete="CASCADE"), nullable=False
    )
    WorksheetName: Mapped[str] = mapped_column(NVARCHAR(200), nullable=False)
    SheetIndex: Mapped[int] = mapped_column(Integer, nullable=False)
    RowCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ColumnCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    HeaderRowNumber: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    Metadata: Mapped[Optional[str]] = mapped_column(NVARCHAR(None))

    SourceFile: Mapped["SourceFile"] = relationship(back_populates="Worksheets")
    RawRecords: Mapped[list["RawRecord"]] = relationship(
        back_populates="SourceWorksheet", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<SourceWorksheet {self.WorksheetName!r}>"


class RawRecord(Base):
    __tablename__ = "RawRecord"
    __table_args__ = (CheckConstraint("ISJSON(RawPayload) = 1", name="raw_payload_is_json"),)

    RawRecordId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    SourceWorksheetId: Mapped[int] = mapped_column(
        ForeignKey("SourceWorksheet.SourceWorksheetId", ondelete="CASCADE"), nullable=False
    )
    SourceRowNumber: Mapped[int] = mapped_column(Integer, nullable=False)
    RowHash: Mapped[str] = mapped_column(NVARCHAR(64), nullable=False)
    RawPayload: Mapped[str] = mapped_column(NVARCHAR(None), nullable=False)
    ProcessingStatus: Mapped[str] = mapped_column(NVARCHAR(20), nullable=False, default="PENDING")
    CreatedAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), nullable=False)

    SourceWorksheet: Mapped["SourceWorksheet"] = relationship(back_populates="RawRecords")

    def __repr__(self) -> str:
        return f"<RawRecord row={self.SourceRowNumber}>"


class FieldMapping(Base):
    __tablename__ = "FieldMapping"
    __table_args__ = (CheckConstraint("Confidence IN ('HIGH','MEDIUM','LOW')", name="confidence_valid"),)

    FieldMappingId: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ImportBatchId: Mapped[int] = mapped_column(
        ForeignKey("ImportBatch.ImportBatchId", ondelete="CASCADE"), nullable=False
    )
    SourceFieldName: Mapped[str] = mapped_column(NVARCHAR(200), nullable=False)
    CanonicalFieldName: Mapped[str] = mapped_column(NVARCHAR(100), nullable=False)
    MappingMethod: Mapped[str] = mapped_column(NVARCHAR(50), nullable=False)
    Confidence: Mapped[str] = mapped_column(NVARCHAR(10), nullable=False)
    Evidence: Mapped[Optional[str]] = mapped_column(NVARCHAR(500))
    UserApproved: Mapped[bool] = mapped_column(BIT, nullable=False, default=False)
    CreatedAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), nullable=False)

    ImportBatch: Mapped["ImportBatch"] = relationship(back_populates="FieldMappings")

    def __repr__(self) -> str:
        return f"<FieldMapping {self.SourceFieldName!r} -> {self.CanonicalFieldName!r}>"
