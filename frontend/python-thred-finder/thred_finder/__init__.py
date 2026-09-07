"""Thred Finder: look up the PMS color that matches a thread from the
vendor "Thread Chart" workbooks."""

from .loader import Record, load_records
from .matcher import search

__all__ = ["Record", "load_records", "search"]
