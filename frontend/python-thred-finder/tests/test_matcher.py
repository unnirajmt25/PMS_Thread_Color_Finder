import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from thred_finder.loader import Record
from thred_finder.matcher import search

RECORDS = [
    Record(
        vendor="4imprint Thread Charts",
        thread_brand="Robison Anton SS Rayon",
        thread_code="2257",
        thread_color_name="Peach",
        thread_hex="#ffbe9d",
        pms_code="162",
        pms_name="PMS 162 C",
        pms_hex="#ffbe9d",
        updated_at="2026-08-13",
    ),
    Record(
        vendor="4imprint Thread Charts",
        thread_brand="Robison Anton SS Rayon",
        thread_code="2244",
        thread_color_name="Rose Cerise",
        thread_hex="#ed8497",
        pms_code="701",
        pms_name="PMS 701 C",
        pms_hex="#ed8497",
        updated_at="2026-08-13",
    ),
    Record(
        vendor="Ahead Thread Charts",
        thread_brand="Madeira Polyneon",
        thread_code="1749",
        thread_color_name="",
        thread_hex="#02ab4e",
        pms_code="2257",
        pms_name="PMS 2257 C",
        pms_hex="#02ab4e",
        updated_at="2026-08-13",
    ),
]


def test_search_by_thread_code_ranks_exact_match_first():
    results = search(RECORDS, "2257")
    assert results[0].thread_code == "2257"
    assert results[0].pms_code == "162"
    assert len(results) == 2  # also matches the PMS-2257 record


def test_search_by_thread_color_name():
    results = search(RECORDS, "rose cerise")
    assert len(results) == 1
    assert results[0].pms_code == "701"


def test_search_by_pms_code():
    results = search(RECORDS, "701")
    assert len(results) == 1
    assert results[0].thread_code == "2244"


def test_search_scoped_to_vendor():
    results = search(RECORDS, "2257", vendor="Ahead Thread Charts")
    assert len(results) == 1
    assert results[0].vendor == "Ahead Thread Charts"


def test_search_no_match():
    assert search(RECORDS, "not a real thread") == []


def test_search_limit():
    results = search(RECORDS, "", limit=1)
    assert len(results) == 1
