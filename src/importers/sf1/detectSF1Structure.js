// src/importers/sf1/detectSF1Structure.js
// Detects the layout of an SF1 worksheet. Two shapes are supported:
//
//  1. "positional" — the real DepEd LIS export (school_form_1_ver2014.2.1.1).
//     Its header spans two rows and its columns are heavily merged, so the
//     labels do NOT line up one-per-column. The learner's whole name lives in a
//     single "NAME (Last Name, First Name, Middle Name)" cell. For this shape we
//     read by fixed column position (see sf1Layout.js).
//
//  2. "labeled" — a simpler one-header-row sheet with a discrete column per
//     field. Columns are matched by their header text.
//
// In BOTH shapes the scan must treat "<=== TOTAL MALE" as a row to SKIP rather
// than a place to stop: LIS prints that tally between the male and the female
// blocks, so stopping there silently discards every female learner.

import {
  findLearnerHeaderRow,
  extractHeaderContext,
  normText,
} from "../shared/documentDetector.js";
import {
  normalizeHeader,
  normalizeSchoolYear,
} from "../shared/normalization.js";
import { cellText, isBlankRow } from "../shared/excelReader.js";
import {
  METADATA_CELLS,
  HEADER_ROW_TOP,
  SF1_FIELD_COLUMNS,
  isSummaryRow,
  isTerminatorRow,
  isLrnValue,
} from "./sf1Layout.js";

/** Stop scanning after this many consecutive non-learner rows past the table. */
const MAX_TRAILING_NON_LEARNER_ROWS = 40;

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
 * True when the header row carries ONE combined name column, which is the
 * signature of the LIS positional layout.
 */
export function hasCombinedNameColumn(headerRow) {
  if (!Array.isArray(headerRow)) return false;
  return headerRow.some((cell) => {
    const t = cellText(cell).toUpperCase();
    return t.includes("NAME") && t.includes("LAST") && t.includes("FIRST");
  });
}

/** Locate the LRN column on a header row (LIS puts it at index 0). */
function findLrnColumn(headerRow) {
  if (!Array.isArray(headerRow)) return -1;
  for (let c = 0; c < headerRow.length; c++) {
    const t = normText(headerRow[c]);
    if (t === "LRN" || /^LEARNERS?REFERENCENUMBER/.test(t)) return c;
  }
  return -1;
}

/**
 * Tidy a grade-level cell. LIS writes "Grade 7 (Year I)" but the "(Year I)"
 * half spills into a neighbouring merged cell, so what we actually read is the
 * truncated "Grade 7 (Year ". Reduce anything with a number to "Grade N" and
 * leave other text (e.g. "Kinder") alone.
 */
export function canonicalizeGradeLevel(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const m = s.match(/(\d{1,2})/);
  if (!m) return s;
  return `Grade ${parseInt(m[1], 10)}`;
}

/** Read a single metadata cell, tolerating short rows. */
function readCell(rows, row, col) {
  if (row < 0 || row >= rows.length) return "";
  const r = rows[row];
  if (!Array.isArray(r)) return "";
  return cellText(r[col]);
}

/**
 * Read the class metadata from its fixed cells. Positions are resolved relative
 * to the learner header row (LIS keeps the two metadata rows directly above it),
 * which keeps this working if DepEd inserts or removes a title line.
 */
function extractPositionalContext(rows, headerRow) {
  const rowShift = headerRow - HEADER_ROW_TOP;
  const at = (cell) => readCell(rows, cell.row + rowShift, cell.col);

  return {
    schoolId: at(METADATA_CELLS.schoolId),
    schoolName: at(METADATA_CELLS.schoolName),
    region: at(METADATA_CELLS.region),
    division: at(METADATA_CELLS.division),
    district: "",
    schoolYear: at(METADATA_CELLS.schoolYear),
    gradeLevel: at(METADATA_CELLS.gradeLevel),
    section: at(METADATA_CELLS.section),
  };
}

/**
 * Detect the SF1 structure of a worksheet.
 * @param {Object} sheet - worksheet model from excelReader.readWorkbook()
 * @returns {Object} structure with layout, headerRow, columnMap, dataRows,
 *                   context, tallies and warnings
 */
export function detectSF1Structure(sheet) {
  const warnings = [];
  const rows = sheet.rows;
  const headerRow = findLearnerHeaderRow(rows);

  if (headerRow === null) {
    return {
      layout: "unknown",
      headerRow: null,
      columnMap: {},
      dataRows: [],
      dataStartRow: null,
      context: emptyContext(),
      tallies: {},
      warnings: [
        "Could not locate a learner table header (e.g. a column labelled LRN / Learner's Reference Number).",
      ],
    };
  }

  // The LIS positional export and a two-row labeled sheet (e.g. the official
  // SF1 template) can both spell the group heading "NAME (Last Name, First
  // Name, Middle Name)", and both may carry a second header row of sub-labels
  // (LIS folds in House#/Barangay/Father's Name/etc.), so neither trait alone
  // tells them apart. Two more checks narrow it down:
  //  1. if a sub-header row still splits the NAME group into its own
  //     Last/First/Middle columns, the name is NOT really combined; and
  //  2. the merged NAME cell must actually sit where LIS's fixed layout
  //     expects it relative to the LRN column — a compact/synthetic sheet
  //     that merely SPELLS the LIS group heading in a different column
  //     position is not the real fixed-offset export and must not be read
  //     with SF1_FIELD_COLUMNS offsets that would misalign every column.
  const nameSplitBySubHeader = (() => {
    if (!isSubHeaderRow(rows[headerRow + 1])) return false;
    const subMap = buildColumnMap(rows[headerRow + 1]);
    const fields = Object.values(subMap);
    return fields.includes("lastName") && fields.includes("firstName");
  })();
  const nameAtLisOffset = (() => {
    const detected = findLrnColumn(rows[headerRow]);
    const offset = detected > 0 ? detected : 0;
    const nameCell = rows[headerRow][SF1_FIELD_COLUMNS.name + offset];
    const t = cellText(nameCell).toUpperCase();
    return t.includes("NAME") && t.includes("LAST") && t.includes("FIRST");
  })();
  const positional =
    hasCombinedNameColumn(rows[headerRow]) && !nameSplitBySubHeader && nameAtLisOffset;
  const layout = positional ? "positional" : "labeled";

  // --- Column mapping -------------------------------------------------------
  let columnMap;
  let lrnCol;
  let subHeaderRow = false;
  if (positional) {
    // Anchor the fixed layout on the detected LRN column so a sheet that has
    // been shifted sideways still maps correctly.
    const detected = findLrnColumn(rows[headerRow]);
    const offset = detected > 0 ? detected : 0;
    columnMap = {};
    Object.entries(SF1_FIELD_COLUMNS).forEach(([field, col]) => {
      columnMap[col + offset] = field;
    });
    lrnCol = SF1_FIELD_COLUMNS.lrn + offset;
  } else {
    columnMap = buildColumnMap(rows[headerRow]);

    // Fold in the second header row when the form uses a two-row header (the
    // official SF1 spreads "Last Name"/"First Name"/"Barangay"/"Father's Name"
    // sub-labels onto the row beneath the merged group headings). The
    // sub-header wins for the columns it names, except for a bare "Name"
    // (which belongs to the Guardian group, not the learner) — that would
    // otherwise clobber a real mapping from the top row.
    if (isSubHeaderRow(rows[headerRow + 1])) {
      const subMap = buildColumnMap(rows[headerRow + 1]);
      Object.entries(subMap).forEach(([col, field]) => {
        if (field !== "fullName") columnMap[col] = field;
      });
      subHeaderRow = true;
    }

    lrnCol = Number(
      Object.keys(columnMap).find((c) => columnMap[c] === "lrn") ?? -1
    );
    if (!Object.values(columnMap).includes("lrn")) {
      warnings.push("The learner table was found but no LRN column could be identified.");
    }
    if (!Object.values(columnMap).includes("lastName") && !Object.values(columnMap).includes("fullName")) {
      warnings.push("The learner table has no recognized Last Name column.");
    }
  }

  // --- Class metadata -------------------------------------------------------
  // The LIS layout carries its metadata in fixed cells; other layouts spell it
  // out as "Label: value" pairs. Try the positional read first, then fill any
  // blank from the label-based scan so neither shape loses information.
  const labelled = extractHeaderContext(rows.slice(0, headerRow), 15);
  const fixed = positional ? extractPositionalContext(rows, headerRow) : {};
  const pick = (a, b) => (a && String(a).trim() ? String(a).trim() : String(b || "").trim());

  const context = {
    schoolId: pick(fixed.schoolId, labelled.schoolId),
    schoolName: pick(fixed.schoolName, labelled.schoolName),
    region: pick(fixed.region, ""),
    division: pick(fixed.division, labelled.division),
    district: pick(fixed.district, labelled.district),
    schoolYear: normalizeSchoolYear(pick(fixed.schoolYear, labelled.schoolYear)),
    gradeLevel: canonicalizeGradeLevel(pick(fixed.gradeLevel, labelled.grade)),
    section: pick(fixed.section, labelled.section),
  };

  // --- Learner rows ---------------------------------------------------------
  // The header may occupy two rows (LIS positional, or a labeled sheet with a
  // folded sub-header row), so start below whichever of the next rows still
  // looks like header labels rather than learner data.
  const dataStartRow = positional || subHeaderRow ? headerRow + 2 : headerRow + 1;

  const dataRows = [];
  const tallies = {};
  let trailingSkips = 0;

  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r];
    const rowText = Array.isArray(row) ? row.map(cellText).join(" ") : "";

    // The footer region (legend, tally box, signatures) ends the table.
    if (isTerminatorRow(rowText)) break;

    if (!Array.isArray(row) || isBlankRow(row)) {
      // LIS leaves blank rows inside and after the table — never stop on one.
      trailingSkips++;
      if (trailingSkips > MAX_TRAILING_NON_LEARNER_ROWS) break;
      continue;
    }

    // Mid-table tallies ("11  <=== TOTAL MALE") are recorded for reconciliation
    // and then skipped, because the female block follows them.
    if (isSummaryRow(rowText)) {
      recordTally(tallies, row, rowText);
      trailingSkips++;
      if (trailingSkips > MAX_TRAILING_NON_LEARNER_ROWS) break;
      continue;
    }

    const lrnValue = lrnCol >= 0 ? row[lrnCol] : null;
    const looksLikeLearner = positional
      ? isLrnValue(lrnValue) || hasPositionalName(row, columnMap)
      : true;

    if (!looksLikeLearner) {
      trailingSkips++;
      if (trailingSkips > MAX_TRAILING_NON_LEARNER_ROWS) break;
      continue;
    }

    trailingSkips = 0;
    dataRows.push({ cells: row, rowIndex: r });
  }

  if (dataRows.length === 0) {
    warnings.push("No learner rows were found below the table header.");
  }

  return {
    layout,
    headerRow,
    columnMap,
    lrnColumn: lrnCol,
    dataRows,
    dataStartRow,
    context,
    tallies,
    warnings,
  };
}

/** True when the combined NAME cell holds something, even if the LRN is bad. */
function hasPositionalName(row, columnMap) {
  const nameCol = Number(Object.keys(columnMap).find((c) => columnMap[c] === "name") ?? -1);
  if (nameCol < 0) return false;
  return cellText(row[nameCol]) !== "";
}

/**
 * Pull the printed count off a tally row. LIS puts the number BEFORE the label
 * ("11  <=== TOTAL MALE"); other sheets put it after ("TOTAL MALE  = 11"), so
 * look for a standalone numeric cell first and fall back to the first number
 * that follows the label in the row text.
 */
function recordTally(tallies, row, rowText) {
  const cells = row.map(cellText);
  let count = null;
  for (const t of cells) {
    if (/^\d+$/.test(t)) {
      count = parseInt(t, 10);
      break;
    }
  }
  const after = (label) => {
    const m = rowText.toUpperCase().split(label)[1];
    if (!m) return null;
    const n = m.match(/(\d+)/);
    return n ? parseInt(n[1], 10) : null;
  };

  if (/TOTAL\s*MALE/i.test(rowText)) tallies.male = count ?? after("TOTAL MALE");
  else if (/TOTAL\s*FEMALE/i.test(rowText)) tallies.female = count ?? after("TOTAL FEMALE");
  else if (/\bCOMBINED\b/i.test(rowText)) tallies.combined = count ?? after("COMBINED");
}

/**
 * Detect whether a row is a subtotal row (TOTAL MALE / MALE TOTAL / COMBINED).
 * These sit BETWEEN the male and female blocks, so they are skipped, not treated
 * as the end of the learner table. Exported for parseSF1's flat-scan safety net.
 */
export function isSubtotalRow(row) {
  if (!Array.isArray(row)) return false;
  const t = row.map(cellText).join(" ").toUpperCase();
  if (/\bTOTAL\b/.test(t) && /\b(MALE|FEMALE)\b/.test(t)) return true;
  if (/\bCOMBINED\b/.test(t)) return true;
  return false;
}

/**
 * Detect whether a row is SF1 summary/footer/signature content (NOT a learner).
 * Retained for callers that inspect a single row in isolation.
 */
export function isSummaryOrFooterRow(row) {
  if (!Array.isArray(row)) return true;
  const t = row.map(cellText).join(" ");
  return isSummaryRow(t) || isTerminatorRow(t);
}

/** Reconstruct the printed male/female tally, used to cross-check statistics. */
export function findSummaryRow(sheet, headerRow) {
  const rows = sheet.rows;
  const tallies = {};
  let rowIndex = null;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const t = row.map(cellText).join(" ");
    if (isSummaryRow(t)) {
      recordTally(tallies, row, t);
      if (rowIndex === null) rowIndex = r;
    }
  }
  if (tallies.male === undefined && tallies.female === undefined) return null;
  return {
    male: tallies.male ?? null,
    female: tallies.female ?? null,
    raw: `TOTAL MALE ${tallies.male ?? "?"} TOTAL FEMALE ${tallies.female ?? "?"}`,
    rowIndex,
  };
}

function emptyContext() {
  return {
    schoolId: "",
    schoolName: "",
    region: "",
    division: "",
    district: "",
    schoolYear: "",
    gradeLevel: "",
    section: "",
  };
}

export { normText };
