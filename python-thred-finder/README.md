# Thread Color Finder (Python CLI)

Reads the vendor "Thread Chart" Excel workbooks (`../Thread Chart/*.xlsx`
by default) and finds the PMS color that matches a thread by code, name,
vendor, or PMS number/name — the same lookup as the Thread Color Finder
web app, as a standalone command-line tool.

## Setup

```bash
cd python-thred-finder
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt      # or requirements-dev.txt to also get pytest
```

## Usage

Single lookup:

```bash
python -m thred_finder.cli 2257
python -m thred_finder.cli "rose cerise" --vendor "4imprint Thread Charts"
```

Batch mode — one query per line in a text file:

```bash
python -m thred_finder.cli --file queries.txt
```

Interactive mode — omit the query to get a prompt:

```bash
python -m thred_finder.cli
```

Other flags:

- `--vendor "<name>"` — restrict matches to one vendor.
- `--limit N` — cap matches shown per query (default 20).
- `--json` — print machine-readable JSON instead of plain text.
- `--data-dir <path>` — point at a different folder of workbooks.
- `--refresh` — ignore the on-disk cache and re-read the workbooks
  (use after the .xlsx files change).

## Running tests

```bash
pip install -r requirements-dev.txt
python -m pytest
```

## How it works

- `thred_finder/loader.py` parses every `*.xlsx` file in the data
  directory (one workbook per vendor, one sheet per thread brand) into
  flat records — thread code/name, PMS code/name, and a hex color derived
  from each row's R/G/B columns. Column lookup is header-driven, so it
  tolerates the vendor files having slightly different extra columns.
- `thred_finder/cache.py` caches the parsed records to
  `.thred_finder_cache.json` inside the data directory, keyed by each
  workbook's name/size/modified-time, so repeat runs skip the ~30-file
  parse unless something changed.
- `thred_finder/matcher.py` does a case-insensitive substring search
  across vendor, thread brand, thread code, thread color name, and PMS
  code/name, ranking exact thread-code matches first.

This mirrors `../scripts/generate-thread-data.mjs`, the Node script that
builds the same dataset for the React app — the two are independent
implementations over the same source files, not a shared dependency.
