// src/importers/sf1/sf1Layout.js
// The canonical geometry of a DepEd LIS "School Form 1 (SF 1) School Register"
// export (school_form_1_ver2014.2.1.1). This is the single source of truth used
// by BOTH the import parser and the print engine, so a column can never drift
// between the two.
//
// Every row/column index here is 0-BASED, matching the array-of-arrays produced
// by shared/excelReader.js. Note that DepEd's own documentation numbers these
// 1-based, so "School ID on row 3 / column 6" is { row: 2, col: 5 } here.
//
// The widths come from the `!cols` metadata of a real LIS export and are what
// makes the printed HTML replica line up with the official sheet.

/** Where the class metadata sits in the header block, as fixed cells. */
export const METADATA_CELLS = {
  schoolId: { row: 2, col: 5 },
  region: { row: 2, col: 10 },
  division: { row: 2, col: 19 },
  schoolName: { row: 3, col: 5 },
  schoolYear: { row: 3, col: 19 },
  gradeLevel: { row: 3, col: 30 },
  section: { row: 3, col: 38 },
};

/** The learner table header occupies two rows; data begins right after them. */
export const HEADER_ROW_TOP = 4;
export const HEADER_ROW_BOTTOM = 5;
export const DATA_START_ROW = 6;

/**
 * The 19 logical columns of the SF1 learner table.
 *
 * `col` is the column the value is read from (the first column of the merged
 * range). `span` is the merged range end, used to compute print widths.
 * `width` is the summed pixel width of the merged range in the source workbook.
 */
export const SF1_COLUMNS = [
  { field: "lrn", col: 0, endCol: 1, width: 153, label: "LRN" },
  { field: "name", col: 2, endCol: 5, width: 263, label: "NAME\n(Last Name, First Name, Middle Name)" },
  { field: "sex", col: 6, endCol: 6, width: 33, label: "Sex (M/F)" },
  { field: "birthDate", col: 7, endCol: 8, width: 120, label: "BIRTH DATE\n(mm/dd/yyyy)" },
  { field: "age", col: 9, endCol: 10, width: 55, label: "AGE as of 1st Friday June" },
  { field: "motherTongue", col: 11, endCol: 12, width: 77, label: "MOTHER TONGUE (Grade 1 to 3 Only)" },
  { field: "ipEthnicGroup", col: 13, endCol: 13, width: 76, label: "IP\n(Ethnic Group)" },
  { field: "religion", col: 14, endCol: 14, width: 76, label: "RELIGION" },
  { field: "houseStreetSitio", col: 15, endCol: 16, width: 99, label: "House #/ Street/ Sitio/ Purok" },
  { field: "barangay", col: 17, endCol: 19, width: 109, label: "Barangay" },
  { field: "municipalityCity", col: 20, endCol: 21, width: 109, label: "Municipality/ City" },
  { field: "province", col: 22, endCol: 26, width: 121, label: "Province" },
  { field: "fathersName", col: 27, endCol: 30, width: 134, label: "Father's Name (Last Name, First Name, Middle Name)" },
  { field: "mothersMaidenName", col: 31, endCol: 35, width: 131, label: "Mother's Maiden Name (Last Name, First Name, Middle Name)" },
  { field: "guardianName", col: 36, endCol: 39, width: 127, label: "Name" },
  { field: "guardianRelationship", col: 40, endCol: 40, width: 96, label: "Relationship" },
  { field: "contactNumber", col: 41, endCol: 42, width: 80, label: "Contact Number of Parent or Guardian" },
  { field: "learningModality", col: 43, endCol: 43, width: 103, label: "Learning Modality" },
  { field: "remarks", col: 44, endCol: 45, width: 118, label: "REMARKS" },
];

/** Total width of the learner table in source-workbook pixels. */
export const SF1_TOTAL_WIDTH = SF1_COLUMNS.reduce((sum, c) => sum + c.width, 0);

/**
 * Column widths as percentages of the table, for the print `<colgroup>`.
 * Using percentages (rather than fixed inches) lets the same markup fill a
 * legal-landscape page exactly while still holding the official proportions.
 */
export const SF1_COLUMN_PERCENTS = SF1_COLUMNS.map((c) => ({
  field: c.field,
  percent: (c.width / SF1_TOTAL_WIDTH) * 100,
}));

/** Map of field -> source column index, for positional parsing. */
export const SF1_FIELD_COLUMNS = SF1_COLUMNS.reduce((acc, c) => {
  acc[c.field] = c.col;
  return acc;
}, {});

/**
 * Text fragments that mark a row as summary / legend / signature content rather
 * than a learner. Matched case-insensitively against the joined row text.
 *
 * IMPORTANT: `<=== TOTAL MALE` appears in the MIDDLE of the table (between the
 * male and female blocks), so matching one of these must SKIP the row, not stop
 * the scan. Only TERMINATORS below end the learner table.
 */
export const SUMMARY_ROW_PATTERNS = [
  /TOTAL\s*MALE/i,
  /TOTAL\s*FEMALE/i,
  /\bCOMBINED\b/i,
];

/**
 * Text fragments that mark the true end of the learner table. Everything from
 * the first matching row onward is legend, tally, or signature block.
 */
export const TERMINATOR_ROW_PATTERNS = [
  /LIST AND CODE OF INDICATORS/i,
  /^\s*INDICATOR\s*$/i,
  /REQUIRED INFORMATION/i,
  /PREPARED BY/i,
  /CERTIFIED CORRECT/i,
  /GENERATED THRU LIS/i,
  /GENERATED ON:/i,
  /SIGNATURE OF (SCHOOL HEAD|ADVISER)/i,
  /BOSY DATE/i,
  /EOSY DATE/i,
];

/** True when the row is a mid-table summary tally that must be skipped. */
export function isSummaryRow(rowText) {
  return SUMMARY_ROW_PATTERNS.some((re) => re.test(rowText));
}

/** True when the row starts the footer region and the learner scan must stop. */
export function isTerminatorRow(rowText) {
  return TERMINATOR_ROW_PATTERNS.some((re) => re.test(rowText));
}

/**
 * A learner row is identified by a 12-digit LRN in the LRN column. This is the
 * single hard gate that keeps titles, legends, tallies and signature lines out
 * of the imported data.
 */
export function isLrnValue(value) {
  if (value === null || value === undefined) return false;
  const digits = String(value).replace(/\D/g, "");
  return /^\d{12}$/.test(digits);
}

/** The indicator legend printed under the REMARKS column on the official form. */
export const REMARKS_INDICATORS = [
  { indicator: "Transferred Out", code: "T/O", info: "Name of Public (P) Private (PR) School & Effectivity Date" },
  { indicator: "Transferred In", code: "T/I", info: "Name of Public (P) Private (PR) School & Effectivity Date" },
  { indicator: "Dropped", code: "DRP", info: "Reason and Effectivity Date" },
  { indicator: "Late Enrollment", code: "LE", info: "Reason (Enrollment beyond 1st Friday of SY)" },
];

export const REMARKS_INDICATORS_RIGHT = [
  { indicator: "CCT Recipient", code: "CCT", info: "CCT Control/reference number & Effectivity Date" },
  { indicator: "Balik Aral", code: "B/A", info: "Name of school last attended & Year" },
  { indicator: "Special Needs Education", code: "SNED", info: "Specify" },
  { indicator: "Accelerated", code: "ACL", info: "Specify Level & Effectivity Date" },
];

/**
 * Per-column widths of the underlying LIS sheet, columns 0-45, as percentages of
 * the printable width. The register table merges these into 19 logical columns
 * (SF1_COLUMN_PERCENTS); the title block and the footer instead lay themselves
 * out on this raw 46-column grid, because their merges (School ID at c0-4, the
 * REGISTERED tally at c21-27, the signature block at c30-46 …) do not line up
 * with the register's column boundaries. Both grids total 100%, so the three
 * tables stay in register with one another on the printed page.
 */
export const SF1_GRID_PERCENTS = [
  6.2981, 1.0577, 1.0577, 2.3077, 6.1058, 3.1731, 1.5865, 3.6538, 2.1154,
  1.0577, 1.5865, 1.5865, 2.1154, 3.6538, 3.6538, 2.1154, 2.6442, 4.5192,
  0.1923, 0.5288, 0.5288, 4.7115, 0.5288, 1.4904, 0.0962, 1.5865, 2.1154,
  1.0577, 0.9615, 0.0962, 4.3269, 1.9712, 0.0962, 0.9615, 1.5865, 1.6827,
  4.0865, 0.5288, 0.5288, 0.9615, 4.6154, 1.9712, 1.875, 4.9519, 1.1538,
  4.5192,
];

/** Row heights (px) of the title band, LIS rows 1-6 (0-based rows 0-5). */
export const SF1_TITLE_ROW_HEIGHTS = [30, 20, 20, 20, 25, 40];
