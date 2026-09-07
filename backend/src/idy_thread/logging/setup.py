"""Structured logging setup.

Every log record can carry an `import_batch_id` (via `extra=`) once the
import pipeline exists (Milestone 5+), so operational questions like
"what happened during import batch 42" are answerable from logs alone.
Never log secrets — settings.py values that are credentials are never
passed to log calls.
"""

from __future__ import annotations

import logging

from rich.logging import RichHandler


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(rich_tracebacks=True, show_path=False)],
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
