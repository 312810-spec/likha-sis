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
