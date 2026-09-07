// One-off conversion script: reads "Thread Chart/Standerd Colors.xls" (the
// company's own reference chart of standard color names -> PMS codes) and
// writes public/data/standard-colors.json.
//
// Deliberately kept completely separate from generate-thread-data.mjs and
// public/data/color-mappings.json: this is a standalone reference list, not
// a vendor thread chart, and must never be merged into or confused with the
// vendor/PMS thread-matching dataset. Not part of the running app - rerun
// manually if the source spreadsheet changes, then redeploy.
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = path.join(SCRIPT_DIR, "..", "..", "Thread Chart", "Standerd Colors.xls");
const OUT_PATH = path.join(SCRIPT_DIR, "..", "public", "data", "standard-colors.json");

const workbook = XLSX.readFile(SRC_PATH);
const sheetName = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });

const colors = [];
let skipped = 0;

for (const row of rows.slice(1)) {
  const name = String(row[0] ?? "").trim();
  const pmsCode = String(row[1] ?? "").trim();
  if (!name || !pmsCode) {
    skipped++;
    continue;
  }
  // Kept verbatim (no reformatting/normalizing) - the source has some
  // inconsistent entries (extra whitespace, "or", a stray non-PMS value);
  // showing exactly what the reference chart says is more trustworthy than
  // this script silently reinterpreting it.
  colors.push({ name, pmsCode });
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(colors));

console.log(`Wrote ${colors.length} standard colors to ${OUT_PATH}`);
if (skipped > 0) console.log(`Skipped ${skipped} rows missing a name or PMS code.`);
