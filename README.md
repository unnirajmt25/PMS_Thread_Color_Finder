# Thread Color Finder / IDY Thread Intelligence

This repository holds two related projects, kept in **separate top-level
folders** so each has its own dependencies, its own lifecycle, and can be
worked on independently:

```
.
├── frontend/    React + Vite web app (the live "Thread Color Finder" tool),
│                plus python-thred-finder/, a small standalone Python CLI
│                that does the same PMS lookup from the command line.
│
├── backend/     IDY Thread Chart Management & Embroidery Color Intelligence
│                Platform — the Python + Microsoft SQL Server backend
│                (data profiling, and eventually the import pipeline,
│                canonical database, and API). See backend/README.md.
│
└── Thread Chart/  Shared raw input data: the 30 vendor thread-chart Excel
                    workbooks. Read by frontend/scripts/generate-thread-data.mjs,
                    frontend/python-thred-finder/, AND backend/scripts/profile_workbooks.py
                    — this is why it lives at the repo root rather than inside
                    either subproject.
```

## Which one do I want?

- **Using or developing the web app right now?** → `frontend/` —
  `cd frontend && npm install && npm run dev`.
- **Working on the new SQL Server-backed platform (data profiling, import
  pipeline, canonical schema)?** → `backend/` — see `backend/README.md`.

## Why they're separate

`frontend/` and `backend/` have independent dependency trees (npm vs.
pip), independent test suites, and are at very different maturity levels
(`frontend/` is a working production tool; `backend/` is Phase 1,
Milestone 1 — data discovery only, no schema yet). Keeping them as
sibling folders means neither's tooling (node_modules/, .venv/, lint
configs) leaks into the other, while `Thread Chart/` stays a single
shared source of truth both can read from without either one owning it.
