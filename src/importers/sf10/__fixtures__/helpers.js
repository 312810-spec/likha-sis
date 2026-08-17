// src/importers/sf10/__fixtures__/helpers.js
// Builds a workbook laid out like the official DepEd SF10-JHS (Learner's
// Permanent Academic Record). The real form is NOT a table of learners — it is
// one learner per form, written as label/value pairs across several rows:
//
//   LEARNER'S INFORMATION
//   LAST NAME: <v>   FIRST NAME: <v>   NAME EXTENSION: <v>   MIDDLE NAME: <v>
//   LRN: <v>         Date of Birth (mm/dd/yyyy): <v>         Sex: <v>
//
//   SCHOLASTIC RECORD                      <- school context lives BELOW identity
//   School <v>  School ID <v>  District <v>
//   Division <v>  Region <v>  Classified as Grade <v>  Section <v>  School Year <v>
//   LEARNING AREAS | Quarterly Rating | FINAL RATING | REMARKS
//                  |  1 | 2 | 3 | 4   |
//   Filipino       | 85 | 86 | 87 | 88 | 87 | PASSED
//   ...
//   General Average                          | 87
//   REMARKS: PROMOTED TO GRADE 11

import * as XLSX from "xlsx";

export const DEFAULT_AREAS = [
  ["Filipino", 85, 86, 87, 88, 87, "PASSED"],
  ["English", 88, 89, 90, 90, 89, "PASSED"],
  ["Mathematics", 84, 85, 86, 87, 86, "PASSED"],
  ["Science", 86, 87, 88, 88, 87, "PASSED"],
];

export function buildOfficialSF10Workbook(opts = {}) {
  const {
    lrn = "136789012301",
    lastName = "Dela Cruz",
    firstName = "Juan",
    middleName = "Santos",
    nameExtension = "",
    birthDate = "01/15/2010",
    sex = "Male",
    schoolName = "Tingub National High School",
    schoolId = "304212",
    district = "Consolacion",
    division = "Cebu Province",
    grade = "Grade 10",
    section = "Rizal",
    schoolYear = "2026-2027",
    areas = DEFAULT_AREAS,
    generalAverage = 87,
    remarks = "PROMOTED TO GRADE 11",
  } = opts;

  const aoa = [];
  aoa.push(["LEARNER'S PERMANENT ACADEMIC RECORD FOR JUNIOR HIGH SCHOOL", null, null, null, "(SF10-JHS)"]);
  aoa.push([]);
  aoa.push(["LEARNER'S INFORMATION"]);
  aoa.push(["LAST NAME:", lastName, null, "FIRST NAME:", firstName, null, "NAME EXTENSION:", nameExtension, null, "MIDDLE NAME:", middleName]);
  aoa.push(["LRN:", lrn, null, "Date of Birth (mm/dd/yyyy):", birthDate, null, "Sex:", sex]);
  aoa.push([]);
  aoa.push(["SCHOLASTIC RECORD"]);
  aoa.push(["School", schoolName, null, "School ID", schoolId, null, "District", district]);
  aoa.push(["Division", division, null, "Region", "VII", null, "Classified as Grade", grade, null, "Section", section, null, "School Year", schoolYear]);
  aoa.push(["LEARNING AREAS", "Quarterly Rating", null, null, null, "FINAL RATING", "REMARKS"]);
  aoa.push([null, "1", "2", "3", "4", null, null]);
  areas.forEach((a) => aoa.push(a));
  aoa.push(["General Average", null, null, null, null, generalAverage, null]);
  aoa.push(["REMARKS:", remarks]);
  aoa.push([]);
  aoa.push(["Prepared by:", "Signature over Printed Name"]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SF10");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
