"""Free-text matching against loaded thread/PMS records."""

from __future__ import annotations

from .loader import Record


def _haystack(record: Record) -> str:
    return " ".join(
        [
            record.vendor,
            record.thread_brand,
            record.thread_code,
            record.thread_color_name,
            record.pms_code,
            record.pms_name,
        ]
    ).lower()


def search(records: list[Record], query: str, *, vendor: str | None = None, limit: int | None = None) -> list[Record]:
    """Case-insensitive substring search across vendor, thread brand/code/
    color name, and PMS code/name. Exact thread-code matches are ranked
    first, since that's the most common lookup ("what PMS is thread 2257?").
    """
    needle = query.strip().lower()
    pool = [r for r in records if r.vendor == vendor] if vendor else records
    if not needle:
        results = pool
    else:
        results = [r for r in pool if needle in _haystack(r)]
        results.sort(key=lambda r: (r.thread_code.lower() != needle, r.vendor, r.thread_brand))

    return results[:limit] if limit else results
