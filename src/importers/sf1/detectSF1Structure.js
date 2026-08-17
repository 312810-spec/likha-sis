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

// How many consecutive blank rows end the learner table. Real SF1 templates
// carry a spacer row between the male and female blocks, so a single blank row
// must not be treated as the end of the data.
const MAX_BLANK_RUN = 3;

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

/** True when the column map contains a column for `field`. */
function hasField(columnMap, field) {
  return Object.values(columnMap).includes(field);
}

/**
 * True when `row` is the SECOND row of a two-row header rather than learner data.
 *
 * The official SF1 spreads its header over two rows: the top row carries the
 * merged group headings ("LRN", "NAME (Last Name, First Name, Middle Name)",
 * "Address", "Parents"), and the row beneath carries the sub-headings that
 * actually name the columns ("Last Name", "First Name", "Middle Name",
 * "Barangay", "Father's Name"). Reading only the top row leaves the name columns
 * unmapped, and every learner is then dropped for having no last name.
 *
 * A sub-header row names at least two known fields and — unlike a learner row —
 * carries no LRN-shaped value.
 */
function isSubHeaderRow(row) {
  if (!Array.isArray(row) || isBlankRow(row)) return false;
  const recognized = Object.keys(buildColumnMap(row)).length;
  if (recognized < 2) return false;
  const hasLrnValue = row.some((cell) => /^\d{9,}$/.test(cellText(cell).replace(/\D/g, "")));
  return !hasLrnValue;
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

  // Fold in the second header row when the form uses a two-row header. The
  // sub-header wins for the columns it names, except for a bare "Name" (which
  // belongs to the Guardian group, not to the learner) — that would otherwise
  // clobber a real mapping from the top row.
  let dataStartRow = headerRow + 1;
  if (isSubHeaderRow(rows[headerRow + 1])) {
    const subMap = buildColumnMap(rows[headerRow + 1]);
    Object.entries(subMap).forEach(([col, field]) => {
      if (field !== "fullName") columnMap[col] = field;
    });
    dataStartRow = headerRow + 2;
  }

  if (!hasField(columnMap, "lrn")) {
    warnings.push(
      "The learner table was found but no LRN column could be identified."
    );
  }
  if (!hasField(columnMap, "lastName") && !hasField(columnMap, "fullName")) {
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

  // The learner data rows run from just after the header until the signature /
  // footer block. The official SF1 is NOT one contiguous run: it lists the MALE
  // block, a "MALE | TOTAL" subtotal, often a blank spacer row, then the FEMALE
  // block. Stopping at the first blank or subtotal row — as this scan used to —
  // silently discarded every female learner, so subtotal and spacer rows are
  // skipped over instead, and only the footer or a long run of blanks ends the
  // block. Non-learner rows that slip through are dropped by parseSF1, which
  // requires both an LRN and a surname.
  const dataRows = [];
  let consecutiveBlanks = 0;
  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r];
    const blank = !row.length || isBlankRow(row);

    if (blank) {
      consecutiveBlanks++;
      // A long run of blank rows means the table is over.
      if (consecutiveBlanks >= MAX_BLANK_RUN) {
        dataRows.push(BLANK_ROW_STR);
        break;
      }
      dataRows.push(BLANK_ROW_STR); // keeps dataRows aligned with sheet rows
      continue;
    }
    consecutiveBlanks = 0;

    if (isFooterRow(row)) {
      dataRows.push(BLANK_ROW_STR);
      break;
    }
    dataRows.push(row);
  }

  return {
    headerRow,
    columnMap,
    dataRows,
    dataStartRow,
    context,
    warnings,
  };
}

/**
 * Detect whether a row is a subtotal row (TOTAL MALE / MALE TOTAL / COMBINED).
 * These sit BETWEEN the male and female blocks, so they are skipped, not treated
 * as the end of the learner table.
 */
export function isSubtotalRow(row) {
  if (!Array.isArray(row)) return false;
  const t = row.map(cellText).join(" ").toUpperCase();
  if (/\bTOTAL\b/.test(t) && /\b(MALE|FEMALE)\b/.test(t)) return true;
  if (/\bCOMBINED\b/.test(t)) return true;
  return false;
}

/**
 * Detect whether a row belongs to the signature / "prepared by" footer that
 * closes an SF1. Reaching one of these means the learner table has ended.
 */
export function isFooterRow(row) {
  if (!Array.isArray(row)) return true;
  const t = row.map(cellText).join(" ");
  return /PREPARED BY|CHECKED BY|NOTED BY|CERTIFIED|SIGNATURE|SIGNED BY|DATE SIGNED|SCHOOL HEAD|ADVISER/i.test(
    t
  );
}

/**
 * Detect whether a row is SF1 summary/footer/signature content (NOT a learner).
 * Retained for callers that only need "this row is not a learner".
 */
export function isSummaryOrFooterRow(row) {
  if (!Array.isArray(row)) return true;
  return isSubtotalRow(row) || isFooterRow(row);
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
