# ADR 0001: Running Milestone 1 on Python 3.9 instead of the 3.12+ target

**Status**: Accepted (interim)

## Context

The project spec targets Python 3.12+. The only Python installed on the
current dev machine is 3.9.0. Installing a newer Python is a system-level
change outside the scope of "profile the sample files."

## Decision

Proceed with Python 3.9 for Milestone 1 (project skeleton + profiler).
`pyproject.toml` declares `requires-python = ">=3.9"` with a comment
pointing here, and `target-version = "py39"` in the Ruff config.

To keep the code forward-compatible with 3.12+ syntax without breaking on
3.9:

- Every module that uses modern type-hint syntax starts with
  `from __future__ import annotations`, which makes all annotations lazy
  strings — so `def f(x: int | None) -> str | None:` parses fine on 3.9
  even though the `X | Y` union syntax is technically a 3.10+ runtime
  feature.
- `typing.List`/`typing.Optional`/`typing.Dict` are used in places where a
  value needs to be constructed at runtime (e.g. `Field(default_factory=list)`
  arguments), since those aren't just annotations.

## Consequences

- All Milestone 1 dependencies (SQLAlchemy 2.x, Pydantic v2, FastAPI,
  Alembic, Typer, Rich, openpyxl) support Python 3.9, so nothing is
  blocked functionally.
- Before Milestone 12 (FastAPI) or any production deployment, upgrade to
  Python 3.12+ and remove this ADR's workaround, since some newer stdlib
  features (`typing.Self`, etc.) are 3.11+/3.12+ only and are NOT used yet
  specifically to avoid a 3.9 breakage.
- Re-verify `python scripts/verify_environment.py` reports "OK" (not
  "BELOW TARGET") once a newer interpreter is available.
