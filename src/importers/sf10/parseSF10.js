// src/importers/sf10/parseSF10.js
// Turns the detected SF10 structure into a raw SF10 record (identity + grades).
// Normalization/validation happen in separate layers.

import { cellText } from "../shared/excelReader.js";
import { normText } from "../shared/documentDetector.js";

// A cell that is really just the field's LABEL (e.g. "LRN", "Last Name",
// "Birth Date") rather than the learner's value. In the official SF10 form the
// identity block is written as label/value pairs, so when we hit a label cell we
// read the value from the NEXT column.
function isLabelCell(cell) {
  if (cell === null || cell === undefined) return false;
  const key = normText(cell);
  return (
    /^(LRN|LEARNER|LEARNERS|LAST|FIRST|MIDDLE|NAME|SEX|GENDER|BIRTH|BIRTHDATE|REFERENCE|FAMILY|GIVEN|EXTENSION|EXT)/.test(
      key
    ) || true // mirror normalizeHeader below
  );
}

/**
 * Extract learner identity from the identity row + surrounding context.
 * The official SF10 stores identity as label/value pairs, so label cells are
 * read as "value in the next column".
 * @param {Object} structure - output of detectSF10Structure()
 * @returns {Object} raw identity object
 */
export function extractSF10Identity(structure) {
  const { columnMap, headerRow, context } = structure;
  const raw = {
    lrn: null,
    lastName: null,
    firstName: null,
    middleName: null,
    nameExtension: null,
    sex: null,
    birthDate: null,
    ...context, // school context may carry schoolId/schoolName/grade/section/etc.
  };

  if (Array.isArray(headerRow)) {
    Object.entries(columnMap).forEach(([colStr, field]) => {
      const col = parseInt(colStr, 10);
      const cell = headerRow[col];
      if (cell === undefined || cell === null) return;
      // If this cell is the field's label, the value lives in the next column.
      const value = isLabelCell(cell) ? headerRow[col + 1] : cell;
      if (value !== undefined && value !== null) raw[field] = value;
    });
  }

  // A single "NAME" header usually packs "Last Name, First Name Middle" — explode
  // it into separate parts as a fallback when individual name columns are absent.
  for (const colStr of Object.keys(columnMap)) {
    const field = columnMap[colStr];
    if (field === "lastName" && !raw.firstName && raw.lastName) {
      const parts = String(raw.lastName).split(",");
      if (parts.length >= 2) {
        raw.lastName = parts[0].trim();
        const rest = parts.slice(1).join(",").trim().split(/\s+/);
        raw.firstName = rest[0] || "";
        raw.middleName = rest.slice(1).join(" ") || "";
      }
    }
    void colStr;
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
  const start = structure.areaStartRow;
  if (start === null) return { areas, generalAverage };

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
    if (/GENERAL\s*AVERAGE/.test(joined)) {
      const same = joined.match(/GENERAL\s*AVERAGE[^\d]*([\d.,]+)/);
      if (same) generalAverage = same[1];
      break;
    }

    // Promotion / remarks / signatures end the block.
    if (/^(PROMOTED|RETAINED|REMARKS|ADMISSION|GRADUATE|PREPARED|CHECKED)/i.test(values[0] || "")) {
      break;
    }

    const name = values.find((v) => v !== "");
    if (!name) continue;
    const grades = values
      .filter((v) => v !== "" && NUMERIC_RE.test(v))
      .map((v) => parseFloat(v.replace(",", ".")));
    if (grades.length > 0) {
      areas.push({ name, grades });
    }
  }

  return { areas, generalAverage };
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
  const { areas, generalAverage } = extractLearningAreas(structure, sheet.rows);
  raw._learningAreas = areas;
  raw._generalAverage = generalAverage;
  return { raw, structure };
}
