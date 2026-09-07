"""Heuristic (non-hard-coded) header -> canonical-field mapping.

Section 5 of the spec: "Do not guess mappings silently." This module never
claims certainty — every suggestion carries a confidence tier and the
evidence behind it, and callers must treat LOW-confidence suggestions as
requiring human review, not as ground truth. New candidate keywords can be
added here as new vendor formats are seen, without touching the profiler
or any domain/database code — this is the one place format knowledge
lives.
"""

from __future__ import annotations

from difflib import SequenceMatcher

from .profile_models import FieldMappingSuggestion

# Candidate header spellings seen (or reasonably expected) across vendor
# thread charts. Order within a list doesn't matter; specificity does —
# single-letter keys are matched exactly only (see _score below) to avoid
# e.g. "R" matching inside "Rayon".
CANONICAL_FIELD_KEYWORDS: dict[str, list[str]] = {
    "source_thread_code": [
        "thread number", "thread code", "article number", "sku",
        "product code", "color number", "colour number", "item number",
        "style number", "code",
    ],
    "source_color_name": [
        "thread name", "color name", "colour name", "name",
    ],
    "color_category": [
        "color category", "colour category", "category",
    ],
    "product_line_name": [
        "thread chart", "product line", "chart", "collection", "thread type",
    ],
    "pms_code": [
        "pms number", "pms code", "pms", "pantone",
    ],
    "red": ["r", "red"],
    "green": ["g", "green"],
    "blue": ["b", "blue"],
    "hex_code": ["hex", "hex code", "hex value"],
    "monitor_display_color": ["monitor display color", "display color", "swatch"],
    "manufacturer_or_brand": ["manufacturer", "brand", "vendor", "source"],
}

_EXACT_ONLY_FIELDS = {"red", "green", "blue"}  # single-letter keywords: no substring/fuzzy matching


def _normalize(text: str) -> str:
    return " ".join(text.strip().lower().split())


def _score(header_norm: str, keyword: str, *, exact_only: bool) -> float:
    if header_norm == keyword:
        return 1.0
    if exact_only:
        return 0.0
    if keyword in header_norm or header_norm in keyword:
        return 0.75
    ratio = SequenceMatcher(None, header_norm, keyword).ratio()
    return ratio if ratio >= 0.6 else 0.0


def _confidence_for(score: float) -> str | None:
    if score >= 0.95:
        return "HIGH"
    if score >= 0.75:
        return "MEDIUM"
    if score >= 0.6:
        return "LOW"
    return None


def suggest_field_mapping(header: str) -> FieldMappingSuggestion | None:
    """Returns the single best canonical-field suggestion for a header, or
    None if nothing scored high enough to be worth reporting."""
    header_norm = _normalize(header)
    if not header_norm:
        return None

    best_field = None
    best_keyword = None
    best_score = 0.0

    for field, keywords in CANONICAL_FIELD_KEYWORDS.items():
        exact_only = field in _EXACT_ONLY_FIELDS
        for keyword in keywords:
            score = _score(header_norm, keyword, exact_only=exact_only)
            if score > best_score:
                best_score = score
                best_field = field
                best_keyword = keyword

    confidence = _confidence_for(best_score)
    if confidence is None or best_field is None:
        return None

    return FieldMappingSuggestion(
        source_column=header,
        canonical_field=best_field,
        confidence=confidence,
        evidence=f"'{header_norm}' matched keyword '{best_keyword}' (score={best_score:.2f})",
    )
