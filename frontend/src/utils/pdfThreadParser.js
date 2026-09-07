/**
 * Best-effort thread/PMS table extraction from an uploaded PDF.
 *
 * PDFs have no inherent concept of rows/columns — a text layer is just a
 * bag of positioned glyph runs. This reconstructs a table by:
 *  1. Clustering text items into rows by Y position (page coordinates).
 *  2. Within each row, clustering items into "cells" by X gaps (a big
 *     horizontal gap = a new column, a small one = the same cell/word).
 *  3. Scanning rows top-to-bottom for one whose cells look like a header
 *     ("Thread Number", "PMS Number", ...) — the first such row anchors
 *     the column positions for every row below it, until the next header
 *     row (if the table repeats per page) or the page ends.
 *
 * This works for PDFs that actually contain a real text-based table with
 * roughly grid-aligned columns. It will NOT extract anything from
 * scanned/image-only PDFs (no text layer at all) or from documents that
 * are prose/links rather than a data table — those correctly come back
 * with zero matched rows rather than garbage.
 */

import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { parseTableRows } from "./threadChartParser";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const Y_TOLERANCE = 3; // page-units; text items within this are "the same line"
const HEADER_KEYWORDS = ["thread number", "pms number"];

function groupIntoRows(items) {
  const points = items
    .filter((it) => it.str.trim() !== "")
    .map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }));

  const rows = [];
  for (const p of points) {
    let row = rows.find((r) => Math.abs(r.y - p.y) <= Y_TOLERANCE);
    if (!row) {
      row = { y: p.y, items: [] };
      rows.push(row);
    }
    row.items.push(p);
  }
  rows.sort((a, b) => b.y - a.y); // page-top first
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

// Merges same-row items into cells: a gap wider than ~1 average character
// width starts a new cell, so "Thread" + "Number" (word-spaced) merge into
// one header cell, but genuinely separate columns don't.
function rowToCells(row) {
  const cells = [];
  let current = null;
  for (const item of row.items) {
    const charWidth = Math.max(4, item.text.length ? (item.text.length > 0 ? 5 : 5) : 5);
    const gapThreshold = charWidth * 1.6;
    if (current && item.x - current.endX <= gapThreshold) {
      current.text += (item.x - current.endX > charWidth * 0.4 ? " " : "") + item.text;
      current.endX = item.x + item.text.length * charWidth;
    } else {
      current = { text: item.text, startX: item.x, endX: item.x + item.text.length * charWidth };
      cells.push(current);
    }
  }
  return cells;
}

function looksLikeHeaderRow(cells) {
  const joined = cells.map((c) => c.text.toLowerCase()).join(" | ");
  return HEADER_KEYWORDS.every((kw) => joined.includes(kw));
}

// Assigns each data-row cell to the header column whose start position is
// closest, producing a fixed-width row array aligned to the header — the
// same shape XLSX.utils.sheet_to_json(sheet, {header:1}) produces.
function alignToHeader(headerCells, dataCells) {
  const row = new Array(headerCells.length).fill("");
  for (const cell of dataCells) {
    let bestIdx = 0;
    let bestDist = Infinity;
    headerCells.forEach((h, i) => {
      const dist = Math.abs(h.startX - cell.startX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });
    row[bestIdx] = row[bestIdx] ? `${row[bestIdx]} ${cell.text}` : cell.text;
  }
  return row;
}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} vendor
 * @param {{ updatedAt: string, updatedBy?: string, threadBrand?: string }} opts
 * @returns {Promise<{ records: object[], skippedNoThreadNumber: number, duplicates: number, tablesFound: number, pagesScanned: number }>}
 */
export async function parsePdfToRecords(arrayBuffer, vendor, { updatedAt, updatedBy = "", threadBrand }) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const records = [];
  const seenKeys = new Set();
  let duplicates = 0;
  let skippedNoThreadNumber = 0;
  let tablesFound = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const rows = groupIntoRows(textContent.items);
    const cellRows = rows.map(rowToCells);

    let headerCells = null;
    let table = null;

    for (const cells of cellRows) {
      if (looksLikeHeaderRow(cells)) {
        // Flush whatever table was accumulated under the previous header
        // (handles a table that repeats its header on every page/section).
        if (table) {
          const result = parseTableRows(table, vendor, threadBrand ?? `PDF page ${pageNum}`, {
            updatedAt,
            updatedBy,
            seenKeys,
            groupByRowThreadChart: true,
          });
          if (result.matched) {
            tablesFound++;
            records.push(...result.records);
            duplicates += result.duplicates;
            skippedNoThreadNumber += result.skippedNoThreadNumber;
          }
        }
        headerCells = cells;
        table = [cells.map((c) => c.text)];
        continue;
      }
      if (headerCells) {
        table.push(alignToHeader(headerCells, cells));
      }
    }

    if (table) {
      const result = parseTableRows(table, vendor, threadBrand ?? `PDF page ${pageNum}`, {
        updatedAt,
        updatedBy,
        seenKeys,
        groupByRowThreadChart: true,
      });
      if (result.matched) {
        tablesFound++;
        records.push(...result.records);
        duplicates += result.duplicates;
        skippedNoThreadNumber += result.skippedNoThreadNumber;
      }
    }
  }

  return { records, skippedNoThreadNumber, duplicates, tablesFound, pagesScanned: pdf.numPages };
}
