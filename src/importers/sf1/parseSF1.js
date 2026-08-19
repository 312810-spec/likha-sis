// src/importers/sf1/parseSF1.js
// Turns the detected SF1 structure into raw learner rows. This layer only cares
// about "which cell is which field" — normalization/validation happen later.
//
// The LIS export keeps a learner's whole name in one cell, so this is also where
// "SANTIAGO,MARIA ELENA, RIVERA" becomes discrete last/first/middle parts.

import { isBlankRow, cellText } from "../shared/excelReader.js";
import { isSubtotalRow } from "./detectSF1Structure.js";
import { parsePersonName } from "../shared/nameParser.js";

/**
 * @param {Object} structure - output of detectSF1Structure()
 * @returns {{ rawLearners: Array<Object>, droppedRows: Array<Object> }}
 */
export function parseSF1(structure) {
  const rawLearners = [];
  const droppedRows = [];

  if (!structure || !structure.columnMap || !structure.dataRows) {
    return { rawLearners, droppedRows };
  }

  const { columnMap, dataRows, context, layout } = structure;

  dataRows.forEach((entry) => {
    // Rows arrive as { cells, rowIndex }; tolerate a bare array for safety.
    const row = Array.isArray(entry) ? entry : entry.cells;
    const rowIndex = Array.isArray(entry) ? null : entry.rowIndex;
    if (!Array.isArray(row) || isBlankRow(row)) return;
    // "MALE | TOTAL" / "TOTAL FEMALE" separators sit between the two blocks.
    // They are structure, not learners, so they are skipped rather than counted
    // among the dropped rows the reviewer is asked to look at.
    if (isSubtotalRow(row)) return;

    const raw = { _rowIndex: rowIndex };

    // Read every recognized column into the raw object.
    Object.entries(columnMap).forEach(([colStr, field]) => {
      const col = parseInt(colStr, 10);
      raw[field] = row[col] !== undefined ? row[col] : null;
    });

    // The positional (LIS) layout stores one combined name; split it into parts
    // so downstream code always sees the same discrete fields.
    if (layout === "positional") {
      const parsed = parsePersonName(cellText(raw.name));
      raw.lastName = parsed.lastName;
      raw.firstName = parsed.firstName;
      raw.middleName = parsed.middleName;
      raw.nameExtension = parsed.nameExtension;
      raw._nameRaw = parsed.raw;
    }

    // Attach the file-level context (source of truth = workbook).
    raw._context = context ? { ...context } : {};

    // A row with no LRN AND no surname is not a real learner — drop it. The
    // surname may arrive either as a dedicated Last Name column or, for the
    // positional (LIS) layout, from the combined name cell split above.
    const hasLrn = raw.lrn != null && String(raw.lrn).trim() !== "";
    const hasSurname = raw.lastName != null && String(raw.lastName).trim() !== "";
    if (!hasLrn && !hasSurname) {
      droppedRows.push(raw);
      return;
    }

    rawLearners.push(raw);
  });

  return { rawLearners, droppedRows };
}
