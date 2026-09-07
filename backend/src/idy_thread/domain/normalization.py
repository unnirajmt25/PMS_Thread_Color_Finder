"""Shared name-normalization used to build the ``NormalizedName``/
``NormalizedAlias`` columns on Source and Manufacturer (and their aliases).

Deliberately just whitespace/case folding — not fuzzy matching. Profiling
all 30 vendor workbooks turned up real inconsistencies this alone won't
fix (e.g. "Robison Anton" vs. the misspelled "Robinson Anton" normalize to
two different strings). Those are handled by seeding an explicit alias row
per known variant (see domain/manufacturers/models.py:ManufacturerAlias),
not by trying to auto-detect near-duplicates at normalization time.
"""

from __future__ import annotations

import re

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_name(value: str) -> str:
    return _WHITESPACE_RE.sub(" ", value.strip()).lower()
