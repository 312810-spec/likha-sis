// src/importers/sf1/parseSF1.js
// Turns the detected SF1 structure into raw learner rows. This layer only cares
// about "which cell is which field" — normalization/validation happen later.

import { isBlankRow } from "../shared/excelReader.js";

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

  const { columnMap, dataRows, context } = structure;

  dataRows.forEach((row, idx) => {
    if (row === "__BLANK__") return; // structural marker, not data
    if (!Array.isArray(row) || isBlankRow(row)) return;

    const raw = {
      _rowIndex: structure.dataStartRow + idx,
    };

    // Read every recognized column into the raw object.
    Object.entries(columnMap).forEach(([colStr, field]) => {
      const col = parseInt(colStr, 10);
      raw[field] = row[col] !== undefined ? row[col] : null;
    });

    // Attach the file-level context (source of truth = workbook).
    raw._context = context ? { ...context } : {};

    // A row with no LRN AND no surname is not a real learner — drop it.
    const hasIdentity = raw.lrn != null && String(raw.lrn).trim() !== "" && raw.lastName != null && String(raw.lastName).trim() !== "";
    if (!hasIdentity) {
      droppedRows.push(raw);
      return;
    }

    rawLearners.push(raw);
  });

  return { rawLearners, droppedRows };
}
