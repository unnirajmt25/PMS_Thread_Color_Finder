"""IDY Thread Intelligence CLI (Typer + Rich).

Milestone 1 wires up: profile, profile-folder, health.
Later milestones add: import analyze/preview/commit/history, threads
search, thread show, color search — see section 28 of the spec.
"""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console

from ..infrastructure.parsers.report_writer import print_rich_summary, write_json, write_markdown
from ..infrastructure.parsers.workbook_profiler import build_profile_report, profile_workbook
from ..logging.setup import configure_logging

app = typer.Typer(help="IDY Thread Chart Management & Embroidery Color Intelligence Platform")
console = Console()


@app.callback()
def _init() -> None:
    configure_logging()


@app.command()
def profile(file: Path = typer.Argument(..., exists=True, help="A single .xlsx workbook to profile")) -> None:
    """Profile one workbook and print a Rich summary (no files written)."""
    wb = profile_workbook(file)
    report = build_profile_report([wb])
    print_rich_summary(report, console)


@app.command("profile-folder")
def profile_folder(
    folder: Path = typer.Argument(..., exists=True, file_okay=False, help="Folder of .xlsx files"),
    out_dir: Path = typer.Option(Path("reports"), help="Where to write JSON/Markdown reports"),
) -> None:
    """Profile every .xlsx in a folder and write reports/workbook_profile.{json,md}."""
    files = sorted(p for p in folder.glob("*.xlsx") if not p.name.startswith("~$"))
    if not files:
        console.print(f"[yellow]No .xlsx files found in {folder}[/yellow]")
        raise typer.Exit(1)

    workbooks = [profile_workbook(p) for p in files]
    report = build_profile_report(workbooks)

    out_dir.mkdir(parents=True, exist_ok=True)
    write_json(report, out_dir / "workbook_profile.json")
    write_markdown(report, out_dir / "workbook_profile.md")

    print_rich_summary(report, console)
    console.print(f"\nReports written to [bold]{out_dir}[/bold]")


@app.command()
def health() -> None:
    """Quick environment/DB connectivity check (see scripts/verify_environment.py for detail)."""
    import subprocess
    import sys

    script = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "verify_environment.py"
    raise typer.Exit(subprocess.call([sys.executable, str(script)]))


if __name__ == "__main__":
    app()
