# Database

> **Status: IMPLEMENTED (Milestone 3).** Schema is live in `IdyThreadIntelligence`
> via Alembic migration `cc95e56d8f01` (initial schema). Manufacturer/
> ManufacturerAlias master data is seeded. This page documents what
> actually exists, not a proposal.

## Connection plan (Milestone 1-2)

- Engine: Microsoft SQL Server, via SQLAlchemy 2.x + `pyodbc`.
- Dev target: the local **SQL Server 2022 Express** instance already
  running on this machine (`.\SQLEXPRESS`), reached via **Windows
  Authentication** (no password stored anywhere) — see `.env.example`.
- Database name: **`IdyThreadIntelligence`** — deliberately separate from
  the two other databases already on that instance (`YoodeOrderSheet`,
  `iD_Internal`), which belong to unrelated applications.
- All connection parameters are centralized in `config/settings.py`;
  `migrations/env.py` reads `Settings.database_url` — no connection string
  is duplicated anywhere else.
- Schema changes are made **exclusively** through Alembic migrations
  (`alembic revision --autogenerate`, reviewed, then `alembic upgrade
  head`) — never by hand.

## Entity-relationship overview

```
Source ──────────────────────┐
  │  (SourceCode, NormalizedName)
  │                          │
  │ 1                        │ 1
  │                          │
  │ *                        │ *
ThreadIdentifier          ImportBatch
  │ *                        │ 1
  │                          │ *
  │ 1                     SourceFile
Thread                       │ 1
  │ 1  \                     │ *
  │     \ *               SourceWorksheet
  │   Color                  │ 1
  │                          │ *
  │ *                     RawRecord
  │ 1
ProductLine
  │ *
  │ 1
Brand
  │ *
  │ 1
Manufacturer ── 1:* ── ManufacturerAlias

ImportBatch also owns FieldMapping (1:*) and DataQualityIssue (1:*, via
ImportBatchId; DataQualityIssue optionally points at one RawRecordId too).
```

Master data (Manufacturer → Brand → ProductLine → Thread → Color, and
Source/ThreadIdentifier) is separate from the import-provenance chain
(ImportBatch → SourceFile → SourceWorksheet → RawRecord, plus FieldMapping
and DataQualityIssue). Deleting an ImportBatch cascades through its own
provenance rows only — it never touches master data.

## Why Source, Manufacturer, Brand, and ProductLine are four separate tables

A **Source** is whoever handed us a chart — a distributor, a promo-products
supplier, a direct manufacturer feed. A **Manufacturer** actually makes the
thread. They're kept apart because a distributor can resell threads made by
several different manufacturers on one chart; collapsing them into one
generic "Vendor" table would make that unrepresentable.

**Brand** and **ProductLine** exist because a sheet name like "Robison
Anton SS Rayon" is really two things glued together: the manufacturer
("Robison-Anton") and the specific product line ("SS Rayon"). Profiling
confirmed this pattern generalizes across the catalog — "Madeira Classic
Rayon", "Madeira Polyneon" (Manufacturer=Madeira), "Gunold Polyester"
(Manufacturer=Gunold), etc. Brand is kept distinct from Manufacturer (not
collapsed into it) because a manufacturer can sell under more than one
brand — for the data seen so far Brand mirrors Manufacturer 1:1, but
splitting them now avoids a schema change the day that stops being true.

## Solving vendor/manufacturer duplication on re-import

This was the specific requirement: when an updated chart is uploaded later,
the system must resolve it to the *same* Source/Manufacturer rather than
creating a duplicate. Two matching keys exist, at two different layers:

**Source (the platform's key):** `Source.SourceCode` is a stable,
admin-controlled slug (e.g. `4IMPRINT`) — set once when a Source is first
created and never re-derived from a filename. `Source.NormalizedName`
(whitespace/case-folded) backs a fuzzy-match *suggestion* at upload time,
but a match is always confirmed by a human before an ImportBatch is
attached to an existing Source — never merged silently.

**Manufacturer (inside the data itself):** confirmed by profiling all 30
real workbooks — the same manufacturer is spelled inconsistently *within
the vendor data itself*: sheet names include `"RA SS Rayon"`, `"Robison
Anton SS Rayon"`, and `"Robinson Anton SS Rayon"` (a genuine misspelling,
not just an abbreviation) all referring to one manufacturer. `Manufacturer`
has one canonical row; every known spelling/abbreviation is a row in
`ManufacturerAlias` pointing at it. Resolving a manufacturer at import time
is a lookup — `normalize_name(value)` against `ManufacturerAlias
.NormalizedAlias` — not fuzzy string-matching. New variants discovered
later are added as new alias rows (`scripts/seed_manufacturers.py`),
never as a code change. Currently seeded: Robison-Anton (aliases:
"Robison-Anton", "Robison Anton", "Robinson Anton", "RA"), Madeira,
Gunold, Isacord, Marathon, Otto.

## Tables

All tables use `BIGINT IDENTITY` surrogate primary keys (enforced project
-wide via `type_annotation_map = {int: BigInteger}` on `Base`, in
`db/base.py`, so every plain `Mapped[int]` column — every PK and FK in the
schema — resolves to `BIGINT` without repeating the type on each column;
natural vendor codes are never a primary key, since profiling confirmed a
numeric thread code can be reused across unrelated sheets). All text is
`NVARCHAR`. Every
table has `CreatedAt`/`UpdatedAt` (`DATETIME2`-equivalent, default
`SYSUTCDATETIME()`) except `RawRecord`, `FieldMapping`, and
`DataQualityIssue`, which are write-once/append-only and carry
`CreatedAt` only.

### Master data

| Table | Key columns | Notes |
|---|---|---|
| `Source` | `SourceId` PK, `SourceCode` (unique), `Name`, `NormalizedName` (unique), `SourceType`, `Status` | The re-import matching key — see above. |
| `Manufacturer` | `ManufacturerId` PK, `Name`, `NormalizedName` (unique), `Country`, `Status` | |
| `ManufacturerAlias` | `ManufacturerAliasId` PK, `ManufacturerId` FK→Manufacturer (`CASCADE`), `Alias`, `NormalizedAlias` (unique) | Every known spelling/abbreviation resolves here. |
| `Brand` | `BrandId` PK, `ManufacturerId` FK→Manufacturer, `Name`, `NormalizedName`, unique `(ManufacturerId, NormalizedName)` | |
| `ProductLine` | `ProductLineId` PK, `BrandId` FK→Brand, `Name`, `NormalizedName`, `ThreadType`, `Material`, `Weight`, `Finish`, unique `(BrandId, NormalizedName)` | |
| `Thread` | `ThreadId` PK, `ProductLineId` FK→ProductLine, `CanonicalName`, `Status` | Never keyed by a vendor code. |
| `ThreadIdentifier` | `ThreadIdentifierId` PK, `ThreadId` FK→Thread (`CASCADE`), `SourceId` FK→Source, `IdentifierType`, `IdentifierValue`, `NormalizedValue`, `IsPrimary`, unique `(SourceId, IdentifierType, NormalizedValue)` | The actual vendor-supplied thread codes; what a re-import matches rows against. |
| `Color` | `ColorId` PK, `ThreadId` FK→Thread (`CASCADE`), `Red`/`Green`/`Blue` (`TINYINT`), `HexCode` (format-checked), `PmsCode`, `PmsName`, `LabL/A/B`, `XValue/YValue/ZValue`, `CalculationMethod` (default `VENDOR_SUPPLIED`), `CalculationVersion` | Calculated values (Lab, XYZ, Delta E later) are tagged by method/version so they're never confused with vendor-supplied ground truth. |

### Import provenance (never discarded, per spec section 8)

| Table | Key columns | Notes |
|---|---|---|
| `ImportBatch` | `ImportBatchId` PK, `SourceId` FK→Source (nullable until confirmed), `Status` (state machine, CHECK-constrained), `FileCount`/`RowCount`/`AcceptedCount`/`RejectedCount`/`WarningCount`/`ErrorCount`, `ParserVersion`, `NormalizerVersion`, `CreatedBy` | `Status` values: `UPLOADED → ANALYZING → ANALYZED → VALIDATING → NEEDS_REVIEW → APPROVED → IMPORTING → COMPLETED / FAILED / CANCELLED`. |
| `SourceFile` | `SourceFileId` PK, `ImportBatchId` FK→ImportBatch (`CASCADE`), `OriginalFileName`, `StoredFileName`, `FileType`, `FileSizeBytes`, `Sha256` | |
| `SourceWorksheet` | `SourceWorksheetId` PK, `SourceFileId` FK→SourceFile (`CASCADE`), `WorksheetName`, `SheetIndex`, `RowCount`, `ColumnCount`, `HeaderRowNumber` | |
| `RawRecord` | `RawRecordId` PK, `SourceWorksheetId` FK→SourceWorksheet (`CASCADE`), `SourceRowNumber`, `RowHash`, `RawPayload` (JSON, `ISJSON()` CHECK), `ProcessingStatus` | The untouched row, independent of how normalization later interprets it. |
| `FieldMapping` | `FieldMappingId` PK, `ImportBatchId` FK→ImportBatch (`CASCADE`), `SourceFieldName`, `CanonicalFieldName`, `MappingMethod`, `Confidence` (HIGH/MEDIUM/LOW), `Evidence`, `UserApproved` | Persists what `infrastructure/parsers/field_heuristics.py` produces at profiling time. |
| `DataQualityIssue` | `DataQualityIssueId` PK, `ImportBatchId` FK→ImportBatch (`CASCADE`), `RawRecordId` FK→RawRecord (nullable, no cascade — see below), `Severity` (INFO/WARNING/ERROR/CRITICAL), `IssueType`, `FieldName`, `Message`, `SuggestedResolution`, `Status`, `ResolvedAt`, `ResolvedBy` | Persists the profiler's in-memory `QualityWarning`. |

`DataQualityIssue.RawRecordId` deliberately has **no** `ON DELETE CASCADE`:
SQL Server rejects multiple cascade paths to the same table, and
`RawRecord` already cascades from `ImportBatch` via `SourceFile` →
`SourceWorksheet` → `RawRecord`, so `DataQualityIssue.ImportBatchId`'s own
cascade already cleans these rows up when a whole batch is deleted.

## Naming conventions

- `IDENTITY` surrogate primary keys everywhere (spec section 8).
- `NVARCHAR` for all text.
- Every table gets `CreatedAt` (append-only tables) or `CreatedAt` +
  `UpdatedAt` (mutable tables).
- `BIT` for booleans (`IsPrimary`, `UserApproved`).
- Free-form `Metadata` (JSON text) exists only where nothing else fits;
  every field that needs to be searched/filtered/joined is a real
  relational column, never JSON-only.
- Alembic-managed constraint/index names follow a fixed convention
  (`pk_<table>`, `fk_<table>_<column>_<referred_table>`,
  `uq_<table>_<column>`, `ck_<table>_<constraint_name>`) so
  autogenerate diffs stay readable.

## Code layout

- `db/base.py` — `Base` (declarative, with the naming convention above),
  `get_engine()`, `get_session_factory()`.
- `db/mixins.py` — `TimestampMixin` (`CreatedAt`/`UpdatedAt`).
- `db/models.py` — imports every domain model so `Base.metadata` and the
  mapper registry are fully populated; `migrations/env.py` imports *this*
  module, never individual entity modules directly.
- `domain/<entity>/models.py` — one file per entity group (`sources`,
  `manufacturers`, `brands`, `product_lines`, `threads`, `colors`,
  `imports`, `quality`). For Milestone 3 the SQLAlchemy model *is* the
  domain entity — no separate plain-dataclass duplication yet, since
  there's no business logic to separate out. That split can happen later
  (Milestone 5+) without touching the schema.
- `domain/normalization.py` — the one `normalize_name()` function shared
  by Source and Manufacturer normalization.
- `migrations/` — Alembic; `env.py` builds its connection URL from
  `Settings.database_url` (never hard-coded), with `target_metadata =
  models.Base.metadata` and `compare_type=True`.
- `scripts/seed_manufacturers.py` — idempotent seed for Manufacturer +
  ManufacturerAlias master data.
- `scripts/smoke_test_schema.py` — inserts a full Source → Brand →
  ProductLine → Thread → Color chain, proves alias-based manufacturer
  resolution, proves a CHECK constraint actually rejects bad data, then
  deletes everything it inserted. Safe to re-run against the real dev
  database.

## Known simplifications / next review points

- **Brand vs. Manufacturer population strategy**: the schema supports the
  full Manufacturer → Brand → ProductLine hierarchy, but no code yet
  splits a sheet name like "Robison Anton SS Rayon" into Brand vs.
  ProductLine automatically — that's Milestone 5 (import pipeline) work.
  The recommended approach (not yet implemented): prefix-match the sheet
  name against `ManufacturerAlias`, treat the matched alias as the
  Manufacturer/Brand and the remainder as the ProductLine name.
- **Master-data deletes**: Manufacturer/Brand/ProductLine/Thread FKs have
  no `ON DELETE CASCADE` — deleting a row with dependents fails loudly
  rather than cascading. Master data is expected to be soft-deleted via
  `Status='INACTIVE'`, not physically removed.
