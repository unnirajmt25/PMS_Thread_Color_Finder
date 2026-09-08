# Thread Color Finder / IDY Thread Intelligence

Find the matching **PMS colour** for any vendor's embroidery thread — and
work the other way too: upload an image, sample colours from it, and get
the closest matching threads.

This repository holds two related projects, kept in **separate top-level
folders** so each has its own dependencies, its own lifecycle, and can be
worked on independently:

```
.
├── frontend/    React + Vite web app — the live "Thread Color Finder" tool.
│                Also contains python-thred-finder/, a small standalone
│                Python CLI that does the same PMS lookup from a terminal.
│
├── backend/     IDY Thread Chart Management & Embroidery Color Intelligence
│                Platform — the Python + Microsoft SQL Server backend
│                (canonical schema, provenance-tracked imports, profiling).
│                See backend/README.md.
│
└── Thread Chart/  Shared raw input data: the vendor thread-chart Excel
                   workbooks. Read by frontend/scripts/generate-thread-data.mjs,
                   frontend/python-thred-finder/, AND
                   backend/scripts/profile_workbooks.py — this is why it lives
                   at the repo root rather than inside either subproject.
```

## Which one do I want?

- **Using or developing the web app?** → `frontend/` —
  `cd frontend && npm install && npm run dev`, then open the printed URL.
  Full docs in [`frontend/README.md`](frontend/README.md).
- **Working on the SQL Server platform** (schema, import pipeline, data
  profiling)? → `backend/` — see [`backend/README.md`](backend/README.md)
  and [`backend/docs/`](backend/docs/).

## Project status

| | Status |
| --- | --- |
| `frontend/` | **Working production tool.** Runs entirely in the browser — the dataset ships as a static JSON asset generated from the Excel charts. |
| `backend/` | **Milestone 3.** The canonical schema is implemented and live (Alembic migration `cc95e56d8f01`, 14 tables) and master data is seeded. There is **no API yet** — `api/` and `application/` are still empty placeholders. |

> Note: `backend/README.md` still describes itself as "Milestone 1 — no
> schema yet". That line is out of date; `backend/docs/DATABASE.md` and the
> migration reflect the real state.

The frontend does **not** talk to the backend. It is currently its own
system of record, reading a generated JSON file and keeping any admin
edits in the browser. Connecting the two is future work — the frontend's
data layer (`src/services/colorService.js`) is deliberately shaped so that
swapping in a real API shouldn't require touching UI components.

## The data

`Thread Chart/` holds one Excel workbook per **distributor** (4imprint,
Gemline, Koozie, …). Each worksheet inside is a thread **manufacturer's
product line** — "Robison Anton SS Rayon", "Madeira Polyneon",
"Isacord 40". So a distributor resells several manufacturers' thread.

The frontend flattens that into a single `vendor` field for simplicity.
The backend deliberately does not — modelling Source → Manufacturer →
Brand → ProductLine → Thread → Color separately is much of the reason it
exists. See `backend/docs/ARCHITECTURE.md`.

Current generated dataset: **11,468 records across 27 vendors** and 14
distinct thread charts, plus a separate 142-entry standard-colour
reference list.

To regenerate after changing the workbooks:

```bash
cd frontend
node scripts/generate-thread-data.mjs      # -> public/data/color-mappings.json
node scripts/generate-standard-colors.mjs  # -> public/data/standard-colors.json
```

Then bump `SEED_VERSION` in `src/services/colorService.js` so browsers
discard their cached copy, and rebuild.

## Why the two projects are separate

`frontend/` and `backend/` have independent dependency trees (npm vs.
pip), independent test suites, and are at very different maturity levels.
Keeping them as sibling folders means neither's tooling (`node_modules/`,
`.venv/`, lint configs) leaks into the other, while `Thread Chart/` stays
a single shared source of truth that both can read without either one
owning it.

## Security note

The Admin page is gated **client-side only**, and the credentials are
hardcoded in `frontend/src/services/authService.js` — they ship in the JS
bundle in plain text. This keeps casual users out of the admin screens; it
is **not** access control, and it should not be treated as protecting
anything sensitive. Proper auth needs the backend (or an auth provider)
validating server-side.
