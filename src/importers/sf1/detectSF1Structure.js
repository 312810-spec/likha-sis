// src/importers/sf1/detectSF1Structure.js
// Detects the layout of an SF1 worksheet WITHOUT assuming a fixed header row.
// It scans the worksheet contents to locate:
//   - the learner table header row (via shared header detection)
//   - which column maps to which learner field
//   - the block of learner data rows
//   - the school / grade / section / school-year header context

import {
  findLearnerHeaderRow,
  extractHeaderContext,
  normText,
} from "../shared/documentDetector.js";
import { normalizeHeader, normalizeSchoolYear } from "../shared/normalization.js";
import { cellText, isBlankRow } from "../shared/excelReader.js";

const BLANK_ROW_STR = "__BLANK__";

/**
 * Build the column -> canonical-field map from a header row.
 * @returns {Object<string,string>} e.g. { "1": "lrn", "2": "lastName", ... }
 */
function buildColumnMap(headerRow) {
  const map = {};
  if (!Array.isArray(headerRow)) return map;
  headerRow.forEach((cell, col) => {
    const key = normalizeHeader(cell);
    if (key) map[col] = key;
  });
  return map;
}

/**
 * Detect the SF1 structure of a worksheet.
 * @param {Object} sheet - worksheet model from excelReader.readWorkbook()
 * @returns {Object} structure with headerRow, columnMap, dataStartRow, context, warnings
 */
export function detectSF1Structure(sheet) {
  const warnings = [];
  const rows = sheet.rows;
  const headerRow = findLearnerHeaderRow(rows);

  if (headerRow === null) {
    return {
      headerRow: null,
      columnMap: {},
      dataStartRow: null,
      context: emptyContext(),
      warnings: [
        "Could not locate a learner table header (e.g. a column labelled LRN / Learner's Reference Number).",
      ],
    };
  }

  const columnMap = buildColumnMap(rows[headerRow]);
  if (!columnMap.lrn) {
    warnings.push(
      "The learner table was found but no LRN column could be identified."
    );
  }
  if (!columnMap.lastName) {
    warnings.push("The learner table has no recognized Last Name column.");
  }

  // Header context (school info + grade/section/school year) from the header rows
  // that appear BEFORE the learner table.
  const rawContext = extractHeaderContext(rows.slice(0, headerRow), 15);

  const context = {
    schoolId: rawContext.schoolId,
    schoolName: rawContext.schoolName,
    division: rawContext.division,
    district: rawContext.district,
    schoolYear: normalizeSchoolYear(rawContext.schoolYear),
    gradeLevel: rawContext.grade ? String(rawContext.grade).trim() : "",
    section: rawContext.section ? String(rawContext.section).trim() : "",
  };

  // The learner data rows run from just after the header row until we hit a
  // summary / signature / footer region. We scan and stop at the first block
  // that is not learner data (blank, TOTAL/COMBINED summary, or signature).
  const dataRows = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.length || isBlankRow(row)) {
      // A single blank row ends the learner block (SF1 tables are contiguous
      // and are followed by summary/signature rows).
      dataRows.push(BLANK_ROW_STR);
      break;
    }
    if (isSummaryOrFooterRow(row)) {
      dataRows.push(BLANK_ROW_STR);
      break;
    }
    dataRows.push(row);
  }

  return {
    headerRow,
    columnMap,
    dataRows,
    dataStartRow: headerRow + 1,
    context,
    warnings,
  };
}

/**
 * Detect whether a row is SF1 summary/footer/signature content (NOT a learner).
 * We intentionally ignore: TOTAL MALE / TOTAL FEMALE / COMBINED, signature lines,
 * "Prepared by", "Checked by", etc.
 */
export function isSummaryOrFooterRow(row) {
  if (!Array.isArray(row)) return true;
  const t = row.map(cellText).join(" ").toUpperCase();

  if (/TOTAL\s*MALE/.test(t) || /TOTAL\s*FEMALE/.test(t)) return true;
  if (/\bCOMBINED\b/.test(t)) return true;
  if (/TOTAL\s*[MALE|FEMALE|].*learner/.test(t)) return true;
  // Signature / prepared-by footer block
  if (/PREPARED BY|CHECKED BY|NOTED BY|CERTIFIED|SIGNATURE|SIGNED BY|Date Signed/i.test(t)) {
    return true;
  }
  // A row whose first cell is a raw count and the rest mostly empty is usually
  // summary as well; but we keep that conservative to avoid dropping learners.
  return false;
}

/** Reconstruct a "grade + section" row summary if present (used for statistics comparison). */
export function findSummaryRow(sheet, headerRow) {
  const rows = sheet.rows;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const t = row.map(cellText).join(" ").toUpperCase();
    if (/TOTAL\s*MALE|TOTAL\s*FEMALE|COMBINED/.test(t)) {
      const males = extractCount(t, "TOTAL MALE");
      const females = extractCount(t, "TOTAL FEMALE");
      if (males !== null || females !== null) {
        return {
          male: males,
          female: females,
          raw: t,
          rowIndex: r,
        };
      }
    }
  }
  return null;
}

function extractCount(text, label) {
  const idx = text.indexOf(label);
  if (idx === -1) return null;
  const after = text.slice(idx + label.length);
  const m = after.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function emptyContext() {
  return {
    schoolId: "",
    schoolName: "",
    division: "",
    district: "",
    schoolYear: "",
    gradeLevel: "",
    section: "",
  };
}

export { normText };
