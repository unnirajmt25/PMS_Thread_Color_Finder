// One-off conversion script: reads every vendor workbook in "Thread Chart/"
// and writes public/data/color-mappings.json in the app's ColorMapping shape.
// Not part of the running app — rerun manually whenever the source
// spreadsheets change, then redeploy.
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseWorkbookToRecords } from "../src/utils/threadChartParser.js";

// Resolved from this script's own location (not CWD) so it works
// regardless of where it's invoked from — frontend/ sits one level below
// the repo root, alongside Thread Chart/.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(SCRIPT_DIR, "..", "..", "Thread Chart");
const OUT_PATH = path.join(SCRIPT_DIR, "..", "public", "data", "color-mappings.json");
// Stamped fresh every run — do not hardcode a date here, or "Last Updated"
// in the UI silently goes stale the moment the source charts change again.
const UPDATED_AT = new Date().toISOString().slice(0, 10);
const UPDATED_BY = "Vendor Chart Import";

function vendorNameFromFile(filename) {
  return filename.replace(/\.xlsx$/i, "").trim();
}

const files = fs.readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith(".xlsx"));

const records = [];
let duplicates = 0;
let skippedNoThreadNumber = 0;

for (const file of files) {
  const vendor = vendorNameFromFile(file);
  const workbook = XLSX.readFile(path.join(SRC_DIR, file));

  const result = parseWorkbookToRecords(workbook, vendor, {
    sheetToJson: XLSX.utils.sheet_to_json,
    updatedAt: UPDATED_AT,
    updatedBy: UPDATED_BY,
  });

  records.push(...result.records);
  duplicates += result.duplicates;
  skippedNoThreadNumber += result.skippedNoThreadNumber;
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(records));

console.log(`Wrote ${records.length} records to ${OUT_PATH}`);
console.log(`Skipped ${skippedNoThreadNumber} rows with no thread number, deduped ${duplicates} exact duplicates.`);
console.log(`Vendors: ${new Set(records.map((r) => r.vendor)).size}`);
