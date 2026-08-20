// src/importers/sf1/__fixtures__/helpers.js
// Builds realistic SF1 workbook fixtures in-memory using SheetJS, so the tests
// exercise the real reading/detection/parsing pipeline end-to-end.
//
// Two shapes are provided:
//   buildSF1Workbook()    - a simple one-header-row sheet with a discrete column
//                           per field ("labeled" layout).
//   buildLisSF1Workbook() - the real DepEd LIS export layout
//                           (school_form_1_ver2014.2.1.1): fixed metadata cells,
//                           a two-row header, one combined NAME column, and a
//                           "<=== TOTAL MALE" tally BETWEEN the male and female
//                           blocks. Modelled cell-for-cell on
//                           public/SF1_2026_Grade 7 (Year I) - FAITH.xls.

import * as XLSX from "xlsx";
import { METADATA_CELLS, SF1_FIELD_COLUMNS } from "../sf1Layout.js";

// Classic SF1 column order (0-based). Header text uses real DepEd variations so
// the normalization aliases are exercised.
const HEADERS = [
  "Learner's Reference Number (LRN)",
  "Last Name",
  "First Name",
  "Middle Name",
  "Name Extension",
  "Sex",
  "Birth Date",
  "Age",
  "Religion",
  "Address",
  "Father's Name",
  "Mother's Name",
  "Guardian",
  "Contact Number",
  "Learning Modality",
  "Remarks",
];

/**
 * Build an SF1 workbook ArrayBuffer.
 * @param {Object} opts
 * @param {Array<Array>} opts.learners - rows matching HEADERS order
 * @param {Object} opts.opts - overrides for context strings
 */
export function buildSF1Workbook(opts = {}) {
  const {
    learners = [],
    schoolId = "304212",
    schoolName = "Tingub National High School",
    division = "Division of Cebu Province",
    district = "District of Consolacion",
    grade = "Grade 10",
    section = "Rizal",
    schoolYear = "SY 2026-2027",
    summary = null, // { male, female } to print on summary rows; null = skip
    includeTitle = true,
  } = opts;

  const aoa = [];
  aoa.push(["Republic of the Philippines"]);
  aoa.push(["Department of Education"]);
  aoa.push([schoolName, "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
  aoa.push([`School ID: ${schoolId}`, "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
  aoa.push([`Division: ${division}`, "", "", "", `District: ${district}`]);
  aoa.push([
    `GRADE LEVEL: ${grade}`,
    "",
    "",
    "",
    `SECTION: ${section}`,
    "",
    `SCHOOL YEAR: ${schoolYear}`,
  ]);
  if (includeTitle) {
    aoa.push(["LEARNER'S INFORMATION SHEET (SF1)"]);
  }
  aoa.push(HEADERS);

  learners.forEach((l) => aoa.push(l));

  if (summary) {
    aoa.push([]);
    aoa.push(["TOTAL MALE", `= ${summary.male}`]);
    aoa.push(["TOTAL FEMALE", `= ${summary.female}`]);
    aoa.push(["COMBINED", `= ${summary.male + summary.female}`]);
    aoa.push(["Prepared by:", "Signature over Printed Name"]);
    aoa.push(["Checked by:", "Signature over Printed Name"]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SF1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

/** Convenience: a standard, valid learner row. */
export function learner({
  lrn = "136789012345",
  lastName = "Dela Cruz",
  firstName = "Juan",
  middleName = "Santos",
  ext = "",
  sex = "M",
  birthDate = "2010-01-15",
  age = 14,
  religion = "Roman Catholic",
  address = "Tingub, Consolacion",
  father = "Pedro Dela Cruz",
  mother = "Maria Santos Dela Cruz",
  guardian = "Maria Santos Dela Cruz",
  contact = "09171234567",
  modality = "Face to Face",
  remarks = "",
} = {}) {
  return [
    lrn, lastName, firstName, middleName, ext, sex, birthDate, age,
    religion, address, father, mother, guardian, contact, modality, remarks,
  ];
}

/** LRN as a 12-digit number (consistent with number-formatted Excel cells). */
export function asNumericLrn(lrn) {
  return parseInt(lrn, 10);
}

// ---------------------------------------------------------------------------
// Official DepEd SF1 layout
// ---------------------------------------------------------------------------
// The real School Form 1 does NOT use the flat single-row header above. It uses
// a TWO-ROW header with merged cells: the top row carries "LRN", a merged
// "NAME (Last Name, First Name, Middle Name)" spanning three columns, and
// parenthetically-qualified labels like "Sex (M/F)"; the second row carries the
// sub-headers ("Last Name", "First Name", "Middle Name") that actually name the
// columns. SheetJS surfaces a merged cell's value only in its top-left cell, so
// the spanned cells read back as null — reproduced faithfully here.

/** The official SF1 two-row header, as SheetJS reads it back from merged cells. */
export const OFFICIAL_HEADER_TOP = [
  "LRN",
  "NAME (Last Name, First Name, Middle Name)", null, null,
  "Sex (M/F)",
  "Birth Date (mm/dd/yyyy)",
  "Age as of October 31",
  "Mother Tongue",
  "IP (Ethnic Group)",
  "Religion",
  "Address", null, null, null,
  "Parents", null,
  "Guardian", null,
  "Contact Number of Parent or Guardian",
  "Remarks",
];

export const OFFICIAL_HEADER_SUB = [
  null,
  "Last Name", "First Name", "Middle Name",
  null, null, null, null, null, null,
  "House#/Street/Sitio/Purok", "Barangay", "Municipality/City", "Province",
  "Father's Name", "Mother's Maiden Name",
  "Name", "Relationship",
  null, null,
];

/** A learner row in official SF1 column order. */
export function officialLearner({
  lrn = "136789012301",
  lastName = "Dela Cruz",
  firstName = "Juan",
  middleName = "Santos",
  sex = "M",
  birthDate = "01/15/2010",
  age = 15,
} = {}) {
  return [
    lrn, lastName, firstName, middleName, sex, birthDate, age,
    "Cebuano", "", "Roman Catholic",
    "Purok 1", "Tingub", "Consolacion", "Cebu",
    `Pedro ${lastName}`, `Maria ${lastName}`,
    `Maria ${lastName}`, "Mother",
    "09171234567", "",
  ];
}

/**
 * Build a workbook laid out like the official DepEd SF1 School Register:
 * school header block, two-row merged learner header, a MALE block, a
 * "MALE | TOTAL" separator, a FEMALE block, then the signature footer.
 *
 * @param {Object} opts
 * @param {Array<Array>} opts.males   - rows from officialLearner()
 * @param {Array<Array>} opts.females - rows from officialLearner()
 * @param {boolean} opts.blankBetweenBlocks - insert a blank spacer row between
 *   the male and female blocks (many real templates carry one).
 * @param {boolean} opts.singleNameColumn - drop the sub-header row and pack the
 *   whole name into the merged NAME column as "Last, First Middle".
 */
export function buildOfficialSF1Workbook(opts = {}) {
  const {
    males = [],
    females = [],
    schoolId = "304212",
    schoolName = "Tingub National High School",
    division = "Cebu Province",
    district = "Consolacion",
    grade = "Grade 10",
    section = "Rizal",
    schoolYear = "2026-2027",
    blankBetweenBlocks = false,
    singleNameColumn = false,
  } = opts;

  const aoa = [];
  aoa.push(["School Form 1 (SF1) School Register"]);
  aoa.push(["(This form shall be accomplished at the beginning of the school year)"]);
  aoa.push([]);
  aoa.push(["School ID", schoolId, null, "Region", "Region VII", null, "Division", division, null, "District", district]);
  aoa.push(["School Name", schoolName, null, "School Year", schoolYear, null, "Grade Level", grade, null, "Section", section]);
  aoa.push([]);

  if (singleNameColumn) {
    // Variant: one merged NAME column, no sub-header row. Each learner's name
    // arrives as a single "Last, First Middle" string.
    aoa.push(OFFICIAL_HEADER_TOP);
    const collapse = (r) => {
      const [lrn, last, first, mid, ...rest] = r;
      return [lrn, `${last}, ${first} ${mid}`.trim(), null, null, ...rest];
    };
    males.forEach((m) => aoa.push(collapse(m)));
    females.forEach((f) => aoa.push(collapse(f)));
  } else {
    aoa.push(OFFICIAL_HEADER_TOP);
    aoa.push(OFFICIAL_HEADER_SUB);
    males.forEach((m) => aoa.push(m));
    if (males.length) aoa.push(["MALE | TOTAL", males.length]);
    if (blankBetweenBlocks) aoa.push([]);
    females.forEach((f) => aoa.push(f));
    if (females.length) aoa.push(["FEMALE | TOTAL", females.length]);
  }

  aoa.push([]);
  aoa.push(["Prepared by:", "Signature over Printed Name"]);
  aoa.push(["Checked by:", "Signature over Printed Name"]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SF1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

// ---------------------------------------------------------------------------
// The real DepEd LIS export layout
// ---------------------------------------------------------------------------

/** Place a value at a fixed column of a sparse row. */
function put(row, col, value) {
  while (row.length < col) row.push(null);
  row[col] = value;
  return row;
}

/**
 * A LIS learner row: one combined NAME cell plus fixed-position demographics.
 * Field names match sf1Layout.SF1_FIELD_COLUMNS.
 */
export function lisLearner(values = {}) {
  const row = [];
  Object.entries(values).forEach(([field, value]) => {
    const col = SF1_FIELD_COLUMNS[field];
    if (col !== undefined && value !== undefined && value !== null) put(row, col, value);
  });
  return row;
}

/**
 * Build a workbook in the real LIS SF1 shape.
 * @param {Object} opts
 * @param {Array} opts.males   - rows from lisLearner()
 * @param {Object} opts.females
 */
export function buildLisSF1Workbook(opts = {}) {
  const {
    males = [],
    females = [],
    schoolId = "312810",
    schoolName = "Tingub National High School",
    region = "Region VII",
    division = "Mandaue City",
    schoolYear = "2026 - 2027",
    // LIS truncates this cell — the "(Year I)" half spills into a merged
    // neighbour and is lost on export.
    gradeLevel = "Grade 7 (Year ",
    section = "FAITH",
    includeFooter = true,
  } = opts;

  const aoa = [];
  aoa.push(["School Form 1 (SF 1) School Register"]);
  aoa.push(["(This replaces  Form 1, Master List & STS Form 2-Family Background and Profile)"]);

  // Metadata rows 2 and 3, at their fixed columns.
  const meta2 = put(put(put([], METADATA_CELLS.schoolId.col, schoolId), METADATA_CELLS.region.col, region), METADATA_CELLS.division.col, division);
  put(meta2, 0, "School ID ");
  put(meta2, 16, "Division ");
  aoa.push(meta2);

  const meta3 = put([], METADATA_CELLS.schoolName.col, schoolName);
  put(meta3, 0, "School Name ");
  put(meta3, METADATA_CELLS.schoolYear.col, schoolYear);
  put(meta3, 16, "School Year ");
  put(meta3, METADATA_CELLS.gradeLevel.col, gradeLevel);
  put(meta3, 25, "Grade Level ");
  put(meta3, METADATA_CELLS.section.col, section);
  put(meta3, 35, "Section ");
  aoa.push(meta3);

  // Two-row header. The combined NAME cell is what marks this as LIS layout.
  const head1 = [];
  put(head1, 0, "LRN");
  put(head1, 2, "NAME\n(Last Name, First Name, Middle Name)");
  put(head1, 6, "Sex (M/F)");
  put(head1, 7, "BIRTH DATE\n(mm/dd/yyyy)");
  put(head1, 9, "AGE as of 1st Friday June");
  put(head1, 11, "MOTHER TONGUE (Grade 1 to 3 Only)");
  put(head1, 13, "IP\n(Ethnic Group)");
  put(head1, 14, "RELIGION");
  put(head1, 15, "ADDRESS");
  put(head1, 27, "PARENTS");
  put(head1, 36, "GUARDIAN\n(if Not Parent)");
  put(head1, 41, "Contact Number of Parent or Guardian");
  put(head1, 43, "Learning Modality");
  put(head1, 44, "REMARKS");
  aoa.push(head1);

  const head2 = [];
  put(head2, 15, "House #/ Street/ Sitio/ Purok");
  put(head2, 17, "Barangay");
  put(head2, 20, "Municipality/ City");
  put(head2, 22, "Province");
  put(head2, 27, "Father's Name (Last Name, First Name, Middle Name)     ");
  put(head2, 31, "Mother's Maiden Name (Last Name, First Name, Middle Name)");
  put(head2, 36, "Name");
  put(head2, 40, "Relationship");
  put(head2, 44, "(Please refer to the legend on last page)");
  aoa.push(head2);

  // Male block, then the mid-table tally, then the female block.
  males.forEach((r) => aoa.push(r));
  aoa.push(put(put([], 0, males.length), 2, "<=== TOTAL MALE"));
  females.forEach((r) => aoa.push(r));
  aoa.push(put(put([], 0, females.length), 2, "<=== TOTAL FEMALE"));
  aoa.push(put(put([], 0, males.length + females.length), 2, "<=== COMBINED"));

  if (includeFooter) {
    aoa.push(["List and Code of Indicators under REMARKS column"]);
    const legendHead = [];
    put(legendHead, 0, "Indicator");
    put(legendHead, 1, "Code");
    put(legendHead, 3, "Required Information");
    put(legendHead, 30, "Prepared by;");
    put(legendHead, 39, "Certified Correct:");
    aoa.push(legendHead);
    aoa.push(put([], 30, "JUANA CRUZ SANTOS"));
    aoa.push(put([], 39, "Generated thru LIS"));
    aoa.push(["Generated on: Saturday, August 15, 2026"]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "school_form_1_ver2014.2.1.1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
