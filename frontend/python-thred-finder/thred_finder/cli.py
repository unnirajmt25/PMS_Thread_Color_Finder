"""CLI: look up the PMS color that matches a thread by code, name, or
vendor. Supports a single query, batch lookups from a text file, and an
interactive prompt when no query is given.

Examples:
    python -m thred_finder.cli 2257
    python -m thred_finder.cli "rose cerise" --vendor "4imprint Thread Charts"
    python -m thred_finder.cli --file queries.txt --json
    python -m thred_finder.cli
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .cache import load_records_cached
from .loader import Record
from .matcher import search

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "Thread Chart"


def _format_match(record: Record) -> str:
    pms = record.pms_name or (f"PMS {record.pms_code}" if record.pms_code else "No PMS match on file")
    color_name = f" - {record.thread_color_name}" if record.thread_color_name else ""
    return (
        f"  Vendor:  {record.vendor}\n"
        f"  Thread:  {record.thread_brand} {record.thread_code}{color_name}\n"
        f"  PMS:     {pms}\n"
        f"  Monitor Display Color: {record.pms_hex or record.thread_hex or 'n/a'}\n"
    )


def _run_query(records: list[Record], query: str, *, vendor: str | None, limit: int) -> list[Record]:
    return search(records, query, vendor=vendor, limit=limit)


def _print_results(query: str, results: list[Record], *, as_json: bool) -> None:
    if as_json:
        print(json.dumps({"query": query, "matches": [r.as_dict() for r in results]}, indent=2))
        return

    if not results:
        print(f'No matches for "{query}".')
        return

    print(f'{len(results)} match(es) for "{query}":')
    for record in results:
        print(_format_match(record))


def _batch(records: list[Record], path: Path, *, vendor: str | None, limit: int, as_json: bool) -> None:
    queries = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if as_json:
        report = []
        for query in queries:
            results = _run_query(records, query, vendor=vendor, limit=limit)
            report.append({"query": query, "matches": [r.as_dict() for r in results]})
        print(json.dumps(report, indent=2))
        return

    for query in queries:
        results = _run_query(records, query, vendor=vendor, limit=limit)
        _print_results(query, results, as_json=False)
        print()


def _interactive(records: list[Record], *, vendor: str | None, limit: int, as_json: bool) -> None:
    print(f"Loaded {len(records)} thread/PMS records. Enter a thread code, name, or PMS to search.")
    print("Leave blank (or Ctrl+D) to quit.\n")
    while True:
        try:
            query = input("> ").strip()
        except EOFError:
            print()
            break
        if not query:
            break
        results = _run_query(records, query, vendor=vendor, limit=limit)
        _print_results(query, results, as_json=as_json)
        print()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Find the PMS color that matches a thread.")
    parser.add_argument("query", nargs="?", help="Thread code, thread name, vendor, or PMS to search for.")
    parser.add_argument("-f", "--file", type=Path, help="Text file with one query per line (batch mode).")
    parser.add_argument("--vendor", help='Restrict results to one vendor, e.g. "4imprint Thread Charts".')
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR, help="Folder containing the vendor .xlsx workbooks.")
    parser.add_argument("--limit", type=int, default=20, help="Max matches to show per query (default: 20).")
    parser.add_argument("--json", action="store_true", help="Print results as JSON instead of plain text.")
    parser.add_argument("--refresh", action="store_true", help="Bypass the on-disk cache and re-read the workbooks.")
    return parser


def main(argv: list[str] | None = None) -> int:
    # Vendor/thread names can contain non-ASCII characters; make sure
    # they print cleanly regardless of the terminal's default codepage.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    args = build_parser().parse_args(argv)

    if not args.data_dir.is_dir():
        print(f"Data directory not found: {args.data_dir}", file=sys.stderr)
        return 1

    records = load_records_cached(args.data_dir, refresh=args.refresh)

    if args.file:
        if not args.file.is_file():
            print(f"Query file not found: {args.file}", file=sys.stderr)
            return 1
        _batch(records, args.file, vendor=args.vendor, limit=args.limit, as_json=args.json)
    elif args.query:
        results = _run_query(records, args.query, vendor=args.vendor, limit=args.limit)
        _print_results(args.query, results, as_json=args.json)
    else:
        _interactive(records, vendor=args.vendor, limit=args.limit, as_json=args.json)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
