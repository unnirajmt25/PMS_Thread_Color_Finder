#!/usr/bin/env python
"""Seeds Manufacturer + ManufacturerAlias master data.

The alias list below comes directly from profiling all 30 real vendor
workbooks (reports/workbook_profile.json): the same manufacturer appears
under a plain abbreviation ("RA"), its full name ("Robison Anton"), and a
genuine misspelling ("Robinson Anton") across different sheets. Recording
every known variant here — rather than guessing at match time — is what
lets a future re-imported chart resolve to the *same* Manufacturer instead
of creating a duplicate.

Idempotent: safe to re-run. New variants discovered later are added as new
rows, never by editing this script's history.

Usage:
    python scripts/seed_manufacturers.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from rich.console import Console

from idy_thread.db.base import get_session_factory
from idy_thread.db.models import Manufacturer, ManufacturerAlias
from idy_thread.domain.normalization import normalize_name

console = Console()

# (canonical display name, [known aliases/abbreviations/misspellings])
# Canonical names themselves are also registered as aliases, so a lookup
# never has to special-case "is this the canonical name or a variant?".
MANUFACTURER_SEED: list[tuple[str, list[str]]] = [
    ("Robison-Anton", ["Robison-Anton", "Robison Anton", "Robinson Anton", "RA"]),
    ("Madeira", ["Madeira"]),
    ("Gunold", ["Gunold"]),
    ("Isacord", ["Isacord"]),
    ("Marathon", ["Marathon"]),
    ("Otto", ["Otto"]),
]


def seed() -> None:
    session_factory = get_session_factory()
    with session_factory() as session:
        for canonical_name, aliases in MANUFACTURER_SEED:
            normalized = normalize_name(canonical_name)
            manufacturer = (
                session.query(Manufacturer).filter_by(NormalizedName=normalized).one_or_none()
            )
            if manufacturer is None:
                manufacturer = Manufacturer(Name=canonical_name, NormalizedName=normalized)
                session.add(manufacturer)
                session.flush()
                console.print(f"[green]Created Manufacturer[/green] {canonical_name!r}")
            else:
                console.print(f"[dim]Manufacturer already exists[/dim] {canonical_name!r}")

            for alias in aliases:
                normalized_alias = normalize_name(alias)
                existing = (
                    session.query(ManufacturerAlias)
                    .filter_by(NormalizedAlias=normalized_alias)
                    .one_or_none()
                )
                if existing is None:
                    session.add(
                        ManufacturerAlias(
                            ManufacturerId=manufacturer.ManufacturerId,
                            Alias=alias,
                            NormalizedAlias=normalized_alias,
                        )
                    )
                    console.print(f"  [green]+ alias[/green] {alias!r}")
                elif existing.ManufacturerId != manufacturer.ManufacturerId:
                    console.print(
                        f"  [red]! alias {alias!r} already points at a different manufacturer "
                        f"(ManufacturerId={existing.ManufacturerId}) — skipped, needs review[/red]"
                    )
                else:
                    console.print(f"  [dim]alias already exists[/dim] {alias!r}")

        session.commit()


if __name__ == "__main__":
    seed()
    console.print("[bold green]Done.[/bold green]")
