// src/importers/sf10/detectSF10Structure.js
// Detects the layout of an SF10 (Learner's Permanent Academic Record) worksheet
// WITHOUT assuming a fixed row layout. It scans worksheet contents to locate:
//   - the learner identity block (label/value pairs, one learner per form)
//   - every SCHOLASTIC RECORD block, each with its own school/grade/year context
//   - the learning-areas grades table inside each block
//
// The shape of the real form drives two decisions here:
//
//  1. One SF10 holds MANY scholastic blocks — one per school year the learner
//     completed (Grade 7, Grade 8, … each with their own school, section and
//     adviser). Reading only the first block threw away every prior year, so
//     detection returns a list of blocks and the importer emits one record each.
//
//  2. The school context sits BELOW the identity, under "SCHOLASTIC RECORD" —
//     and an "ELIGIBILITY FOR JHS ENROLLMENT" block ABOVE it carries the
//     ELEMENTARY school's name and ID. Scanning the sheet top-down would read
//     the elementary School ID as the record's school, so each block's context
//     is scanned only within that block's own row range.

import { normText, extractHeaderContext } from "../shared/documentDetector.js";
import { normalizeHeader, normalizeSchoolYear } from "../shared/normalization.js";
import { cellText } from "../shared/excelReader.js";

const AREA_HEADER = /LEARNINGAREAS|LEARNINGAREA|SUBJECTS|SUBJECT|SUBJECTSINSTRUCTIONALTIME/;
const AREA_FOOTER = /GENERALAVERAGE|GENERAL?AVERAGE|PROMOTED|PROMOTION|REMARKS|ADMISSION|GRADUAT(E|ION)/;
const GENERAL_AVERAGE = /GENERALAVERAGE/;
const IDENTITY_NON_KEYS = /NAME|LRN|REFERENCE|SEX|BIRTH|AGE|GENDER/;

// The remedial-classes table repeats the words "Learning Areas" but grades a
// re-take, not the school year, so it must never be mistaken for a grade block.
const REMEDIAL = /REMEDIAL/;

// Marks the start of the learner identity block and the start of the scholastic
// record beneath it.
const IDENTITY_BLOCK_START = /LEARNERSINFORMATION|LEARNERINFORMATION/;
const SCHOLASTIC_MARKER = /SCHOLASTICRECORD|SCHOLASTICRECORDS/;

// The identity fields read from label/value pairs in the identity block.
const IDENTITY_FIELDS = new Set([
  "lrn",
  "lastName",
  "firstName",
  "middleName",
  "nameExtension",
  "fullName",
  "sex",
  "birthDate",
]);

/** Row text reduced to an alphanumeric fingerprint. */
function rowKey(row) {
  return Array.isArray(row) ? normText(row.map(cellText).join(" ")) : "";
}

/**
 * Read label/value pairs for the learner identity out of a block of rows.
 *
 * The value belonging to a label is rarely in the next cell — the real form puts
 * the LRN label in column 1 and its value in column 12 — so the scan runs to the
 * end of the row and stops at the following label, which is how an empty "Name
 * Extension" is correctly left blank rather than filled with the next label.
 */
export function extractIdentityPairs(rows, startRow, endRow) {
  const identity = {};
  for (let r = Math.max(0, startRow); r < Math.min(rows.length, endRow); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const text = row.map(cellText);
    for (let i = 0; i < text.length; i++) {
      const field = normalizeHeader(text[i]);
      if (!field || !IDENTITY_FIELDS.has(field) || identity[field]) continue;
      for (let j = i + 1; j < text.length; j++) {
        if (text[j] === "") continue;
        const nextField = normalizeHeader(text[j]);
        if (nextField && IDENTITY_FIELDS.has(nextField)) break;
        identity[field] = text[j];
        break;
      }
    }
  }
  return identity;
}

/**
 * True when a row looks like the SF10 learner identity header (has an LRN column
 * plus at least one name column).
 */
export function isSF10IdentityRow(row) {
  if (!Array.isArray(row)) return false;
  const keys = row.map(normalizeHeader).filter(Boolean);
  const hasLrn = keys.includes("lrn") || row.some((c) => /^LRN$|REFERENCE/i.test(normText(c)));
  const nameKey = keys.some((k) => ["lastName", "firstName", "middleName"].includes(k));
  return hasLrn && (nameKey || keys.length >= 2);
}

/** Find the SF10 learner identity header row index (0-based). */
export function findSF10IdentityRow(rows) {
  for (let r = 0; r < rows.length; r++) {
    if (isSF10IdentityRow(rows[r])) return r;
  }
  return null;
}

/** True when a row heads a learning-areas grade table (and is not the remedial one). */
function isAreaHeaderRow(row) {
  const key = rowKey(row);
  return AREA_HEADER.test(key) && !REMEDIAL.test(key);
}

/**
 * Columns of the quarterly-rating sub-header ("1 2 3 4"), or [] when absent.
 * Using the sub-header rather than "every numeric cell in the row" is what keeps
 * the final rating out of the quarterly list.
 */
function quarterColumns(row) {
  if (!Array.isArray(row)) return [];
  const cols = [];
  row.forEach((cell, col) => {
    const t = cellText(cell);
    if (/^[1-4]$/.test(t)) cols.push(col);
  });
  return cols.length >= 2 ? cols : [];
}

/** Column index of the first cell in `row` matching `pattern`, or null. */
function columnMatching(row, pattern) {
  if (!Array.isArray(row)) return null;
  for (let c = 0; c < row.length; c++) {
    if (pattern.test(normText(row[c]))) return c;
  }
  return null;
}

/**
 * Build one scholastic block descriptor from its header row.
 * `contextStart` bounds how far back the block's school context may be read, so
 * a block never borrows the previous block's (or the elementary block's) school.
 */
function buildBlock(rows, areaHeaderRow, contextStart, nextBoundary) {
  const subHeader = rows[areaHeaderRow + 1];
  const quarterCols = quarterColumns(subHeader);
  const areaStartRow = quarterCols.length > 0 ? areaHeaderRow + 2 : areaHeaderRow + 1;

  const headerRow = rows[areaHeaderRow];
  const finalCol = columnMatching(headerRow, /FINALRATING|^FINAL/);
  const remarksCol = columnMatching(headerRow, /REMARKS/);

  // The block ends at its GENERAL AVERAGE footer; fall back to the next block.
  let generalAverageRow = null;
  for (let r = areaStartRow; r < nextBoundary; r++) {
    if (GENERAL_AVERAGE.test(rowKey(rows[r]))) {
      generalAverageRow = r;
      break;
    }
  }
  const areaEndRow = generalAverageRow !== null ? generalAverageRow : nextBoundary;

  const rawContext = extractHeaderContext(
    rows.slice(contextStart, areaHeaderRow),
    Math.max(0, areaHeaderRow - contextStart)
  );

  return {
    areaHeaderRow,
    areaStartRow,
    areaEndRow,
    // Where the next block begins — bounds the search for a promotion/remarks
    // row printed BELOW the general average rather than beside it.
    blockEnd: nextBoundary,
    generalAverageRow,
    quarterCols,
    finalCol,
    remarksCol,
    context: {
      schoolId: rawContext.schoolId,
      schoolName: rawContext.schoolName,
      division: rawContext.division,
      district: rawContext.district,
      schoolYear: normalizeSchoolYear(rawContext.schoolYear),
      // Kept as bare digits: academicRecords.gradeLevel is digits by contract
      // (utils/sf10Records.js formats it on read and the document id depends
      // on it) — unlike SF1, which stores the canonical "Grade N".
      gradeLevel: rawContext.grade ? String(rawContext.grade).trim() : "",
      section: rawContext.section ? String(rawContext.section).trim() : "",
    },
  };
}

/**
 * Detect the SF10 structure of a worksheet.
 * @param {Object} sheet
 * @returns {Object} structure
 */
export function detectSF10Structure(sheet) {
  const warnings = [];
  const rows = sheet.rows;
  const identityRow = findSF10IdentityRow(rows);

  // Locate the section markers.
  let infoMarkerRow = null;
  let scholasticRow = null;
  for (let r = 0; r < rows.length; r++) {
    const key = rowKey(rows[r]);
    if (
      infoMarkerRow === null &&
      (identityRow === null || r <= identityRow) &&
      IDENTITY_BLOCK_START.test(key)
    ) {
      infoMarkerRow = r;
    }
    if (scholasticRow === null && SCHOLASTIC_MARKER.test(key)) scholasticRow = r;
  }

  // Every learning-areas table on the sheet, in order.
  const areaHeaderRows = [];
  for (let r = 0; r < rows.length; r++) {
    if (isAreaHeaderRow(rows[r])) areaHeaderRows.push(r);
  }

  // Identity block: from the "LEARNER'S INFORMATION" heading down to wherever
  // the scholastic record starts.
  let identity = {};
  let identityBlockStart = null;
  let identityBlockEnd = null;
  if (identityRow !== null) {
    identityBlockStart =
      infoMarkerRow !== null ? infoMarkerRow + 1 : Math.max(0, identityRow - 4);
    identityBlockEnd = Math.min(rows.length, identityRow + 5);
    if (scholasticRow !== null && scholasticRow > identityRow) {
      identityBlockEnd = scholasticRow;
    } else if (areaHeaderRows.length > 0) {
      const firstBelow = areaHeaderRows.find((r) => r > identityRow);
      if (firstBelow !== undefined) identityBlockEnd = firstBelow;
    }
    identity = extractIdentityPairs(rows, identityBlockStart, identityBlockEnd);
  }

  const blocks = areaHeaderRows.map((headerRowIndex, i) => {
    // A block's context may only be read from below the previous block (or, for
    // the first block, from the SCHOLASTIC RECORD marker / end of the identity).
    // Two SF10 layouts exist and the SCHOLASTIC RECORD marker tells them apart:
    //  - with the marker, the school context sits BELOW the identity and an
    //    eligibility block above it names the learner's ELEMENTARY school, so
    //    the scan must start at the marker or that elementary School ID wins;
    //  - without it, the context is a plain header block ABOVE the identity, so
    //    the scan has to start at the top of the sheet.
    let contextStart;
    if (i > 0) {
      contextStart = areaHeaderRows[i - 1] + 1;
    } else if (scholasticRow !== null) {
      contextStart = scholasticRow;
    } else {
      contextStart = 0;
    }
    const nextBoundary =
      i + 1 < areaHeaderRows.length ? areaHeaderRows[i + 1] : rows.length;
    return buildBlock(rows, headerRowIndex, contextStart, nextBoundary);
  });

  if (identityRow === null) {
    return {
      identityRow: null,
      headerRow: null,
      columnMap: {},
      identity: {},
      blocks,
      areaStartRow: blocks[0] ? blocks[0].areaStartRow : null,
      areaEndRow: blocks[0] ? blocks[0].areaEndRow : null,
      context: blocks[0] ? blocks[0].context : emptyContext(),
      warnings: ["Could not locate an SF10 learner identity header (LRN + name)."],
    };
  }

  const headerRow = rows[identityRow];
  const columnMap = {};
  headerRow.forEach((cell, col) => {
    const key = normalizeHeader(cell);
    if (key && !columnMap[key]) columnMap[col] = key;
  });

  if (blocks.length === 0) {
    warnings.push(
      "No learning-areas (SUBJECTS) grade table was detected. Academic grades may not be extracted."
    );
  }

  return {
    identityRow,
    headerRow,
    columnMap,
    identity,
    identityBlockStart,
    identityBlockEnd,
    blocks,
    // First-block shortcuts, kept so callers that only care about one block
    // (and the existing single-block tests) keep working.
    areaStartRow: blocks[0] ? blocks[0].areaStartRow : null,
    areaEndRow: blocks[0] ? blocks[0].areaEndRow : null,
    context: blocks[0] ? blocks[0].context : emptyContext(),
    warnings,
  };
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

export { IDENTITY_NON_KEYS, AREA_FOOTER };
