"""Renders a ProfileReport as JSON, Markdown, and a Rich console summary."""

from __future__ import annotations

from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .profile_models import ProfileReport


def write_json(report: ProfileReport, path: Path) -> None:
    path.write_text(report.model_dump_json(indent=2), encoding="utf-8")


def write_markdown(report: ProfileReport, path: Path) -> None:
    lines: list = []
    lines.append("# IDY Thread Chart Profile Report")
    lines.append("")
    lines.append(f"Generated: {report.generated_at.isoformat()}")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Files analyzed: **{report.files_analyzed}**")
    lines.append(f"- Sheets analyzed: **{report.total_sheets}**")
    lines.append(f"- Data rows analyzed: **{report.total_rows}**")
    lines.append(f"- Total warnings: **{report.total_warnings}**")
    for severity, count in sorted(report.warnings_by_severity.items()):
        lines.append(f"  - {severity}: {count}")
    lines.append("")
    lines.append(f"## Discovered sources ({len(report.discovered_sources)})")
    lines.append("")
    for s in report.discovered_sources:
        lines.append(f"- {s}")
    lines.append("")
    lines.append(f"## Distinct headers seen across all files ({len(report.discovered_headers)})")
    lines.append("")
    for h in report.discovered_headers:
        lines.append(f"- `{h}`")
    lines.append("")
    if report.unknown:
        lines.append("## UNKNOWN / REQUIRES REVIEW")
        lines.append("")
        for u in report.unknown:
            lines.append(f"- {u}")
        lines.append("")

    lines.append("## Per-file detail")
    lines.append("")
    for wb in report.workbooks:
        lines.append(f"### {wb.file_name}")
        lines.append("")
        lines.append(f"- Likely source (filename-derived): **{wb.likely_source}**")
        lines.append(f"- Size: {wb.file_size_bytes / 1024:.1f} KB")
        lines.append(f"- SHA-256: `{wb.sha256}`")
        if wb.warnings:
            lines.append("- Workbook-level warnings:")
            for w in wb.warnings:
                lines.append(f"  - **{w.severity}** ({w.issue_type}): {w.message}")
        lines.append("")
        for sheet in wb.sheets:
            lines.append(f"#### Sheet: {sheet.name}")
            lines.append("")
            lines.append(f"- Rows: {sheet.row_count}, Columns: {sheet.column_count}, "
                          f"Header row: {sheet.header_row_number}")
            lines.append(f"- Headers: {', '.join(sheet.headers) if sheet.headers else '(none)'}")
            if sheet.duplicate_headers:
                lines.append(f"- Duplicate headers: {', '.join(sheet.duplicate_headers)}")
            lines.append(f"- Empty rows: {sheet.empty_row_count}, "
                          f"empty columns: {sheet.empty_column_count}, "
                          f"duplicate records: {sheet.duplicate_record_count}")
            if sheet.field_mappings:
                lines.append("- Suggested field mappings:")
                for m in sheet.field_mappings:
                    lines.append(
                        f"  - `{m.source_column}` → `{m.canonical_field}` "
                        f"({m.confidence}) — {m.evidence}"
                    )
            if sheet.warnings:
                lines.append("- Warnings:")
                for w in sheet.warnings:
                    lines.append(f"  - **{w.severity}** ({w.issue_type}): {w.message}")
            lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def print_rich_summary(report: ProfileReport, console: Console = None) -> None:
    console = console or Console()

    console.print(Panel.fit(
        f"[bold]Files analyzed:[/bold]       {report.files_analyzed}\n"
        f"[bold]Sheets analyzed:[/bold]      {report.total_sheets}\n"
        f"[bold]Data rows analyzed:[/bold]   {report.total_rows}\n"
        f"[bold]Total warnings:[/bold]       {report.total_warnings}",
        title="IDY THREAD CHART PROFILER",
        border_style="cyan",
    ))

    sources_table = Table(title=f"Discovered Sources ({len(report.discovered_sources)})")
    sources_table.add_column("Source (filename-derived)")
    for s in report.discovered_sources:
        sources_table.add_row(s)
    console.print(sources_table)

    headers_table = Table(title=f"Distinct Headers Seen ({len(report.discovered_headers)})")
    headers_table.add_column("Header")
    for h in report.discovered_headers:
        headers_table.add_row(h)
    console.print(headers_table)

    if report.warnings_by_severity:
        warn_table = Table(title="Warnings by Severity")
        warn_table.add_column("Severity")
        warn_table.add_column("Count", justify="right")
        for severity, count in sorted(report.warnings_by_severity.items()):
            style = {"ERROR": "red", "CRITICAL": "bold red", "WARNING": "yellow"}.get(severity, "")
            warn_table.add_row(severity, str(count), style=style)
        console.print(warn_table)

    if report.unknown:
        console.print(Panel("\n".join(f"• {u}" for u in report.unknown),
                             title="UNKNOWN / REQUIRES REVIEW", border_style="magenta"))

    console.print(Panel.fit("[bold green]ANALYSIS COMPLETE[/bold green]", border_style="green"))
