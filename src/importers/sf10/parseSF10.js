// src/importers/sf10/parseSF10.js
// Turns the detected SF10 structure into a raw SF10 record (identity + grades).
// Normalization/validation happen in separate layers.

import { cellText } from "../shared/excelReader.js";
import { splitFullName } from "../shared/normalization.js";

/**
 * Extract learner identity from the detected identity block plus school context.
 *
 * The official SF10 is one learner per form and writes identity as label/value
 * pairs spread over SEVERAL rows ("LAST NAME: … FIRST NAME: …" on one row,
 * "LRN: … Date of Birth: … Sex: …" on the next), so reading only the row that
 * happens to carry the LRN left the name, birth date and sex empty. Those pairs
 * are collected by detectSF10Structure across the whole identity block.
 *
 * @param {Object} structure - output of detectSF10Structure()
 * @returns {Object} raw identity object
 */
export function extractSF10Identity(structure) {
  const { context, identity } = structure;
  const raw = {
    lrn: null,
    lastName: null,
    firstName: null,
    middleName: null,
    nameExtension: null,
    sex: null,
    birthDate: null,
    ...context, // school context carries schoolId/schoolName/grade/section/etc.
    ...(identity || {}),
  };

  // A single "NAME" field packs "Last Name, First Name Middle Name" — explode it
  // when the form has no separate name fields.
  if (!raw.lastName && raw.fullName) {
    const parts = splitFullName(raw.fullName);
    if (parts) {
      raw.lastName = parts.lastName;
      raw.firstName = raw.firstName || parts.firstName;
      raw.middleName = raw.middleName || parts.middleName;
    }
  }

  return raw;
}

const NUMERIC_RE = /^\d{1,3}([.,]\d{1,2})?$/;

/**
 * Extract the learning-areas grade rows from the detected table region.
 * @param {Object} structure
 * @param {Array<Array>} rows - full worksheet rows
 * @returns {{ areas: Array<{name, grades: Array<number>}>, generalAverage: string }}
 */
export function extractLearningAreas(structure, rows) {
  const areas = [];
  let generalAverage = "";
  let promotionStatus = "";
  const start = structure.areaStartRow;
  if (start === null) return { areas, generalAverage, promotionStatus };

  // Scan from the area header down for a generous window. Areas are subject
  // rows, GENERAL AVERAGE is the numeric footer, and PROMOTED/REMARKS lines end
  // the block. A blank row after at least one area also ends the scan.
  const end = structure.areaEndRow === null || structure.areaEndRow <= start
    ? Math.min(rows.length, start + 50)
    : Math.min(rows.length, structure.areaEndRow + 3);

  for (let r = start; r < end; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const values = row.map((c) => (c === null || c === undefined ? "" : cellText(c)));

    // Fully empty row: stop once we have collected some areas.
    if (values.every((v) => v === "")) {
      if (areas.length > 0) break;
      continue;
    }

    const joined = values.join(" ").toUpperCase();

    // General Average footer (its value can be in the same or next cell).
    // Keep scanning after it -- the promotion/remarks row usually follows
    // immediately, and would otherwise never be reached.
    if (/GENERAL\s*AVERAGE/.test(joined)) {
      const same = joined.match(/GENERAL\s*AVERAGE[^\d]*([\d.,]+)/);
      if (same) generalAverage = same[1];
      continue;
    }

    // Promotion / remarks / signatures end the block. Only PROMOTED/RETAINED/
    // REMARKS rows actually declare a promotion status -- ADMISSION/GRADUATE/
    // PREPARED/CHECKED are signature-block markers, captured only as a stop
    // signal, never as promotionStatus text.
    if (/^(PROMOTED|RETAINED|REMARKS|ADMISSION|GRADUATE|PREPARED|CHECKED)/i.test(values[0] || "")) {
      if (/^(PROMOTED|RETAINED|REMARKS)/i.test(values[0] || "")) {
        promotionStatus = values.filter((v) => v !== "").join(" ");
      }
      break;
    }

    const name = values.find((v) => v !== "");
    if (!name) continue;
    // The grade table has a sub-header row numbering the quarters ("1 2 3 4").
    // A learning area is never named by a bare number, so skip those rows —
    // otherwise the quarter labels are imported as a subject called "1".
    if (/^\d+([.,]\d+)?$/.test(name)) continue;
    const grades = values
      .filter((v) => v !== "" && NUMERIC_RE.test(v))
      .map((v) => parseFloat(v.replace(",", ".")));
    if (grades.length > 0) {
      areas.push({ name, grades });
    }
  }

  return { areas, generalAverage, promotionStatus };
}

/**
 * Parse a detected SF10 structure into a raw SF10 record.
 * @param {Object} structure
 * @param {Object} sheet
 * @returns {{ raw: Object|null, structure: Object }}
 */
export function parseSF10(structure, sheet) {
  if (!structure || structure.identityRow === null) {
    return { raw: null, structure };
  }
  const raw = extractSF10Identity(structure);
  const { areas, generalAverage, promotionStatus } = extractLearningAreas(structure, sheet.rows);
  raw._learningAreas = areas;
  raw._generalAverage = generalAverage;
  raw._promotionStatus = promotionStatus;
  return { raw, structure };
}
