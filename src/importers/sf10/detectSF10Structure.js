// src/importers/sf10/detectSF10Structure.js
// Detects the layout of an SF10 (Learner's Permanent Academic Record) worksheet
// WITHOUT assuming a fixed row layout. It scans worksheet contents to locate:
//   - the learner identity header (LRN / name columns)
//   - the school / school-year / grade / section context block
//   - the learning-areas (subjects) grades table
//
// NOTE: This parser was written generically because no real SF10 sample file was
// available in the project at implementation time. The official SF10 groups
// learning areas + grades under a "LEARNING AREAS" / "SUBJECTS" heading with a
// "GENERAL AVERAGE" footer, and repeats that block per school year. The detection
// below keys off those robust, content-based markers rather than fixed positions.

import { normText, extractHeaderContext } from "../shared/documentDetector.js";
import { normalizeHeader, normalizeSchoolYear } from "../shared/normalization.js";
import { cellText } from "../shared/excelReader.js";

const AREA_HEADER = /LEARNINGAREAS|LEARNINGAREA|SUBJECTS|SUBJECT|SUBJECTSINSTRUCTIONALTIME/;
const AREA_FOOTER = /GENERALAVERAGE|GENERAL?AVERAGE|PROMOTED|PROMOTION|REMARKS|ADMISSION|GRADUAT(E|ION)/;
const IDENTITY_NON_KEYS = /NAME|LRN|REFERENCE|SEX|BIRTH|AGE|GENDER/;

// Marks the start of the learner identity block and the start of the scholastic
// record beneath it. The official SF10 writes identity as label/value pairs
// spread over SEVERAL rows under "LEARNER'S INFORMATION", then puts the school
// context under "SCHOLASTIC RECORD" *below* the identity block.
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
 * The value belonging to a label is rarely in the very next cell: merged cells
 * read back as nulls, so the scan walks forward to the next non-empty cell and
 * gives up if it reaches the following label (which is how an empty "Name
 * Extension" is correctly left blank rather than filled with the next label).
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
      for (let j = i + 1; j < Math.min(text.length, i + 5); j++) {
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

/**
 * Detect the SF10 structure of a worksheet.
 * @param {Object} sheet
 * @returns {Object} structure
 */
export function detectSF10Structure(sheet) {
  const warnings = [];
  const rows = sheet.rows;
  const identityRow = findSF10IdentityRow(rows);

  if (identityRow === null) {
    return {
      identityRow: null,
      headerRow: null,
      columnMap: {},
      areaStartRow: null,
      areaEndRow: null,
      gradesRows: [],
      context: emptyContext(),
      warnings: ["Could not locate an SF10 learner identity header (LRN + name)."],
    };
  }

  const headerRow = rows[identityRow];
  const columnMap = {};
  headerRow.forEach((cell, col) => {
    const key = normalizeHeader(cell);
    if (key && !columnMap[key]) columnMap[col] = key;
  });

  // Locate the section markers so the identity block and the school context are
  // each read from the right region of the sheet.
  let infoMarkerRow = null;
  let scholasticRow = null;
  let areaHeaderRow = null;

  for (let r = 0; r < rows.length; r++) {
    const key = rowKey(rows[r]);
    if (infoMarkerRow === null && r <= identityRow && IDENTITY_BLOCK_START.test(key)) infoMarkerRow = r;
    if (scholasticRow === null && SCHOLASTIC_MARKER.test(key)) scholasticRow = r;
    if (areaHeaderRow === null && AREA_HEADER.test(key)) areaHeaderRow = r;
  }

  // The identity block runs from the "LEARNER'S INFORMATION" heading (or a few
  // rows above the LRN line when there is no heading) down to wherever the
  // scholastic record starts.
  const identityBlockStart = infoMarkerRow !== null ? infoMarkerRow + 1 : Math.max(0, identityRow - 4);
  let identityBlockEnd = Math.min(rows.length, identityRow + 5);
  if (scholasticRow !== null && scholasticRow > identityRow) {
    identityBlockEnd = scholasticRow;
  } else if (areaHeaderRow !== null && areaHeaderRow > identityRow) {
    identityBlockEnd = areaHeaderRow;
  }

  const identity = extractIdentityPairs(rows, identityBlockStart, identityBlockEnd);

  // The school context is NOT above the identity block on an SF10 — it sits
  // under SCHOLASTIC RECORD, below it. Scan everything down to the grade table
  // so both layouts are covered.
  const contextEnd = areaHeaderRow !== null ? areaHeaderRow : rows.length;
  const rawContext = extractHeaderContext(rows.slice(0, contextEnd), contextEnd);
  const context = {
    schoolId: rawContext.schoolId,
    schoolName: rawContext.schoolName,
    division: rawContext.division,
    district: rawContext.district,
    schoolYear: normalizeSchoolYear(rawContext.schoolYear),
    gradeLevel: rawContext.grade ? String(rawContext.grade).trim() : "",
    section: rawContext.section ? String(rawContext.section).trim() : "",
  };

  // Locate the learning-areas grades table: its header row mentions
  // LEARNING AREAS / SUBJECTS, and it ends at a GENERAL AVERAGE / REMARKS footer.
  let areaStartRow = null;
  let areaEndRow = null;
  for (let r = identityRow + 1; r < rows.length; r++) {
    if (AREA_HEADER.test(normText(rows[r].map(cellText).join(" ")))) {
      // walk down until the footer
      areaStartRow = r + 1;
      let end = r + 1;
      while (end < rows.length && !AREA_FOOTER.test(normText(rows[end].map(cellText).join(" ")))) {
        end++;
      }
      areaEndRow = end;
      break;
    }
  }

  if (areaStartRow === null) {
    warnings.push(
      "No learning-areas (SUBJECTS) grade table was detected. Academic grades may not be extracted."
    );
  }

  return {
    identityRow,
    headerRow: rows[identityRow],
    columnMap,
    identity,
    identityBlockStart,
    identityBlockEnd,
    areaStartRow,
    areaEndRow,
    context,
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
    name: "",
    lrn: "",
    birthDate: "",
    sex: "",
  };
}

export { IDENTITY_NON_KEYS };
