"""Untrusted-file safety checks (section 36 of the project spec).

Used by the profiler now (reading local sample files) and by the import
pipeline later (reading actual uploads). Excel macros are never executed —
openpyxl's default reader does not evaluate VBA; we also never call
`openpyxl.load_workbook(..., keep_vba=True)`, which is what would expose
macro content.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

ALLOWED_EXTENSIONS = {".xlsx"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


class FileValidationError(Exception):
    """Raised when an input file fails a safety check. Callers must not
    silently skip this — see section 32: never swallow exceptions."""


def validate_file(path: Path, *, allowed_extensions: set = ALLOWED_EXTENSIONS,
                   max_size_bytes: int = MAX_FILE_SIZE_BYTES) -> None:
    if not path.is_file():
        raise FileValidationError(f"Not a file: {path}")

    if path.suffix.lower() not in allowed_extensions:
        raise FileValidationError(
            f"Unsupported extension '{path.suffix}' for {path.name} "
            f"(allowed: {sorted(allowed_extensions)})"
        )

    size = path.stat().st_size
    if size > max_size_bytes:
        raise FileValidationError(
            f"{path.name} is {size / 1e6:.1f} MB, exceeds the {max_size_bytes / 1e6:.0f} MB limit"
        )
    if size == 0:
        raise FileValidationError(f"{path.name} is empty")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_within(base_dir: Path, candidate: Path) -> Path:
    """Resolves `candidate` and raises if it escapes `base_dir` — path
    traversal protection for anything derived from a user-supplied name."""
    base_resolved = base_dir.resolve()
    target_resolved = (base_dir / candidate).resolve()
    if base_resolved not in target_resolved.parents and target_resolved != base_resolved:
        raise FileValidationError(f"Path escapes the allowed directory: {candidate}")
    return target_resolved
