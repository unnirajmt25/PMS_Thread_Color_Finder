"""Pydantic models for the workbook profiler's output.

These are NOT domain entities — they're a profiling-time DTO describing
what a file structurally *looks like*, produced without writing anything
to a database. The eventual canonical schema (Milestone 3) is designed
FROM this output, not the other way around (section 5: do not finalize
the schema before profiling results have been reviewed).
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

Severity = str  # "INFO" | "WARNING" | "ERROR" | "CRITICAL"
Confidence = str  # "HIGH" | "MEDIUM" | "LOW"

# NOTE: Optional[X] here, NOT `X | None` — Pydantic evaluates field
# annotations at class-definition time to build its schema, so `from
# __future__ import annotations` (which only defers *parsing*) doesn't
# help; `X | None` genuinely needs Python 3.10+ at runtime. Plain
# functions elsewhere in this project (not Pydantic models) CAN use
# `X | None` safely under the future-import. See
# docs/decisions/0001-python-version.md.


class QualityWarning(BaseModel):
    severity: Severity
    issue_type: str
    message: str
    sheet_name: Optional[str] = None
    column_name: Optional[str] = None
    row_number: Optional[int] = None


class FieldMappingSuggestion(BaseModel):
    source_column: str
    canonical_field: str
    confidence: Confidence
    evidence: str


class ColumnProfile(BaseModel):
    index: int
    header: str
    inferred_type: str  # "integer" | "decimal" | "text" | "empty" | "mixed"
    non_empty_count: int
    empty_count: int
    sample_values: list[str] = Field(default_factory=list)


class SheetProfile(BaseModel):
    name: str
    row_count: int
    column_count: int
    header_row_number: int
    headers: list[str]
    duplicate_headers: list[str] = Field(default_factory=list)
    empty_row_count: int
    empty_column_count: int
    duplicate_record_count: int
    columns: list[ColumnProfile]
    field_mappings: list[FieldMappingSuggestion]
    warnings: list[QualityWarning] = Field(default_factory=list)


class WorkbookProfile(BaseModel):
    file_name: str
    file_path: str
    file_size_bytes: int
    sha256: str
    likely_source: str
    sheets: list[SheetProfile]
    warnings: list[QualityWarning] = Field(default_factory=list)


class ProfileReport(BaseModel):
    generated_at: datetime
    files_analyzed: int
    total_sheets: int
    total_rows: int
    total_warnings: int
    warnings_by_severity: dict = Field(default_factory=dict)
    discovered_sources: list[str] = Field(default_factory=list)
    discovered_headers: list[str] = Field(default_factory=list)
    workbooks: list[WorkbookProfile]
    unknown: list[str] = Field(default_factory=list)
