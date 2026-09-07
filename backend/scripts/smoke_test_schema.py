#!/usr/bin/env python
"""One-off verification (not a pytest suite) that the new schema behaves as
designed end-to-end:

1. Manufacturer alias lookup resolves "Robison Anton" / "Robinson Anton" /
   "RA" to the same Manufacturer (the vendor-matching mechanism the schema
   was built to support).
2. A Source -> Brand -> ProductLine -> Thread -> Color chain inserts and
   reads back correctly.
3. A CHECK constraint (RGB range) actually rejects bad data.

Everything inserted here is deleted at the end, so this is safe to re-run
against the real dev database without leaving test rows behind.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from rich.console import Console
from sqlalchemy.exc import IntegrityError

from idy_thread.db.base import get_session_factory
from idy_thread.db.models import (
    Brand,
    Color,
    ManufacturerAlias,
    ProductLine,
    Source,
    Thread,
)
from idy_thread.domain.normalization import normalize_name

console = Console()


def main() -> int:
    session_factory = get_session_factory()
    with session_factory() as session:
        # 1. Alias resolution for the three real spelling variants found in
        # the profiled workbooks.
        for variant in ("RA", "Robison Anton", "Robinson Anton"):
            alias = (
                session.query(ManufacturerAlias)
                .filter_by(NormalizedAlias=normalize_name(variant))
                .one()
            )
            console.print(f"[green]OK[/green] {variant!r} -> ManufacturerId={alias.ManufacturerId}")
        manufacturer_ids = {
            session.query(ManufacturerAlias).filter_by(NormalizedAlias=normalize_name(v)).one().ManufacturerId
            for v in ("RA", "Robison Anton", "Robinson Anton")
        }
        assert len(manufacturer_ids) == 1, "all three variants must resolve to ONE manufacturer"
        console.print("[bold green]OK[/bold green] all three variants resolve to the same Manufacturer\n")

        # 2. Full chain insert + read-back.
        source = Source(
            SourceCode="SMOKE_TEST_VENDOR",
            Name="Smoke Test Thread Charts",
            NormalizedName=normalize_name("Smoke Test Thread Charts"),
        )
        manufacturer_id = manufacturer_ids.pop()
        brand = Brand(ManufacturerId=manufacturer_id, Name="Robison-Anton", NormalizedName="robison-anton")
        session.add(brand)
        session.flush()
        product_line = ProductLine(BrandId=brand.BrandId, Name="SS Rayon", NormalizedName="ss rayon")
        session.add(product_line)
        session.flush()
        thread = Thread(ProductLineId=product_line.ProductLineId, CanonicalName="Smoke Test Peach")
        session.add(thread)
        session.flush()
        color = Color(ThreadId=thread.ThreadId, Red=255, Green=200, Blue=150, HexCode="#FFC896")
        session.add(source)
        session.add(color)
        session.commit()

        read_back = session.query(Thread).filter_by(ThreadId=thread.ThreadId).one()
        console.print(
            f"[green]OK[/green] read back Thread {read_back.CanonicalName!r} "
            f"via ProductLine={read_back.ProductLine.Name!r} "
            f"Brand={read_back.ProductLine.Brand.Name!r} "
            f"Color={read_back.Colors[0].HexCode}"
        )

        # 3. CHECK constraint actually rejects bad data (malformed hex —
        # RGB range has no CHECK since TINYINT already enforces 0-255).
        bad_color = Color(ThreadId=thread.ThreadId, Red=10, Green=20, Blue=30, HexCode="NOTAHEX")
        session.add(bad_color)
        try:
            session.commit()
            console.print("[bold red]FAIL[/bold red] CHECK constraint did not reject malformed HexCode")
            return 1
        except IntegrityError:
            session.rollback()
            console.print("[green]OK[/green] CHECK constraint correctly rejected malformed HexCode\n")

        # Clean up everything this script inserted.
        session.delete(source)
        session.delete(thread)  # cascades to Color
        session.delete(product_line)
        session.delete(brand)
        session.commit()
        console.print("[bold green]All checks passed; smoke-test rows cleaned up.[/bold green]")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
