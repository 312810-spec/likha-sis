// src/importers/sf1/sf1Layout.js
// The canonical geometry of a DepEd LIS "School Form 1 (SF 1) School Register"
// export (school_form_1_ver2014.2.1.1). This is the single source of truth used
// by BOTH the import parser and the print engine, so a column can never drift
// between the two.
//
// Every row/column index here is 0-BASED, matching the array-of-arrays produced
// by shared/excelReader.js. Note that DepEd's own documentation numbers these
// 1-based, so "School ID on row 3 / column 6" is { row: 2, col: 5 } here.

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
 * The 47 underlying columns of the official DepEd SF1 Excel grid.
 * Widths in pixels (matching source workbook column width ratios).
 */
export const SF1_47_COL_WIDTHS = [
  120, // c0: LRN (Part 1)
  20,  // c1: LRN (Part 2)
  20,  // c2: Learner Name (Part 1)
  44,  // c3: Learner Name (Part 2)
  116, // c4: Learner Name (Part 3)
  60,  // c5: Learner Name (Part 4)
  30,  // c6: Sex (M/F)
  70,  // c7: Birth Date (Part 1)
  40,  // c8: Birth Date (Part 2)
  20,  // c9: Age (Part 1)
  30,  // c10: Age (Part 2)
  30,  // c11: Mother Tongue (Part 1)
  40,  // c12: Mother Tongue (Part 2)
  70,  // c13: IP (Ethnic Group)
  70,  // c14: Religion
  40,  // c15: House # / Street / Sitio (Part 1)
  50,  // c16: House # / Street / Sitio (Part 2)
  86,  // c17: Barangay (Part 1)
  4,   // c18: Barangay (Part 2)
  10,  // c19: Barangay (Part 3)
  10,  // c20: Municipality / City (Part 1)
  90,  // c21: Municipality / City (Part 2)
  10,  // c22: Province (Part 1)
  28,  // c23: Province (Part 2)
  2,   // c24: Province (Part 3)
  30,  // c25: Province (Part 4)
  40,  // c26: Province (Part 5)
  20,  // c27: Father's Name (Part 1)
  18,  // c28: Father's Name (Part 2)
  2,   // c29: Father's Name (Part 3)
  82,  // c30: Father's Name (Part 4)
  38,  // c31: Mother's Maiden Name (Part 1)
  2,   // c32: Mother's Maiden Name (Part 2)
  18,  // c33: Mother's Maiden Name (Part 3)
  30,  // c34: Mother's Maiden Name (Part 4)
  32,  // c35: Mother's Maiden Name (Part 5)
  78,  // c36: Guardian Name (Part 1)
  10,  // c37: Guardian Name (Part 2)
  10,  // c38: Guardian Name (Part 3)
  18,  // c39: Guardian Name (Part 4)
  88,  // c40: Guardian Relationship
  38,  // c41: Contact Number (Part 1)
  36,  // c42: Contact Number (Part 2)
  94,  // c43: Learning Modality
  22,  // c44: Remarks (Part 1)
  86,  // c45: Remarks (Part 2)
  2,   // c46: Spacer/Padding
];

export const SF1_47_TOTAL_WIDTH = SF1_47_COL_WIDTHS.reduce((sum, w) => sum + w, 0);

export const SF1_47_COL_PERCENTS = SF1_47_COL_WIDTHS.map((w) => (w / SF1_47_TOTAL_WIDTH) * 100);

/**
 * The 19 logical columns of the SF1 learner table mapped across the 47 Excel columns.
 */
export const SF1_COLUMNS = [
  { field: "lrn", col: 0, endCol: 1, colSpan: 2, width: 140, label: "LRN" },
  { field: "name", col: 2, endCol: 5, colSpan: 4, width: 240, label: "NAME\n(Last Name, First Name, Middle Name)" },
  { field: "sex", col: 6, endCol: 6, colSpan: 1, width: 30, label: "Sex (M/F)" },
  { field: "birthDate", col: 7, endCol: 8, colSpan: 2, width: 110, label: "BIRTH DATE\n(mm/dd/yyyy)" },
  { field: "age", col: 9, endCol: 10, colSpan: 2, width: 50, label: "AGE as of 1st Friday June" },
  { field: "motherTongue", col: 11, endCol: 12, colSpan: 2, width: 70, label: "MOTHER TONGUE (Grade 1 to 3 Only)" },
  { field: "ipEthnicGroup", col: 13, endCol: 13, colSpan: 1, width: 70, label: "IP\n(Ethnic Group)" },
  { field: "religion", col: 14, endCol: 14, colSpan: 1, width: 70, label: "RELIGION" },
  { field: "houseStreetSitio", col: 15, endCol: 16, colSpan: 2, width: 90, label: "House #/ Street/ Sitio/ Purok" },
  { field: "barangay", col: 17, endCol: 19, colSpan: 3, width: 100, label: "Barangay" },
  { field: "municipalityCity", col: 20, endCol: 21, colSpan: 2, width: 100, label: "Municipality/ City" },
  { field: "province", col: 22, endCol: 26, colSpan: 5, width: 110, label: "Province" },
  { field: "fathersName", col: 27, endCol: 30, colSpan: 4, width: 122, label: "Father's Name (Last Name, First Name, Middle Name)" },
  { field: "mothersMaidenName", col: 31, endCol: 35, colSpan: 5, width: 120, label: "Mother's Maiden Name (Last Name, First Name, Middle Name)" },
  { field: "guardianName", col: 36, endCol: 39, colSpan: 4, width: 116, label: "Name" },
  { field: "guardianRelationship", col: 40, endCol: 40, colSpan: 1, width: 88, label: "Relationship" },
  { field: "contactNumber", col: 41, endCol: 42, colSpan: 2, width: 74, label: "Contact Number of Parent or Guardian" },
  { field: "learningModality", col: 43, endCol: 43, colSpan: 1, width: 94, label: "Learning Modality" },
  { field: "remarks", col: 44, endCol: 45, colSpan: 2, width: 108, label: "REMARKS" },
];

/** Total width of the learner table in source-workbook pixels. */
export const SF1_TOTAL_WIDTH = SF1_47_TOTAL_WIDTH;

/**
 * Column widths as percentages of the table, for the print `<colgroup>`.
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
 * A learner row is identified by a 12-digit LRN in the LRN column.
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
