#!/usr/bin/env python
"""Checks the local dev environment against the project's requirements and
verifies SQL Server connectivity — creating the target database if it
doesn't exist yet (an empty database only; NO tables/schema — see
docs/DATABASE.md, schema is not finalized until profiling is reviewed).

Usage:
    python scripts/verify_environment.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from rich.console import Console
from rich.table import Table

console = Console()

REQUIRED_PACKAGES = [
    "sqlalchemy", "pyodbc", "pydantic", "pydantic_settings", "fastapi",
    "alembic", "typer", "rich", "openpyxl", "dotenv",
]


def check_python_version() -> bool:
    major, minor = sys.version_info[:2]
    ok = (major, minor) >= (3, 12)
    status = "[green]OK[/green]" if ok else "[yellow]BELOW TARGET (3.12+)[/yellow]"
    console.print(f"Python version: {major}.{minor} — {status}")
    return ok


def check_packages() -> bool:
    import importlib

    table = Table(title="Required packages")
    table.add_column("Package")
    table.add_column("Status")
    all_ok = True
    for pkg in REQUIRED_PACKAGES:
        try:
            importlib.import_module(pkg)
            table.add_row(pkg, "[green]installed[/green]")
        except ImportError:
            table.add_row(pkg, "[red]MISSING[/red]")
            all_ok = False
    console.print(table)
    return all_ok


def check_sql_server() -> bool:
    try:
        import pyodbc
    except ImportError:
        console.print("[red]pyodbc not installed — cannot check SQL Server connectivity.[/red]")
        return False

    from idy_thread.config.settings import get_settings

    settings = get_settings()

    # Step 1: connect to `master` (always exists) to check server reachability
    # and whether our target database needs creating.
    try:
        master_conn = pyodbc.connect(_sqlalchemy_url_to_odbc(settings.master_database_url), timeout=5)
    except Exception as exc:  # noqa: BLE001 — reported to the user, not swallowed
        console.print(f"[red]Could not connect to SQL Server ({settings.sql_server_host}): {exc}[/red]")
        return False

    console.print(f"[green]Connected to SQL Server at {settings.sql_server_host}[/green]")
    master_conn.autocommit = True
    cursor = master_conn.cursor()
    cursor.execute("SELECT @@VERSION")
    version = cursor.fetchone()[0].splitlines()[0]
    console.print(f"  {version}")

    cursor.execute("SELECT database_id FROM sys.databases WHERE name = ?", settings.sql_server_database)
    exists = cursor.fetchone() is not None
    if exists:
        console.print(f"[green]Database '{settings.sql_server_database}' already exists.[/green]")
    else:
        console.print(f"[yellow]Database '{settings.sql_server_database}' does not exist — creating it "
                       f"(empty, no schema).[/yellow]")
        cursor.execute(f"CREATE DATABASE [{settings.sql_server_database}]")
        console.print(f"[green]Created database '{settings.sql_server_database}'.[/green]")
    cursor.close()
    master_conn.close()

    # Step 2: connect to the actual target database to prove end-to-end access.
    try:
        target_conn = pyodbc.connect(_sqlalchemy_url_to_odbc(settings.database_url), timeout=5)
        target_conn.close()
        console.print(f"[green]Verified connectivity to '{settings.sql_server_database}'.[/green]")
        return True
    except Exception as exc:  # noqa: BLE001
        console.print(f"[red]Connected to master but could not connect to "
                       f"'{settings.sql_server_database}': {exc}[/red]")
        return False


def _sqlalchemy_url_to_odbc(url: str) -> str:
    """Settings.database_url is a SQLAlchemy `mssql+pyodbc:///?odbc_connect=...`
    URL; pyodbc.connect() wants the raw ODBC string, so unwrap it."""
    from urllib.parse import parse_qs, unquote_plus, urlparse

    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    return unquote_plus(qs["odbc_connect"][0])


def main() -> int:
    console.print("[bold]IDY Thread Intelligence — environment verification[/bold]\n")
    py_ok = check_python_version()
    pkg_ok = check_packages()
    db_ok = check_sql_server()

    console.print()
    if py_ok and pkg_ok and db_ok:
        console.print("[bold green]All checks passed.[/bold green]")
        return 0
    if pkg_ok and db_ok and not py_ok:
        console.print("[bold yellow]Usable, but Python is below the 3.12+ target "
                       "(see docs/decisions/0001-python-version.md).[/bold yellow]")
        return 0
    console.print("[bold red]One or more checks failed — see above.[/bold red]")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
