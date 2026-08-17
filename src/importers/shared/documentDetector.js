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

// Exact label keys (as produced by normalizeHeaderKey) that name a context
// field. Matching exactly rather than by substring matters: a loose /grade/
// test also matches the VALUE cell "Grade 10", which would then be read as a
// label and overwrite the real grade with whatever followed it.
const CONTEXT_LABELS = {
  schoolid: "schoolId",
  schoolidno: "schoolId",
  school: "schoolName",
  schoolname: "schoolName",
  nameofschool: "schoolName",
  division: "division",
  schoolsdivision: "division",
  divisionofcityschools: "division",
  district: "district",
  schooldistrict: "district",
  schoolyear: "schoolYear",
  sy: "schoolYear",
  grade: "grade",
  gradelevel: "grade",
  classifiedasgrade: "grade",
  gradeandsection: "grade",
  section: "section",
  sectionname: "section",
};

/** The context field a label cell names, or null when it is not a label. */
function contextField(cellValue) {
  const key = normalizeHeaderKey(cellValue);
  if (!key) return null;
  return CONTEXT_LABELS[key] || null;
}

/**
 * Extract key-value metadata (school info) from a block of rows.
 * Scans the first `limit` rows for label/value pairs such as
 *   "School ID: 123456"  or  [ "School ID", "123456" ]
 *
 * A value may sit more than one cell to the right of its label, because merged
 * cells read back as nulls, so the scan walks forward to the next non-empty
 * cell — stopping if that cell turns out to be the next label.
 *
 * Only non-empty values are assigned, so a later label with a blank value can
 * never wipe out a value already read.
 *
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

  const assign = (field, value) => {
    const v = String(value ?? "").trim();
    if (field && v && !ctx[field]) ctx[field] = v;
  };

  for (let r = 0; r < Math.min(limit, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const text = row.map(cellText);

    // Two-cell "label | value" layouts.
    for (let i = 0; i < text.length - 1; i++) {
      const field = contextField(text[i]);
      if (!field) continue;
      for (let j = i + 1; j < Math.min(text.length, i + 4); j++) {
        if (text[j] === "") continue; // merged-cell filler
        if (contextField(text[j])) break; // the next label — this one had no value
        assign(field, text[j]);
        break;
      }
    }

    // A single cell that itself contains "Label: value".
    for (const cell of row) {
      const t = cellText(cell);
      const m = t.match(/^([A-Za-z ]+?)\s*[:|-]\s*(.+)$/);
      if (m) assign(contextField(m[1]), m[2].trim());
    }
  }

  return ctx;
}

export { normalizeHeaderKey, SCHOOL_KEYWORDS, SUMMARY_KEYWORDS };
