#!/usr/bin/env python
"""Profiles every .xlsx in a folder and writes reports/workbook_profile.{json,md}.

Usage:
    python scripts/profile_workbooks.py [folder] [--out-dir reports]

Defaults to profiling ../Thread Chart (the sample vendor workbooks used by
the existing React app) and writing into ./reports.

This script is READ-ONLY: it never modifies the source workbooks and never
touches a database. See docs/IMPORT_PIPELINE.md for how this feeds into
the (not-yet-built) actual import pipeline.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from rich.console import Console
from rich.progress import Progress

from idy_thread.infrastructure.parsers.report_writer import print_rich_summary, write_json, write_markdown
from idy_thread.infrastructure.parsers.workbook_profiler import build_profile_report, profile_workbook
from idy_thread.security.file_validation import FileValidationError

DEFAULT_FOLDER = Path(__file__).resolve().parent.parent.parent / "Thread Chart"
DEFAULT_OUT_DIR = Path(__file__).resolve().parent.parent / "reports"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", nargs="?", default=str(DEFAULT_FOLDER),
                         help=f"Folder of .xlsx files to profile (default: {DEFAULT_FOLDER})")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR),
                         help=f"Where to write reports (default: {DEFAULT_OUT_DIR})")
    args = parser.parse_args()

    console = Console()
    folder = Path(args.folder)
    out_dir = Path(args.out_dir)

    if not folder.is_dir():
        console.print(f"[red]Not a directory: {folder}[/red]")
        return 1

    files = sorted(p for p in folder.glob("*.xlsx") if not p.name.startswith("~$"))
    if not files:
        console.print(f"[yellow]No .xlsx files found in {folder}[/yellow]")
        return 1

    console.print(f"Profiling {len(files)} workbook(s) from [bold]{folder}[/bold] ...\n")

    workbooks = []
    failures = []
    with Progress() as progress:
        task = progress.add_task("Profiling...", total=len(files))
        for path in files:
            try:
                workbooks.append(profile_workbook(path))
            except FileValidationError as exc:
                failures.append((path.name, str(exc)))
            progress.advance(task)

    if failures:
        console.print("\n[red]Files that failed validation and were skipped:[/red]")
        for name, reason in failures:
            console.print(f"  • {name}: {reason}")

    report = build_profile_report(workbooks)

    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "workbook_profile.json"
    md_path = out_dir / "workbook_profile.md"
    write_json(report, json_path)
    write_markdown(report, md_path)

    console.print()
    print_rich_summary(report, console)
    console.print(f"\nJSON report:     [bold]{json_path}[/bold]")
    console.print(f"Markdown report: [bold]{md_path}[/bold]")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
