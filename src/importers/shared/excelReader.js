// src/importers/shared/excelReader.js
// Thin wrapper around SheetJS (xlsx) for reading DepEd workbooks.
// Produces a normalized worksheet model: { name, rows, headerRow, rowCount, colCount }
// where `rows` is an array-of-arrays of raw cell values (numbers, Date, strings, null).
// Keeping all raw reads here centralizes the SheetJS usage so the rest of the
// importer only deals with plain JS arrays (making it easy to unit test).

import * as XLSX from "xlsx";

/**
 * Convert raw cell values into a stable string form we can search/normalize.
 * - Numbers that look like LRNs / codes stay as numbers so rounding is avoided.
 * - Dates become Date instances (parsing is handled later by normalizers).
 * - Everything else is kept as-is (string | number | Date | null).
 */
function cleanCell(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  // Booleans and numbers pass through unchanged.
  return value;
}

/**
 * Read an ArrayBuffer (from a File via file.arrayBuffer()) into worksheet models.
 * @param {ArrayBuffer} arrayBuffer - raw file bytes
 * @param {Object} [options] - { sheetName } to read only one sheet
 * @returns {{ sheetNames: string[], sheets: Array<{name, rows, rowCount, colCount}> }}
 * @throws Error with a friendly message when the file is not a readable workbook.
 */
export function readWorkbook(arrayBuffer, options = {}) {
  let workbook;
  try {
    workbook = XLSX.read(arrayBuffer, {
      type: "array",
      cellDates: true, // keep date cells as real Date objects
      cellNF: false,
      cellText: false,
    });
    } catch (err) {
    throw new Error(
      "This file could not be read as a valid Excel (.xls / .xlsx) workbook. " +
        "Please check that the file is not corrupted.",
      { cause: err }
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("The workbook does not contain any worksheets.");
  }

  const sheetNames = workbook.SheetNames;
  const names = options.sheetName
    ? sheetNames.filter((n) => n.toLowerCase() === options.sheetName.toLowerCase())
    : sheetNames;

  if (names.length === 0) {
    throw new Error(
      `The workbook does not contain a worksheet named "${options.sheetName}".`
    );
  }

  const sheets = names.map((name) => {
    const ws = workbook.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      raw: true,
    });
    const rows = aoa.map((row) =>
      Array.isArray(row) ? row.map(cleanCell) : []
    );
    let rowCount = rows.length;
    let colCount = 0;
    rows.forEach((r) => {
      if (r.length > colCount) colCount = r.length;
    });
    // Trim trailing completely empty rows so scans don't waste time.
    while (rowCount > 0 && rows[rowCount - 1].every((c) => c === null)) {
      rowCount--;
    }
    return { name, rows, rowCount, colCount };
  });

  return { sheetNames, sheets };
}

/** Return the trimmed string value of a cell, or "" when null/undefined. */
export function cellText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/** True when a row has no meaningful (non-null) cell content. */
export function isBlankRow(row) {
  if (!Array.isArray(row)) return true;
  return row.every((c) => c === null || c === undefined || String(c).trim() === "");
}
