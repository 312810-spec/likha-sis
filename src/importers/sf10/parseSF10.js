// src/importers/sf10/parseSF10.js
// Turns the detected SF10 structure into raw SF10 records (identity + grades).
// Normalization/validation happen in separate layers.
//
// One SF10 form covers several school years, so this produces ONE raw record per
// scholastic block: the same learner identity joined to that block's school
// context, learning areas, general average and promotion status.

import { cellText } from "../shared/excelReader.js";
import { splitFullName } from "../shared/normalization.js";

/**
 * Extract learner identity from the detected identity block.
 *
 * The official SF10 writes identity as label/value pairs spread over SEVERAL
 * rows ("LAST NAME: … FIRST NAME: …" on one row, "LRN: … Birthdate: … Sex: …"
 * on the next), so reading only the row that happens to carry the LRN left the
 * name, birth date and sex empty. Those pairs are collected by
 * detectSF10Structure across the whole identity block.
 *
 * @param {Object} structure - output of detectSF10Structure()
 * @returns {Object} raw identity object
 */
export function extractSF10Identity(structure) {
  const { identity } = structure;
  const raw = {
    lrn: null,
    lastName: null,
    firstName: null,
    middleName: null,
    nameExtension: null,
    sex: null,
    birthDate: null,
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
      raw.nameExtension = raw.nameExtension || parts.nameExtension;
    }
  }

  return raw;
}

const NUMERIC_RE = /^\d{1,3}([.,]\d{1,2})?$/;

/** Parse a cell into a number, or null when it is not a plain grade value. */
function numericCell(value) {
  const t = cellText(value);
  if (!NUMERIC_RE.test(t)) return null;
  return parseFloat(t.replace(",", "."));
}

/**
 * Extract the learning areas of ONE scholastic block.
 *
 * Quarterly ratings are read from the columns named by the "1 2 3 4" sub-header
 * and the final rating from the FINAL RATING column, rather than by collecting
 * every number on the row — otherwise the final rating is appended to the
 * quarterly list and the two can no longer be told apart.
 *
 * @returns {{ areas, generalAverage, promotionStatus }}
 */
export function extractBlockLearningAreas(block, rows) {
  const areas = [];
  let generalAverage = "";
  let promotionStatus = "";
  if (!block || block.areaStartRow === null) {
    return { areas, generalAverage, promotionStatus };
  }

  const { quarterCols, finalCol, remarksCol } = block;

  for (let r = block.areaStartRow; r < Math.min(rows.length, block.areaEndRow); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const values = row.map((c) => (c === null || c === undefined ? "" : cellText(c)));
    // Blank spacer rows sit between the last subject and the general average;
    // they are skipped, never treated as the end of the block.
    if (values.every((v) => v === "")) continue;

    const name = values.find((v) => v !== "");
    if (!name) continue;
    // The quarter sub-header numbers ("1 2 3 4") are not a learning area.
    if (/^\d+([.,]\d+)?$/.test(name)) continue;

    const grades =
      quarterCols.length > 0
        ? quarterCols.map((c) => numericCell(row[c])).filter((n) => n !== null)
        : values.map(numericCell).filter((n) => n !== null);

    const finalRating = finalCol !== null ? numericCell(row[finalCol]) : null;
    const remarks = remarksCol !== null ? cellText(row[remarksCol]) : "";

    // A subject row with no marks at all is an unfilled template row.
    if (grades.length === 0 && finalRating === null) continue;

    areas.push({ name, grades, finalRating, remarks });
  }

  // The GENERAL AVERAGE footer carries the average in the FINAL RATING column
  // and the promotion status in the REMARKS column.
  if (block.generalAverageRow !== null) {
    const row = rows[block.generalAverageRow] || [];
    const joined = row.map(cellText).join(" ").toUpperCase();

    if (finalCol !== null && cellText(row[finalCol]) !== "") {
      generalAverage = cellText(row[finalCol]);
    } else {
      const m = joined.match(/GENERAL\s*AVERAGE[^\d]*([\d.,]+)/);
      if (m) generalAverage = m[1];
    }

    if (remarksCol !== null && cellText(row[remarksCol]) !== "") {
      promotionStatus = cellText(row[remarksCol]);
    } else {
      const m = joined.match(/\b(PROMOTED|RETAINED|CONDITIONAL)\b[^|]*/);
      if (m) promotionStatus = m[0].trim();
    }

    // Some templates print the promotion status on its own row BELOW the
    // general average ("REMARKS: PROMOTED TO GRADE 11") instead of in the
    // remarks column beside it. Signature-block rows ("PREPARED BY:") sit in
    // the same place and must never be mistaken for a promotion status.
    if (!promotionStatus) {
      const limit = Math.min(rows.length, block.generalAverageRow + 5, block.blockEnd);
      for (let r = block.generalAverageRow + 1; r < limit; r++) {
        const values = (rows[r] || []).map(cellText).filter((v) => v !== "");
        if (values.length === 0) continue;
        if (/^(PROMOTED|RETAINED|REMARKS)/i.test(values[0])) {
          promotionStatus = values.join(" ");
        }
        break;
      }
    }
  }

  return { areas, generalAverage, promotionStatus };
}

/**
 * Parse a detected SF10 structure into raw SF10 records — one per scholastic
 * block that actually carries grades.
 *
 * @param {Object} structure
 * @param {Object} sheet
 * @param {Object|null} identityOverride - identity read from another sheet. The
 *        SF10 is a two-page form: page 2 continues the scholastic record without
 *        repeating the learner's identity, so its blocks are parsed against the
 *        identity found on page 1.
 * @returns {{ raws: Array<Object>, structure: Object }}
 */
export function parseSF10(structure, sheet, identityOverride = null) {
  if (!structure) return { raws: [], structure };

  const identity =
    structure.identityRow !== null ? extractSF10Identity(structure) : identityOverride;
  if (!identity) return { raws: [], structure };

  const blocks = Array.isArray(structure.blocks) ? structure.blocks : [];
  const raws = [];

  blocks.forEach((block) => {
    const { areas, generalAverage, promotionStatus } = extractBlockLearningAreas(
      block,
      sheet.rows
    );
    // Blank blocks (the unfilled Grade 9 / Grade 10 pages of a two-page form)
    // must not become empty academic records.
    if (areas.length === 0) return;

    raws.push({
      ...identity,
      ...block.context,
      _learningAreas: areas,
      _generalAverage: generalAverage,
      _promotionStatus: promotionStatus,
      _blockRow: block.areaHeaderRow,
    });
  });

  return { raws, structure };
}
