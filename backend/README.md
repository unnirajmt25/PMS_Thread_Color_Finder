# IDY Thread Chart Management & Embroidery Color Intelligence Platform

A vendor-agnostic, schema-flexible platform for ingesting embroidery thread
charts from many sources — including future files with completely
different structures than today's — and building a canonical, provenance-
tracked thread/color database on Microsoft SQL Server.

**Status: Phase 1, Milestone 1 (data discovery).** No database schema has
been finalized yet — see [docs/DATABASE.md](docs/DATABASE.md) for the
current draft, which is explicitly pending review against the profiler's
findings on the real sample files.

## Why this exists

The existing `Thread Chart/` sample workbooks (30 vendor `.xlsx` files) all
happen to share the same column layout. **That is a coincidence, not a
guarantee.** This project is built so that a differently-shaped file next
month — different columns, a PDF, a CSV, missing headers — degrades
gracefully into "needs review," never into silently wrong data or a crash.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how.

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -e ".[dev]"
copy .env.example .env            # then edit SQL_SERVER_* if needed

python scripts/verify_environment.py
python scripts/profile_workbooks.py            # profiles ../Thread Chart by default
```

Or via the CLI once installed:

```bash
idy profile-folder "../Thread Chart"
idy health
```

## Project layout

See section 27 of the original spec / the directory tree in this repo.
Key idea: `domain/` never imports `infrastructure/` or `db/` — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, domain
  separation (Source vs. Manufacturer vs. Brand vs. ProductLine vs.
  Thread), why raw data is never discarded.
- [docs/DATABASE.md](docs/DATABASE.md) — SQL Server connection plan and
  the **draft, not-yet-implemented** entity design.
- [docs/decisions/](docs/decisions/) — architecture decision records
  (e.g. why Milestone 1 runs on Python 3.9 instead of the 3.12+ target).

## Current known gaps

- Dev machine has Python 3.9.0, not the 3.12+ target — tracked in
  [docs/decisions/0001-python-version.md](docs/decisions/0001-python-version.md).
- No database schema/migrations exist yet — intentional, per the "profile
  before you design" principle.
