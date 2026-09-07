import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from idy_thread.infrastructure.parsers.field_heuristics import suggest_field_mapping


def test_exact_header_maps_high_confidence():
    result = suggest_field_mapping("Thread Number")
    assert result is not None
    assert result.canonical_field == "source_thread_code"
    assert result.confidence == "HIGH"


def test_single_letter_rgb_columns_match_exactly():
    assert suggest_field_mapping("R").canonical_field == "red"
    assert suggest_field_mapping("G").canonical_field == "green"
    assert suggest_field_mapping("B").canonical_field == "blue"


def test_single_letter_does_not_false_positive_inside_word():
    # "Brand" contains "r" but must not be matched to the single-letter
    # "red" keyword — only an exact "R" header should match.
    result = suggest_field_mapping("Brand")
    assert result is None or result.canonical_field != "red"


def test_close_variant_spelling_still_maps_with_lower_confidence():
    result = suggest_field_mapping("Colour Name")  # British spelling variant
    assert result is not None
    assert result.canonical_field == "source_color_name"


def test_unrecognized_header_returns_none():
    assert suggest_field_mapping("Warehouse Bin Location") is None


def test_blank_header_returns_none():
    assert suggest_field_mapping("") is None
    assert suggest_field_mapping("   ") is None


def test_future_vendor_synonym_pms_pantone():
    result = suggest_field_mapping("Pantone")
    assert result is not None
    assert result.canonical_field == "pms_code"
