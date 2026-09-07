/**
 * Builds/rebuilds a vendor's .xlsx from parsed thread-chart records.
 *
 * This is the other direction from threadChartParser.js: that module reads
 * a workbook into records, this one writes records back out to a workbook.
 * It exists so that uploading a PDF (which has no native "Excel file" of
 * its own) still produces a real, downloadable .xlsx that looks like the
 * vendor's other charts - same header row, same per-sheet column layout,
 * same cell styling (including the colored "Monitor Display Color" cell),
 * not just a plain data dump.
 *
 * Uses exceljs rather than the `xlsx` package used elsewhere in this app:
 * SheetJS's free/community build can only READ cell styles, not write
 * them - confirmed while building this, writing with it silently drops
 * every style, even ones already present on an untouched cell. exceljs
 * (imported from its browser-safe dist bundle, so Vite doesn't choke on
 * its Node-only dependencies like `fs`/`archiver`) supports both.
 */
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { headerIndexMap, col } from "./threadChartParser";

export const STANDARD_HEADERS = [
  "Thread Name",
  "Color Category",
  "Thread Chart",
  "Thread Number",
  "Monitor Display Color",
  "PMS Number",
  "R",
  "G",
  "B",
];

function defaultHeaderStyle() {
  return {
    font: { bold: true, size: 11, name: "Calibri" },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  };
}

function defaultDataStyle() {
  return {
    font: { size: 11, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "middle" },
  };
}

function cloneStyle(style) {
  return style ? JSON.parse(JSON.stringify(style)) : {};
}

function rgbHex(r, g, b) {
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return [r, g, b]
    .map((n) => clamp(n).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Captures per-column cell styles + header text from one existing row. */
function captureRowStyles(worksheet, rowNumber, columnCount) {
  const row = worksheet.getRow(rowNumber);
  const styles = [];
  for (let i = 1; i <= columnCount; i++) {
    styles.push(cloneStyle(row.getCell(i).style));
  }
  return styles;
}

function captureColumnWidths(worksheet, columnCount) {
  const widths = [];
  for (let i = 1; i <= columnCount; i++) {
    const c = worksheet.getColumn(i);
    widths.push(c ? c.width : undefined);
  }
  return widths;
}

/**
 * Finds an existing sheet in the template whose header row contains our
 * standard columns, to use as a style/column-width donor for a brand-new
 * sheet that has no same-named counterpart to rebuild from directly.
 */
function findStyleDonorSheet(workbook) {
  for (const ws of workbook.worksheets) {
    const headerValues = (ws.getRow(1).values || []).slice(1);
    const map = headerIndexMap(headerValues);
    if (col(map, "thread number") !== -1 && col(map, "pms number") !== -1) {
      return ws;
    }
  }
  return null;
}

function recordRowValues(headers, record) {
  const raw = record.raw ?? {};
  return headers.map((header) => {
    switch (header.toLowerCase()) {
      case "thread name":
        return raw.threadName ?? record.threadColorName ?? "NA";
      case "color category":
        return raw.colorCategory ?? "";
      case "thread chart":
        return raw.threadChart ?? record.threadBrand ?? "";
      case "thread number":
        return raw.threadNumber ?? record.threadCode ?? "";
      case "monitor display color":
        return ""; // color lives in the cell fill, not a text value
      case "pms number":
        return raw.pmsNumber ?? record.pmsCode ?? "";
      case "r":
        return raw.r ?? "";
      case "g":
        return raw.g ?? "";
      case "b":
        return raw.b ?? "";
      default:
        return ""; // vendor-specific column (e.g. "Stocked at X") - no
        // source data for it from a PDF/record, leave blank rather than
        // guess or drop the column entirely.
    }
  });
}

function writeSheetRows(worksheet, headers, headerStyles, dataStyles, monitorColIndex, records) {
  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell, colNumber) => {
    cell.style = cloneStyle(headerStyles[colNumber - 1]);
  });

  for (const record of records) {
    const row = worksheet.addRow(recordRowValues(headers, record));
    row.eachCell((cell, colNumber) => {
      cell.style = cloneStyle(dataStyles[colNumber - 1]);
    });
    if (monitorColIndex) {
      const hex = rgbHex(record.raw?.r, record.raw?.g, record.raw?.b);
      if (hex) {
        row.getCell(monitorColIndex).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${hex}` },
        };
      }
    }
  }
}

/**
 * @param {{
 *   templateBuffer?: ArrayBuffer|null - an existing workbook for this
 *     vendor (bundled chart or a prior upload) to preserve the look of.
 *   recordsByBrand: Map<string, object[]> - thread brand (sheet name) ->
 *     its records, each expected to carry a `.raw` object (see
 *     threadChartParser.js) with the untouched source-row values.
 * }} opts
 * @returns {Promise<ArrayBuffer>}
 */
export async function buildVendorWorkbook({ templateBuffer, recordsByBrand }) {
  const workbook = new ExcelJS.Workbook();
  let hasTemplate = false;

  if (templateBuffer) {
    try {
      await workbook.xlsx.load(templateBuffer);
      hasTemplate = workbook.worksheets.length > 0;
    } catch {
      hasTemplate = false; // unreadable/corrupt template - fall back to fresh
    }
  }

  const donorSheet = hasTemplate ? findStyleDonorSheet(workbook) : null;
  const donorHeaderStyles = donorSheet ? captureRowStyles(donorSheet, 1, STANDARD_HEADERS.length) : null;
  const donorDataStyles = donorSheet && donorSheet.rowCount > 1 ? captureRowStyles(donorSheet, 2, STANDARD_HEADERS.length) : null;
  const donorColWidths = donorSheet ? captureColumnWidths(donorSheet, STANDARD_HEADERS.length) : null;

  for (const [threadBrand, records] of recordsByBrand) {
    const existingSheet = hasTemplate
      ? workbook.worksheets.find((ws) => ws.name.trim().toLowerCase() === threadBrand.trim().toLowerCase())
      : null;

    if (existingSheet) {
      // Rebuild this exact sheet using ITS OWN header layout (column order,
      // any vendor-specific extra columns) and cell styling - the most
      // faithful match to "same columns, rows, formatting, and overall
      // structure" for a thread line that already existed.
      const headerValues = (existingSheet.getRow(1).values || []).slice(1).map((v) => String(v ?? "").trim());
      const columnCount = headerValues.length;
      const headerStyles = captureRowStyles(existingSheet, 1, columnCount);
      const dataStyles = existingSheet.rowCount > 1 ? captureRowStyles(existingSheet, 2, columnCount) : headerStyles;
      const colWidths = captureColumnWidths(existingSheet, columnCount);
      const orderNo = existingSheet.orderNo;
      const monitorColIndex = col(headerIndexMap(headerValues), "monitor display color") + 1 || null;

      workbook.removeWorksheet(existingSheet.id);
      const newSheet = workbook.addWorksheet(threadBrand);
      newSheet.orderNo = orderNo;
      newSheet.columns = colWidths.map((width) => ({ width }));
      writeSheetRows(newSheet, headerValues, headerStyles, dataStyles, monitorColIndex, records);
    } else {
      // No prior sheet for this thread line (new to the vendor's chart, or
      // no template at all) - use the standard column layout, styled after
      // another sheet in the same workbook when one exists so it still
      // looks consistent with the rest of the file.
      const newSheet = workbook.addWorksheet(threadBrand);
      if (donorColWidths) newSheet.columns = donorColWidths.map((width) => ({ width }));
      writeSheetRows(
        newSheet,
        STANDARD_HEADERS,
        donorHeaderStyles ?? STANDARD_HEADERS.map(defaultHeaderStyle),
        donorDataStyles ?? STANDARD_HEADERS.map(defaultDataStyle),
        STANDARD_HEADERS.indexOf("Monitor Display Color") + 1,
        records
      );
    }
  }

  return workbook.xlsx.writeBuffer();
}
