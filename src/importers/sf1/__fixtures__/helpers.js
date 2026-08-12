// src/importers/sf1/__fixtures__/helpers.js
// Builds realistic SF1 workbook fixtures in-memory using SheetJS, so the tests
// exercise the real reading/detection/parsing pipeline end-to-end. No real DepEd
// SF1 files were available in the repository, so these fixtures mirror the
// official layout: school header block, merged title, learner header, data rows,
// then TOTAL MALE / TOTAL FEMALE / COMBINED summary rows.

import * as XLSX from "xlsx";

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
