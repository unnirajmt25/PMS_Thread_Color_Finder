const COLUMNS = [
  "vendor",
  "threadBrand",
  "threadCode",
  "threadColorName",
  "threadHex",
  "pmsCode",
  "pmsName",
  "pmsHex",
  "notes",
  "updatedAt",
];

function escapeCell(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function recordsToCsv(records) {
  const header = COLUMNS.join(",");
  const rows = records.map((rec) => COLUMNS.map((col) => escapeCell(rec[col])).join(","));
  return [header, ...rows].join("\n");
}

/** Minimal RFC4180-style CSV line splitter supporting quoted fields. */
function parseLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * Parses CSV text into partial record objects keyed by the known columns.
 * Unknown columns are ignored; missing columns come back as "".
 */
export function csvToRecords(text) {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1);

  return rows.map((line) => {
    const cells = parseLine(line);
    const record = {};
    header.forEach((col, idx) => {
      if (COLUMNS.includes(col)) {
        record[col] = (cells[idx] ?? "").trim();
      }
    });
    return record;
  });
}

export { COLUMNS as CSV_COLUMNS };
