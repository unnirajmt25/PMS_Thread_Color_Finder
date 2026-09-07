/**
 * Parses an already-loaded SheetJS workbook (one vendor's Thread Chart
 * spreadsheet — one sheet per thread brand/line) into the app's
 * ColorMapping record shape. Also exports the shared row-level parser
 * (`parseTableRows`) used by src/utils/pdfThreadParser.js, since a PDF
 * table reconstructed from text positions has the exact same
 * array-of-arrays shape as `XLSX.utils.sheet_to_json(sheet, {header:1})`.
 *
 * Shared by three callers that load tables differently:
 *  - scripts/generate-thread-data.mjs (Node, `XLSX.readFile`, builds the
 *    bundled public/data/color-mappings.json from the whole Thread Chart
 *    folder)
 *  - src/services/colorService.js (browser, `XLSX.read` on an uploaded
 *    File's ArrayBuffer, for the Admin "upload a vendor file" feature)
 *  - src/utils/pdfThreadParser.js (browser, text reconstructed from an
 *    uploaded PDF's page layout, for the same upload feature)
 *
 * Keeping the row-shape parsing logic here means all three stay in sync
 * instead of drifting into subtly different implementations.
 */

import { generateId } from "./color.js";

const NUMERIC_PMS_RE = /^(\d+)\s*C?$/i;

function toHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

// Normalizes the wide variety of "PMS Number" spellings seen across vendor
// sheets ("475C", "BlackC", "Cool Gray 7C", "7547C", stray "x"/blank...)
// into a { code, name } pair, or blanks when there's no real PMS assignment.
export function normalizePms(raw) {
  if (raw === undefined || raw === null) return { code: "", name: "" };
  const trimmed = String(raw).trim();
  if (!trimmed || /^x$/i.test(trimmed)) return { code: "", name: "" };

  const numericMatch = trimmed.match(NUMERIC_PMS_RE);
  if (numericMatch) {
    const code = numericMatch[1];
    return { code, name: `PMS ${code} C` };
  }

  // "BlackC" -> "Black C", "Cool Gray 7C" -> "Cool Gray 7 C"
  const spaced = trimmed.replace(/([a-zA-Z0-9])C$/, "$1 C").replace(/\s+/g, " ").trim();
  return { code: spaced, name: `PMS ${spaced}` };
}

function headerIndexMap(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => {
    const key = String(h ?? "").trim().toLowerCase();
    if (key) map[key] = i;
  });
  return map;
}

function col(map, ...names) {
  for (const name of names) {
    const idx = map[name.toLowerCase()];
    if (idx !== undefined) return idx;
  }
  return -1;
}

/**
 * Parses one array-of-arrays table (first row = headers) into records.
 * Requires both a "Thread Number" and a "PMS Number" column to be found
 * before treating the table as a match — this is what lets a PDF's
 * unrelated body text ("Introduction", bullet lists, etc.) be safely
 * skipped instead of misfiring on it.
 *
 * @param {Array<Array<string|number>>} rows
 * @param {string} vendor
 * @param {string} threadBrand
 * @param {{ updatedAt: string, updatedBy?: string, seenKeys?: Set<string> }} opts
 * @returns {{ records: object[], skippedNoThreadNumber: number, duplicates: number, matched: boolean }}
 */
export function parseTableRows(rows, vendor, threadBrand, { updatedAt, updatedBy = "", seenKeys = new Set() } = {}) {
  const records = [];
  let duplicates = 0;
  let skippedNoThreadNumber = 0;

  if (!rows || rows.length === 0) {
    return { records, skippedNoThreadNumber, duplicates, matched: false };
  }

  const map = headerIndexMap(rows[0]);
  const iName = col(map, "thread name");
  const iCode = col(map, "thread number");
  const iPms = col(map, "pms number");
  const iR = col(map, "r");
  const iG = col(map, "g");
  const iB = col(map, "b");

  if (iCode === -1 || iPms === -1) {
    return { records, skippedNoThreadNumber, duplicates, matched: false };
  }

  for (const row of rows.slice(1)) {
    const threadCode = row[iCode];
    if (threadCode === "" || threadCode === undefined) {
      skippedNoThreadNumber++;
      continue;
    }

    const threadName = iName !== -1 ? String(row[iName] ?? "").trim() : "";
    const threadColorName = threadName && threadName.toUpperCase() !== "NA" ? threadName : "";

    const r = iR !== -1 ? Number(row[iR]) : NaN;
    const g = iG !== -1 ? Number(row[iG]) : NaN;
    const b = iB !== -1 ? Number(row[iB]) : NaN;
    const hasRgb = [r, g, b].every((n) => Number.isFinite(n));
    const hex = hasRgb ? toHex(r, g, b) : "";

    const { code: pmsCode, name: pmsName } = normalizePms(iPms !== -1 ? row[iPms] : "");

    const key = `${vendor}|${threadBrand}|${threadCode}|${pmsCode}`.toLowerCase();
    if (seenKeys.has(key)) {
      duplicates++;
      continue;
    }
    seenKeys.add(key);

    records.push({
      id: generateId(),
      vendor,
      threadBrand,
      threadCode: String(threadCode).trim(),
      threadColorName,
      threadHex: hex,
      pmsCode,
      pmsName,
      // The vendor charts render one RGB swatch per row to visually
      // represent the assigned PMS match — reused for both previews
      // since no separately measured Pantone ink value is provided.
      pmsHex: pmsCode ? hex : "",
      notes: "",
      updatedAt,
      updatedBy,
    });
  }

  return { records, skippedNoThreadNumber, duplicates, matched: true };
}

/**
 * @param {import('xlsx').WorkBook} workbook
 * @param {string} vendor - label to stamp onto every record from this workbook
 * @param {{ sheetToJson: Function, updatedAt: string, updatedBy?: string }} opts
 *   `sheetToJson` is XLSX.utils.sheet_to_json, passed in so this module
 *   doesn't need to import the (Node vs. browser build of the) xlsx
 *   package itself.
 * @returns {{ records: object[], skippedNoThreadNumber: number, duplicates: number, sheetsParsed: number }}
 */
export function parseWorkbookToRecords(workbook, vendor, { sheetToJson, updatedAt, updatedBy = "" }) {
  const records = [];
  const seenKeys = new Set();
  let duplicates = 0;
  let skippedNoThreadNumber = 0;
  let sheetsParsed = 0;

  for (const sheetName of workbook.SheetNames) {
    const threadBrand = sheetName.trim();
    const rows = sheetToJson(workbook.Sheets[sheetName], { header: 1, defval: "" });
    const result = parseTableRows(rows, vendor, threadBrand, { updatedAt, updatedBy, seenKeys });
    if (!result.matched) continue;

    sheetsParsed++;
    records.push(...result.records);
    duplicates += result.duplicates;
    skippedNoThreadNumber += result.skippedNoThreadNumber;
  }

  return { records, skippedNoThreadNumber, duplicates, sheetsParsed };
}
