import * as XLSX from "xlsx";
import { fallbackSeed } from "../data/colorMappings";
import { generateId } from "../utils/color";
import { parseWorkbookToRecords } from "../utils/threadChartParser";
import { parsePdfToRecords } from "../utils/pdfThreadParser";
import { buildVendorWorkbook } from "../utils/xlsxBuilder";
import { csvToRecords, recordsToCsv } from "./csv";
import { ADMIN_USERNAME } from "./authService";
import { putFile, getFile, deleteFile } from "./fileStore";

// Bundled vendor charts (from Thread Chart/, copied to public/thread-charts/
// by scripts/generate-thread-data.mjs) are downloadable via a plain static
// URL. Files behind an Admin upload have no such URL - they're stored as
// Blobs in IndexedDB (see fileStore.js) instead, keyed by vendor label and
// referenced by this marker so the UI knows which resolution path to use.
const UPLOADED_SOURCE_PREFIX = "idb:";

export function getStaticChartFileUrl(fileName) {
  return `${import.meta.env.BASE_URL}thread-charts/${encodeURIComponent(fileName)}`;
}

export function isUploadedSource(sourceFile) {
  return typeof sourceFile === "string" && sourceFile.startsWith(UPLOADED_SOURCE_PREFIX);
}

function uploadedSourceMarker(label) {
  return `${UPLOADED_SOURCE_PREFIX}${label}`;
}

function uploadedSourceLabel(sourceFile) {
  return isUploadedSource(sourceFile) ? sourceFile.slice(UPLOADED_SOURCE_PREFIX.length) : null;
}

/** Resolves an uploaded/generated vendor file's Blob for download, or null if it's gone. */
export async function getUploadedFileBlob(sourceFile) {
  const label = uploadedSourceLabel(sourceFile);
  if (!label) return null;
  return getFile(label);
}

/**
 * Data-access layer for the color-mapping database.
 *
 * This is the ONLY module that knows where records actually live. Today
 * that means: the real dataset ships as a static JSON asset
 * (`public/data/color-mappings.json`, generated from the vendor thread
 * charts by `scripts/generate-thread-data.mjs`) fetched once at startup,
 * with any admin edits persisted as an overlay in IndexedDB (see
 * fileStore.js — the full dataset is 5MB+, well past what localStorage
 * can reliably hold; a `setItem` that silently exceeds quota used to fail
 * every save with no visible error at all). Every export here returns a
 * Promise and every mutation goes through the same validate -> persist ->
 * notify pipeline, so swapping this file's internals for `fetch()` calls
 * against a REST API, Supabase, Firebase, or Postgres would not require
 * any change to components, pages, or hooks.
 */

const RECORDS_CACHE_KEY = "__records_cache__";
const DATA_URL = `${import.meta.env.BASE_URL}data/color-mappings.json`;
const SIMULATED_LATENCY_MS = 150;

// Bump this whenever the shape or source of the pristine dataset changes
// (e.g. the vendor thread charts were regenerated). Any cache written
// under an older version is treated as stale and discarded in favor of a
// fresh fetch — otherwise a browser that cached data before a change
// (e.g. back when only the small bundled sample existed) would keep
// serving that stale snapshot forever, since admin edits are
// intentionally allowed to persist across reloads.
const SEED_VERSION = 5;

const listeners = new Set();

function delay(ms = SIMULATED_LATENCY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStore() {
  try {
    const stored = await getFile(RECORDS_CACHE_KEY);
    if (!stored || stored.version !== SEED_VERSION || !Array.isArray(stored.records)) return null;
    return stored.records;
  } catch {
    return null;
  }
}

// Deliberately does NOT swallow failures - a caller that doesn't notice a
// save didn't happen will confidently tell the admin it did.
async function writeStore(records) {
  await putFile(RECORDS_CACHE_KEY, { version: SEED_VERSION, records });
}

// Registry of vendor spreadsheets uploaded through Admin's "Upload Vendor
// File" flow — { label, fileName, uploadedAt, recordCount }[]. This is
// separate from the color-mapping records themselves: it exists purely so
// the Admin UI can show which files have been uploaded and when, keyed by
// the vendor label the admin assigned rather than the raw filename.
const VENDOR_FILES_KEY = "thred-finder-vendor-files-v1";

function readVendorFiles() {
  try {
    const raw = window.localStorage.getItem(VENDOR_FILES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVendorFiles(files) {
  try {
    window.localStorage.setItem(VENDOR_FILES_KEY, JSON.stringify(files));
  } catch (err) {
    console.warn("Could not persist vendor file registry to localStorage:", err);
  }
}

let vendorFiles = readVendorFiles();

function upsertVendorFileEntry(entry) {
  vendorFiles = [...vendorFiles.filter((f) => f.label !== entry.label), entry].sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  writeVendorFiles(vendorFiles);
}

function removeVendorFileEntry(label) {
  if (!vendorFiles.some((f) => f.label === label)) return;
  vendorFiles = vendorFiles.filter((f) => f.label !== label);
  writeVendorFiles(vendorFiles);
}

async function fetchPristineData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${DATA_URL}`);
  return res.json();
}

let cache = [];

// Any admin edits made previously are persisted and take over as the
// working copy. Until then, every load re-fetches the JSON asset fresh, so
// regenerating that file (updated vendor charts) is picked up automatically
// without touching any application code.
const initPromise = (async () => {
  const existing = await readStore();
  if (existing) {
    cache = existing;
    return;
  }
  try {
    cache = await fetchPristineData();
  } catch (err) {
    console.warn("Falling back to bundled sample data:", err);
    cache = fallbackSeed;
  }
})();

async function ready(ms) {
  await initPromise;
  await delay(ms);
}

function notify() {
  for (const listener of listeners) listener(cache);
}

// Writes durably BEFORE updating the in-memory cache/notifying subscribers,
// so a failed save throws (surfacing as a normal error to whichever Admin
// action triggered it) instead of the UI optimistically showing a change
// that didn't actually stick.
async function persist(next) {
  await writeStore(next);
  cache = next;
  notify();
}

/**
 * Subscribes to database changes (mutations from this tab, or CSV
 * import/export). Returns an unsubscribe function. This is what lets the
 * UI "automatically use the latest data" any time the underlying store
 * changes, without polling.
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getAllRecords() {
  await ready();
  return [...cache];
}

export async function getVendors() {
  await ready();
  const names = new Set(cache.map((r) => r.vendor.trim()).filter(Boolean));
  return [...names].sort((a, b) => a.localeCompare(b));
}

export async function getRecordsByVendor(vendor) {
  await ready();
  if (!vendor) return [...cache];
  return cache.filter((r) => r.vendor === vendor);
}

export async function getRecordById(id) {
  await ready();
  return cache.find((r) => r.id === id) ?? null;
}

function matchesQuery(record, needle) {
  const haystack = [
    record.vendor,
    record.threadBrand,
    record.threadCode,
    record.threadColorName,
    record.pmsCode,
    record.pmsName,
    record.notes,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/**
 * Full-text search across vendor, thread brand/code/color, and PMS
 * code/name. Optionally scoped to a vendor.
 */
export async function searchRecords(query, { vendor } = {}) {
  await ready();
  const needle = query.trim().toLowerCase();
  let results = vendor ? cache.filter((r) => r.vendor === vendor) : cache;
  if (needle) {
    results = results.filter((r) => matchesQuery(r, needle));
  }
  return results;
}

export class ValidationError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

function validateRecord(record, { existing, ignoreId } = {}) {
  const errors = {};
  if (!record.vendor?.trim()) errors.vendor = "Vendor is required.";
  if (!record.threadBrand?.trim()) errors.threadBrand = "Thread brand is required.";
  if (!record.threadCode?.trim()) errors.threadCode = "Thread code is required.";

  // Vendor + brand + thread code + PMS code identifies a unique record.
  // The same thread CAN appear more than once with a different PMS code —
  // that's how multiple possible PMS matches for one thread are modeled.
  const pool = existing ?? cache;
  const duplicate = pool.find(
    (r) =>
      r.id !== ignoreId &&
      r.vendor.trim().toLowerCase() === record.vendor?.trim().toLowerCase() &&
      r.threadBrand.trim().toLowerCase() === record.threadBrand?.trim().toLowerCase() &&
      r.threadCode.trim().toLowerCase() === record.threadCode?.trim().toLowerCase() &&
      (r.pmsCode ?? "").trim().toLowerCase() === (record.pmsCode ?? "").trim().toLowerCase()
  );
  if (duplicate) {
    errors.threadCode = "A record with this vendor, brand, thread code, and PMS already exists.";
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError("Record failed validation.", errors);
  }
}

const BLANK_FIELDS = {
  threadColorName: "",
  threadHex: "",
  pmsCode: "",
  pmsName: "",
  pmsHex: "",
  notes: "",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function addRecord(input) {
  await ready();
  const record = { ...BLANK_FIELDS, ...input };
  validateRecord(record);
  const withId = { ...record, id: generateId(), updatedAt: today(), updatedBy: ADMIN_USERNAME };
  await persist([...cache, withId]);
  return withId;
}

export async function updateRecord(id, patch) {
  await ready();
  const current = cache.find((r) => r.id === id);
  if (!current) throw new Error(`Record ${id} not found.`);
  const next = { ...current, ...patch };
  validateRecord(next, { ignoreId: id });
  const updated = { ...next, updatedAt: today(), updatedBy: ADMIN_USERNAME };
  await persist(cache.map((r) => (r.id === id ? updated : r)));
  return updated;
}

export async function deleteRecord(id) {
  await ready();
  await persist(cache.filter((r) => r.id !== id));
}

export async function deleteVendor(vendor) {
  await ready();
  await persist(cache.filter((r) => r.vendor !== vendor));
  removeVendorFileEntry(vendor);
  await deleteFile(vendor);
}

export async function renameVendor(oldName, newName) {
  await ready();
  const trimmed = newName.trim();
  if (!trimmed) throw new ValidationError("Vendor name is required.", { vendor: "Required" });

  // IndexedDB has no rename - move the blob (if this vendor has one) to a
  // key under the new label, and repoint any records that referenced it.
  const uploadedBlob = await getFile(oldName);
  if (uploadedBlob) {
    await putFile(trimmed, uploadedBlob);
    await deleteFile(oldName);
  }
  const newMarker = uploadedBlob ? uploadedSourceMarker(trimmed) : null;

  await persist(
    cache.map((r) =>
      r.vendor === oldName
        ? {
            ...r,
            vendor: trimmed,
            sourceFile: isUploadedSource(r.sourceFile) && newMarker ? newMarker : r.sourceFile,
            updatedAt: today(),
            updatedBy: ADMIN_USERNAME,
          }
        : r
    )
  );
  const existingFile = vendorFiles.find((f) => f.label === oldName);
  if (existingFile) upsertVendorFileEntry({ ...existingFile, label: trimmed });
}

async function resolveTemplateBuffer(label) {
  const uploadedBlob = await getFile(label);
  if (uploadedBlob) {
    try {
      return await uploadedBlob.arrayBuffer();
    } catch {
      // corrupt stored blob - fall through to the other lookup path
    }
  }
  const bundledRecord = cache.find((r) => r.vendor === label && r.sourceFile && !isUploadedSource(r.sourceFile));
  if (bundledRecord) {
    try {
      const res = await fetch(getStaticChartFileUrl(bundledRecord.sourceFile));
      if (res.ok) return await res.arrayBuffer();
    } catch {
      // no network / file missing - no template available
    }
  }
  return null;
}

function fileKind(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".xlsx") || file.type.includes("spreadsheet")) return "xlsx";
  return null;
}

/**
 * Parses an uploaded vendor thread-chart file (.xlsx or .pdf) entirely in
 * the browser and replaces that vendor's color-mapping records with the
 * freshly parsed ones — re-uploading under the same label is how an admin
 * updates a vendor's chart. Tracked separately in the vendor-file registry
 * so the Admin UI can list uploaded files by label with a last-updated
 * date.
 *
 * PDF extraction is best-effort: it reconstructs a table from the text
 * layer's positions, which only works when the PDF actually contains a
 * real grid-aligned thread/PMS table. Index/reference PDFs (link lists,
 * prose) correctly come back with zero matches rather than garbage.
 */
export async function uploadVendorFile(label, file) {
  await ready();
  const trimmedLabel = label?.trim();
  if (!trimmedLabel) {
    throw new ValidationError("A vendor label is required.", { label: "Vendor label is required." });
  }
  if (!file) {
    throw new ValidationError("Choose a .xlsx or .pdf file to upload.", { file: "Choose a file to upload." });
  }

  const kind = fileKind(file);
  if (!kind) {
    throw new ValidationError(`"${file.name}" isn't a .xlsx or .pdf file.`, { file: "Unsupported file type." });
  }

  const updatedAt = today();
  // The file registry (unlike record-level `updatedAt`) shows a precise
  // upload time in the Admin UI, so it gets a full timestamp rather than
  // just a date.
  const uploadedAt = new Date().toISOString();
  let parsed;
  let matchCount; // sheets (xlsx) or tables (pdf) successfully parsed
  let skippedNoThreadNumber;
  let duplicates;
  let sourceBlob; // what gets stored as this vendor's downloadable file

  if (kind === "xlsx") {
    let workbook;
    try {
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: "array" });
    } catch (err) {
      throw new ValidationError(`Could not read "${file.name}" as an Excel file: ${err.message}`, {
        file: "Not a readable .xlsx file.",
      });
    }
    const result = parseWorkbookToRecords(workbook, trimmedLabel, {
      sheetToJson: XLSX.utils.sheet_to_json,
      updatedAt,
      updatedBy: ADMIN_USERNAME,
    });
    parsed = result.records;
    matchCount = result.sheetsParsed;
    skippedNoThreadNumber = result.skippedNoThreadNumber;
    duplicates = result.duplicates;
    // Already a real, fully-styled Excel file - store the upload verbatim
    // rather than round-tripping it through a rebuild.
    sourceBlob = file;
  } else {
    let result;
    try {
      const buffer = await file.arrayBuffer();
      result = await parsePdfToRecords(buffer, trimmedLabel, { updatedAt, updatedBy: ADMIN_USERNAME });
    } catch (err) {
      throw new ValidationError(`Could not read "${file.name}" as a PDF: ${err.message}`, {
        file: "Not a readable PDF file.",
      });
    }
    parsed = result.records;
    matchCount = result.tablesFound;
    skippedNoThreadNumber = result.skippedNoThreadNumber;
    duplicates = result.duplicates;
  }

  if (matchCount === 0) {
    throw new ValidationError(
      `No recognizable thread-chart table found in "${file.name}". Expected a header row with columns like "Thread Number" and "PMS Number".`,
      { file: "Unrecognized file format." }
    );
  }

  if (kind === "pdf") {
    // A PDF has no native "Excel file" of its own - build one from the
    // extracted rows so this vendor still gets a real, downloadable chart
    // that a designer can cross-check the app's matches against. Reuses
    // the vendor's existing chart (if any) as a structural/style template
    // so sheets that already existed keep their exact column layout and
    // formatting; brand-new thread lines fall back to the standard layout.
    const templateBuffer = await resolveTemplateBuffer(trimmedLabel);
    const recordsByBrand = new Map();
    for (const record of parsed) {
      if (!recordsByBrand.has(record.threadBrand)) recordsByBrand.set(record.threadBrand, []);
      recordsByBrand.get(record.threadBrand).push(record);
    }
    const xlsxBuffer = await buildVendorWorkbook({ templateBuffer, recordsByBrand });
    sourceBlob = new Blob([xlsxBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  await putFile(trimmedLabel, sourceBlob);
  const stamped = parsed.map((r) => ({ ...r, sourceFile: uploadedSourceMarker(trimmedLabel) }));

  // Replace: this label's previous records (if any) are fully superseded.
  await persist([...cache.filter((r) => r.vendor !== trimmedLabel), ...stamped]);

  const entry = { label: trimmedLabel, fileName: file.name, uploadedAt, recordCount: stamped.length };
  upsertVendorFileEntry(entry);

  return { ...entry, skippedNoThreadNumber, duplicates };
}

export async function getVendorFiles() {
  await ready();
  // Most recently uploaded/replaced first.
  return [...vendorFiles].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

export async function deleteVendorFile(label) {
  await ready();
  await persist(cache.filter((r) => r.vendor !== label));
  removeVendorFileEntry(label);
  await deleteFile(label);
}

/**
 * Imports CSV text, upserting rows that match an existing
 * vendor+threadBrand+threadCode combination and inserting the rest.
 * Rows missing required fields are skipped and reported back.
 */
export async function importCsv(text) {
  await ready();
  const rows = csvToRecords(text);
  let next = [...cache];
  let added = 0;
  let updated = 0;
  const skipped = [];

  for (const row of rows) {
    if (!row.vendor?.trim() || !row.threadBrand?.trim() || !row.threadCode?.trim()) {
      skipped.push({ row, reason: "Missing vendor, thread brand, or thread code." });
      continue;
    }
    const match = next.find(
      (r) =>
        r.vendor.trim().toLowerCase() === row.vendor.trim().toLowerCase() &&
        r.threadBrand.trim().toLowerCase() === row.threadBrand.trim().toLowerCase() &&
        r.threadCode.trim().toLowerCase() === row.threadCode.trim().toLowerCase() &&
        (r.pmsCode ?? "").trim().toLowerCase() === (row.pmsCode ?? "").trim().toLowerCase()
    );
    if (match) {
      next = next.map((r) =>
        r.id === match.id ? { ...r, ...row, updatedAt: today(), updatedBy: ADMIN_USERNAME } : r
      );
      updated++;
    } else {
      next = [
        ...next,
        { ...BLANK_FIELDS, ...row, id: generateId(), updatedAt: today(), updatedBy: ADMIN_USERNAME },
      ];
      added++;
    }
  }

  await persist(next);
  return { added, updated, skipped };
}

export async function exportCsv(records) {
  await ready(0);
  return recordsToCsv(records ?? cache);
}

/**
 * Discards any admin edits and reloads the pristine dataset from the
 * generated JSON asset (falling back to the small bundled sample if that
 * fetch fails).
 */
export async function resetToSeed() {
  await ready();
  try {
    await persist(await fetchPristineData());
  } catch (err) {
    console.warn("Falling back to bundled sample data:", err);
    await persist([...fallbackSeed]);
  }
}
