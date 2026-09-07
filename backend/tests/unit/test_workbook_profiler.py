"""Unit tests for the pure profiling logic (`profile_rows`), covering the
"future problem" scenarios from spec section 35 — reordered/extra/missing
columns, duplicate headers, invalid data, unicode, and header rows that
AREN'T row 1 — using in-memory row arrays so no .xlsx fixtures are needed
for this layer. `profile_workbook`'s file-I/O wrapper is exercised
separately against the real sample files in scripts/profile_workbooks.py.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from idy_thread.infrastructure.parsers.workbook_profiler import derive_likely_source, profile_rows

NORMAL_HEADERS = ["Thread Name", "Thread Number", "PMS Number", "R", "G", "B"]


def _rows(headers, data):
    return [headers, *data]


def test_normal_case_maps_all_columns_high_confidence():
    profile = profile_rows("Sheet1", _rows(NORMAL_HEADERS, [["Red", "1234", "185", "200", "30", "40"]]))
    assert profile.row_count == 1
    assert profile.column_count == 6
    assert profile.header_row_number == 1
    mapped_fields = {m.canonical_field: m.confidence for m in profile.field_mappings}
    assert mapped_fields["source_thread_code"] == "HIGH"
    assert mapped_fields["pms_code"] == "HIGH"
    assert mapped_fields["red"] == "HIGH"
    assert not profile.warnings


def test_different_header_spellings_still_map():
    headers = ["Colour Name", "Article Number", "Pantone", "Red", "Green", "Blue"]
    profile = profile_rows("Sheet1", _rows(headers, [["Blue Thread", "999", "286", "0", "50", "150"]]))
    mapped_fields = {m.canonical_field for m in profile.field_mappings}
    assert "source_color_name" in mapped_fields
    assert "source_thread_code" in mapped_fields
    assert "pms_code" in mapped_fields


def test_reordered_columns_still_map_correctly_by_name_not_position():
    # Same fields as NORMAL_HEADERS, deliberately reordered.
    headers = ["PMS Number", "B", "Thread Number", "R", "Thread Name", "G"]
    profile = profile_rows("Sheet1", _rows(headers, [["185", "40", "1234", "200", "Red", "30"]]))
    by_field = {m.canonical_field: m.source_column for m in profile.field_mappings}
    assert by_field["pms_code"] == "PMS Number"
    assert by_field["source_thread_code"] == "Thread Number"
    assert by_field["red"] == "R"


def test_extra_unrecognized_column_does_not_break_profiling():
    headers = [*NORMAL_HEADERS, "Warehouse Bin"]
    profile = profile_rows("Sheet1", _rows(headers, [["Red", "1234", "185", "200", "30", "40", "A-12"]]))
    assert profile.column_count == 7
    mapped_source_columns = {m.source_column for m in profile.field_mappings}
    assert "Warehouse Bin" not in mapped_source_columns


def test_missing_columns_does_not_crash_and_maps_what_exists():
    headers = ["Thread Number", "PMS Number"]  # no name/RGB at all
    profile = profile_rows("Sheet1", _rows(headers, [["1234", "185"]]))
    mapped_fields = {m.canonical_field for m in profile.field_mappings}
    assert mapped_fields == {"source_thread_code", "pms_code"}


def test_duplicate_headers_are_flagged():
    headers = ["Thread Number", "Thread Number", "PMS Number"]
    profile = profile_rows("Sheet1", _rows(headers, [["1234", "1235", "185"]]))
    assert profile.duplicate_headers == ["Thread Number"]
    assert any(w.issue_type == "duplicate_headers" for w in profile.warnings)


def test_empty_rows_are_counted_not_treated_as_data():
    data = [["Red", "1234", "185", "200", "30", "40"], ["", "", "", "", "", ""], [None, None, None, None, None, None]]
    profile = profile_rows("Sheet1", _rows(NORMAL_HEADERS, data))
    assert profile.row_count == 3
    assert profile.empty_row_count == 2


def test_invalid_rgb_values_flagged_as_error():
    data = [
        ["Red", "1234", "185", "999", "-5", "abc"],  # all three RGB values bad
    ]
    profile = profile_rows("Sheet1", _rows(NORMAL_HEADERS, data))
    rgb_warning = next((w for w in profile.warnings if w.issue_type == "invalid_rgb_values"), None)
    assert rgb_warning is not None
    assert rgb_warning.severity == "ERROR"
    assert "3" in rgb_warning.message


def test_duplicate_records_detected():
    data = [
        ["Red", "1234", "185", "200", "30", "40"],
        ["Red", "1234", "185", "200", "30", "40"],  # exact duplicate
        ["Blue", "5678", "286", "0", "50", "150"],
    ]
    profile = profile_rows("Sheet1", _rows(NORMAL_HEADERS, data))
    assert profile.duplicate_record_count == 1
    assert any(w.issue_type == "duplicate_records" for w in profile.warnings)


def test_unicode_values_do_not_crash():
    data = [["Café Noir — 咖啡", "1234", "185", "200", "30", "40"]]
    profile = profile_rows("Sheet1", _rows(NORMAL_HEADERS, data))
    assert profile.columns[0].sample_values == ["Café Noir — 咖啡"]


def test_header_row_not_on_row_one_is_still_detected():
    # A title row, then a blank-ish row, THEN the real header — this is
    # what future non-conforming files may look like, and the point of
    # detecting the header row instead of hard-coding row 1.
    rows = [
        ["Embroidery Thread Chart — Confidential", "", "", "", "", ""],
        NORMAL_HEADERS,
        ["Red", "1234", "185", "200", "30", "40"],
    ]
    profile = profile_rows("Sheet1", rows)
    assert profile.header_row_number == 2
    assert profile.headers == NORMAL_HEADERS
    assert profile.row_count == 1


def test_unlabeled_column_with_data_is_flagged():
    headers = ["Thread Number", "", "PMS Number"]
    data = [["1234", "mystery value", "185"]]
    profile = profile_rows("Sheet1", _rows(headers, data))
    assert any(w.issue_type == "unlabeled_column_with_data" for w in profile.warnings)


def test_empty_sheet_returns_none():
    assert profile_rows("Sheet1", []) is None


def test_derive_likely_source_strips_thread_charts_suffix():
    assert derive_likely_source("4imprint Thread Charts") == "4imprint"
    assert derive_likely_source("Alphabroder - Canada Thread Charts") == "Alphabroder - Canada"


def test_derive_likely_source_unknown_pattern_falls_back_to_stem():
    # A future vendor whose filename doesn't follow the "X Thread Charts"
    # convention at all — must not crash, must not guess wildly.
    assert derive_likely_source("vendor_export_2027_Q1") == "vendor_export_2027_Q1"
