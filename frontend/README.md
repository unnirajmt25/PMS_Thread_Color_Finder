# Thread Color Finder — Web App (React + Vite)

The live tool: pick a vendor's thread colour and get its matching PMS
value, or sample colours straight off an uploaded image and get the
closest matching threads.

Everything runs **in the browser**. There is no server: the dataset ships
as a static JSON asset, and admin edits are stored locally (see
[Data & storage](#data--storage)).

## Quick start

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | Oxlint over the source |

> The two data generators under `scripts/` are **not** wired to npm
> scripts — run them with `node` directly. See
> [Regenerating the dataset](#regenerating-the-dataset).

## Routes

`BrowserRouter` with no `basename`, and Vite has no `base` — the app is
served from the domain root.

| Path | Screen |
| --- | --- |
| `/` | `Landing` — marketing page, links into `/app` |
| `/app` | `Finder` — vendor → thread chart → thread, shows the PMS match |
| `/app/vendors` | `Vendors` — browse every vendor and its mappings |
| `/app/color-picker` | `ColorPicker` ("Color Explorer") — sample colours from an image |
| `/app/admin` | `Admin` — record CRUD, CSV import/export, vendor file uploads |
| anything else | redirect to `/` |

"Standard PMS" in the nav is not a route — it opens `StandardColorsModal`
over whatever page you're on.

## Source layout

```
src/
├── main.jsx                  React entry + top-level routes
├── App.jsx                   App shell, /app nav, Standard PMS modal
├── index.css                 Global theme + all app styles
├── pages/
│   ├── Landing.jsx           Marketing home (+ landing.css, landingIcons.jsx)
│   ├── Finder.jsx            Main vendor → thread → PMS lookup
│   ├── Vendors.jsx           Browse vendors and their mappings
│   ├── ColorPicker.jsx       Image upload, colour sampling, thread matching
│   └── Admin.jsx             CRUD, CSV, vendor file uploads (auth-gated)
├── components/               ColorMatchCard, ColorSwatch, DataTable,
│                             RecordForm, SearchResults, ThreadSearch,
│                             VendorFiles, VendorSelector, OptionSelector,
│                             StandardColorsModal, AdminLogin
├── services/
│   ├── colorService.js       The entire data layer (see below)
│   ├── standardColorsService.js  Read-only Standard Colours reference
│   ├── fileStore.js          IndexedDB blob store for uploaded files
│   ├── csv.js                CSV import/export
│   └── authService.js        Client-side admin gate (NOT real security)
├── utils/
│   ├── threadChartParser.js  Shared workbook/table → record parser
│   ├── pdfThreadParser.js    Reconstructs a table from a PDF text layer
│   ├── xlsxBuilder.js        Records → styled .xlsx (via exceljs)
│   ├── colorMatch.js         RGB distance + closest-thread ranking
│   ├── dominantColors.js     Dominant-colour extraction from an image
│   └── color.js, date.js, text.js, debounce.js
├── hooks/useColorData.js     Subscribes components to colorService
├── data/colorMappings.js     Small fallback seed if the JSON fetch fails
└── types/index.js            JSDoc typedef for ColorMapping
```

## Data & storage

`colorService.js` is the **only** module that knows where records live.
Every export returns a Promise and every mutation goes through the same
validate → persist → notify pipeline, so swapping in a real API later
shouldn't require touching components.

- **Pristine data** — `public/data/color-mappings.json` (~5.6 MB, 11,468
  records) is fetched once at startup.
- **Admin edits** — persisted to **IndexedDB**, not `localStorage`. The
  dataset is well past `localStorage`'s ~5 MB cap; a quota-exceeded write
  there used to fail silently and lose edits.
- **`SEED_VERSION`** — bump this constant whenever the shape or content of
  the shipped JSON changes, or browsers will keep serving a stale cached
  copy forever.
- **Uploaded vendor files** — stored as blobs in IndexedDB
  (`thred-finder-files`) and referenced by an `idb:` prefix on the
  record's `sourceFile`. Bundled charts instead resolve to a static
  `/thread-charts/<file>.xlsx` URL.

### Regenerating the dataset

Both generators read from the repo-root `Thread Chart/` folder and are
resolved relative to the script, so they work from any CWD:

```bash
node scripts/generate-thread-data.mjs      # → public/data/color-mappings.json
                                           #   + copies workbooks into public/thread-charts/
node scripts/generate-standard-colors.mjs  # → public/data/standard-colors.json
```

`generate-thread-data.mjs` picks up every `*.xlsx`; the Standard Colours
reference is a `.xls`, which is how it stays out of the vendor dataset.

## Notable behaviour

- **PDF uploads** — a vendor chart uploaded as PDF is parsed by
  reconstructing a table from the text layer's X/Y positions, then written
  back out as a real, style-matched `.xlsx` (using the vendor's existing
  chart as a template where one exists). Scanned/image-only PDFs correctly
  yield nothing rather than garbage.
- **`exceljs` vs `xlsx`** — both are dependencies on purpose. SheetJS's
  free build can *read* cell styles but not *write* them (it silently
  drops them), so anything that writes a styled workbook uses `exceljs`.
- **Colour matching** is straight-line RGB distance, not a perceptual
  Delta E — the dataset has no Lab values. Good enough for ranking, but
  don't treat it as colorimetric truth.

## Security caveat

`authService.js` gates the Admin page **in the browser only**, and the
credentials ship in the JS bundle in plain text. It keeps casual users
out; it is not access control. Anything genuinely sensitive needs the
backend (or a real auth provider) to validate server-side.
