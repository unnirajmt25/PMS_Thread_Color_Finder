// One-off conversion script: reads every vendor workbook in "Thread Chart/"
// and writes public/data/color-mappings.json in the app's ColorMapping shape.
// Not part of the running app — rerun manually whenever the source
// spreadsheets change, then redeploy.
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { parseWorkbookToRecords } from "../src/utils/threadChartParser.js";

const SRC_DIR = "Thread Chart";
const OUT_PATH = "public/data/color-mappings.json";
const UPDATED_AT = "2026-08-13";

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
