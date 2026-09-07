# Architecture

## Guiding principle

The system must handle **unknown future thread-chart formats**, not just
the 30 sample `.xlsx` files it currently has. Concretely, this means:

- No parser or profiler hard-codes "column 4 is R" — everything is
  header-name-driven with confidence-scored heuristics
  (`infrastructure/parsers/field_heuristics.py`), never positional
  assumptions.
- The domain layer (`domain/`) has zero knowledge of Excel, PDF, or any
  file format. It only knows about canonical entities (Thread, Color,
  Source, ...). File-format knowledge lives entirely in
  `infrastructure/parsers/`.
- Every layer can be tested without the layers below it: `domain/` needs
  no database, `infrastructure/parsers/` needs no database, `application/`
  can be tested against fake repositories.

## Layers

```
api/            <- FastAPI routers (Milestone 12). Thin: calls application/, no business logic.
cli/            <- Typer commands. Thin: calls application/ or infrastructure/parsers/ directly.
application/    <- Use-case orchestration (e.g. "run an import batch"). No SQL, no ORM.
domain/         <- Entities + business rules. No I/O of any kind.
infrastructure/ <- Adapters: parsers (file -> intermediate representation),
                    repositories (domain <-> SQLAlchemy), storage, jobs.
db/             <- SQLAlchemy engine/session wiring, declarative Base.
config/         <- Settings (env vars). The only place connection strings are assembled.
```

Dependency direction is one-way: `api`/`cli` → `application` → `domain`,
with `infrastructure` implementing interfaces the other layers depend on
(not the reverse). `domain/` must never `import` anything from
`infrastructure/` or `db/`.

## Data flow (once the full import pipeline exists — Milestone 5+)

```
SOURCE FILE  (untrusted; security/file_validation.py checks it first)
   |
   v
RAW DATA  (RawRecord — the exact source row, JSON, never overwritten)
   |
   v
STAGING  (per-ImportBatch, reviewable before commit)
   |
   v
NORMALIZATION  (whitespace/unicode/case/number normalization — the RAW value is untouched)
   |
   v
VALIDATION  (RGB range, hex format, required-field checks — scoped to what that record type needs)
   |
   v
CANONICAL DATA  (Thread / Color / ThreadIdentifier, with FieldMapping provenance back to the raw row)
```

For any canonical value, the provenance chain (section 22 of the spec) is:

```
Canonical Thread -> Source Identifier -> Raw Record -> Worksheet -> Source File -> Import Batch -> Source
```

## Why the profiler exists before the schema

`infrastructure/parsers/workbook_profiler.py` is a **read-only structural
inspector** — it never writes to a database. It exists specifically so the
schema in `docs/DATABASE.md` is designed *from* what the real files
contain, rather than the other way around. Running it against a
differently-shaped future file should produce a useful "here's what I
found, here's what I'm unsure about" report, not an exception.

## Domain separation: Source vs. Manufacturer vs. Brand vs. ProductLine

A distributor (Source) may resell another company's thread (Manufacturer).
4imprint's chart, for example, contains sheets literally named "Robison
Anton SS Rayon" and "Madeira Polyneon" — Robison-Anton and Madeira are
manufacturers/brands, 4imprint is the distributor/source. Conflating these
into one "Vendor" table (as the existing React app's simpler model does)
would make it impossible to later ask "which distributors sell
Robison-Anton thread?" — a real question this platform needs to answer.
This is why section 7/9 of the spec keeps them as separate entities.

**Resolved** (was REQUIRES REVIEW): "Robison Anton SS Rayon" (a sheet name)
maps to Manufacturer="Robison-Anton" + ProductLine="SS Rayon". Profiling
all 30 workbooks' sheet names confirmed the pattern generalizes (Madeira,
Gunold, etc.) and surfaced real spelling variants ("RA", "Robison Anton",
"Robinson Anton") for the same manufacturer, which `ManufacturerAlias`
resolves — see `docs/DATABASE.md`. The schema and Manufacturer/
ManufacturerAlias master data are implemented; automatically *splitting* a
raw sheet name into Brand vs. ProductLine at import time is still
Milestone 5 work — a human still confirms the split when the source data
is ambiguous, the profiler does not auto-split.
