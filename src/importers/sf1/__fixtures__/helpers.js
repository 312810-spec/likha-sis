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
    aoa.push(put([], 30, "KAREN MAE PARAGSA CABAHUG"));
    aoa.push(put([], 39, "Generated thru LIS"));
    aoa.push(["Generated on: Saturday, August 15, 2026"]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "school_form_1_ver2014.2.1.1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
