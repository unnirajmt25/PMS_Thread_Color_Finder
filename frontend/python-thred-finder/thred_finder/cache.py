"""A small on-disk cache so the CLI doesn't re-parse every .xlsx workbook
on every invocation. Invalidated automatically whenever any file in the
data directory changes (name, size, or modified time)."""

from __future__ import annotations

import json
from pathlib import Path

from .loader import Record, load_records

_CACHE_FILENAME = ".thred_finder_cache.json"


def _signature(data_dir: Path) -> list:
    return sorted(
        [p.name, p.stat().st_mtime_ns, p.stat().st_size]
        for p in data_dir.glob("*.xlsx")
        if not p.name.startswith("~$")
    )


def load_records_cached(data_dir: str | Path, *, refresh: bool = False) -> list[Record]:
    data_dir = Path(data_dir)
    cache_path = data_dir / _CACHE_FILENAME
    signature = _signature(data_dir)

    if not refresh and cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if cached.get("signature") == signature:
                return [Record(**row) for row in cached["records"]]
        except (json.JSONDecodeError, KeyError, TypeError, OSError):
            pass  # fall through and rebuild

    records = load_records(data_dir)
    try:
        cache_path.write_text(
            json.dumps({"signature": signature, "records": [r.as_dict() for r in records]}),
            encoding="utf-8",
        )
    except OSError:
        pass  # cache is a pure optimization; ignore write failures

    return records
