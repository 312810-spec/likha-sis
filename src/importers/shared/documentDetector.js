// src/importers/shared/documentDetector.js
// Helps decide what kind of DepEd document a worksheet is, and locates the
// learner/grade table header row inside a worksheet. Both SF1 and SF10 parsers
// build on these helpers so they share the same "find the table" logic.

import { normalizeHeader, normalizeHeaderKey } from "./normalization.js";
import { cellText } from "./excelReader.js";

// Keywords that mark the start of a learner table. These are the *internal*
// normalized header keys (see normalization.js) that signal "a learner column".
const LEARNER_HEADER_KEYS = new Set([
  "lrn",
  "lastName",
  "firstName",
  "birthDate",
  "sex",
]);

// Keywords used to find school/section metadata lines in the header block.
// Matched against the *raw* upper-cased text of a cell.
const SCHOOL_KEYWORDS = /school|division|district/i;
const LEARNER_TABLE_KEYWORDS = /lrn|learner|referencenumber/i;
const SF10_KEYWORDS = /learnerschoolform2|sf10|permanentacademic|academicrecord|schoolform10/i;
const GRADE_SECTION_KEYWORDS = /grade|section/i;
const SCHOOL_YEAR_KEYWORDS = /schoolyear|schoollyear/i;
const SCHOOL_NAME_KEYWORDS = /schoolname|nameofschool/i;
const SUMMARY_KEYWORDS = /total|combined|malef|femalem|\bsummary\b/i;

/** Normalize a cell to an all-caps, punctuation-free fingerprint for matching. */
export function normText(value) {
  return cellText(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * True when a row likely contains the learner table header (a LRN column, etc.).
 * @param {Array} row
 */
export function isLearnerHeaderRow(row) {
  if (!Array.isArray(row)) return false;
  let count = 0;
  for (const cell of row) {
    const key = normalizeHeader(cell);
    if (key && LEARNER_HEADER_KEYS.has(key)) count++;
    if (count >= 2) return true;
  }
  // Also accept a single unmistakable "LRN"-style column.
  for (const cell of row) {
    const t = normText(cell);
    if (/^LRN$|LEARNERS?REFERENCENUMBER|LEARNINGREFERENCE/.test(t)) return true;
  }
  return false;
}

/**
 * Scan a worksheet for the learner table header row index (0-based).
 * The header row is the first non-blank row that looks like a learner header.
 * @returns {number|null}
 */
export function findLearnerHeaderRow(rows) {
  for (let r = 0; r < rows.length; r++) {
    if (isLearnerHeaderRow(rows[r])) return r;
  }
  return null;
}

/** Classify a worksheet's document type as "sf1", "sf10", or "unknown". */
export function detectDocumentType(sheet) {
  if (!sheet) return "unknown";
  const haystack = sheet.rows
    .slice(0, Math.min(40, sheet.rowCount))
    .map((r) => cellText(r[0]) + " " + cellText(r[1]) + " " + cellText(r[2]))
    .join(" ")
    .toUpperCase();

  if (SF10_KEYWORDS.test(haystack)) return "sf10";

  // SF1: mentions a learner reference table OR "School Form 1".
  if (
    LEARNER_TABLE_KEYWORDS.test(haystack) ||
    /SCHOOLFORM1|SF1|LEARNERSINFORMATIONSHEET/.test(haystack)
  ) {
    return "sf1";
  }
  return "unknown";
}

/**
 * Extract key-value metadata (school info) from the header block of a sheet.
 * Scans the first `limit` rows for label/value pairs such as
 *   "School ID: 123456"  or  [ "School ID", "123456" ]
 * @param {Array<Array>} rows
 * @param {number} limit
 * @returns {{ schoolId, schoolName, division, district, schoolYear, grade, section }}
 */
export function extractHeaderContext(rows, limit = 20) {
  const ctx = {
    schoolId: "",
    schoolName: "",
    division: "",
    district: "",
    schoolYear: "",
    grade: "",
    section: "",
  };

  for (let r = 0; r < Math.min(limit, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const text = row.map(cellText);
    const joined = text.join(" ");

    // First handle two-cell "label | value" layouts. A cell that already contains
    // its own "Label: value" would otherwise be mistaken for a bare label and
    // overwrite the parsed value with the (empty) following cell, so the
    // same-cell parsing below runs last and wins.
    for (let i = 0; i < text.length - 1; i++) {
      const label = normalizeHeaderKey(text[i]);
      if (label === "SCHOOLID") ctx.schoolId = text[i + 1];
      else if (SCHOOL_NAME_KEYWORDS.test(label)) ctx.schoolName = text[i + 1];
      else if (label === "DIVISION") ctx.division = text[i + 1];
      else if (label === "DISTRICT") ctx.district = text[i + 1];
      else if (SCHOOL_YEAR_KEYWORDS.test(label)) ctx.schoolYear = text[i + 1];
      else if (GRADE_SECTION_KEYWORDS.test(label)) {
        if (/GRADE/i.test(label)) ctx.grade = text[i + 1];
        if (/SECTION/i.test(label)) ctx.section = text[i + 1];
      }
    }

    // Handle a single cell that itself contains "Label: value".
    for (const cell of row) {
      const t = cellText(cell);
      const m = t.match(/^([A-Za-z ]+?)\s*[:|-]\s*(.+)$/);
      if (m) {
        const label = normText(m[1]);
        const value = m[2].trim();
        assignContext(ctx, label, value);
      }
    }
    void joined;
  }

  return ctx;
}

function assignContext(ctx, label, value) {
  if (label === "SCHOOLID") ctx.schoolId = value;
  else if (SCHOOL_NAME_KEYWORDS.test(label)) ctx.schoolName = value;
  else if (label === "DIVISION") ctx.division = value;
  else if (label === "DISTRICT") ctx.district = value;
  else if (SCHOOL_YEAR_KEYWORDS.test(label)) ctx.schoolYear = value;
  else if (/GRADE/i.test(label)) ctx.grade = value;
  else if (/SECTION/i.test(label)) ctx.section = value;
}

export { normalizeHeaderKey, SCHOOL_KEYWORDS, SUMMARY_KEYWORDS };
