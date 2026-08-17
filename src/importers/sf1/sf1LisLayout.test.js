// src/importers/sf1/sf1LisLayout.test.js
// Covers the real DepEd LIS export layout (school_form_1_ver2014.2.1.1): fixed
// metadata cells, a two-row header, the single combined NAME column, and the
// "<=== TOTAL MALE" tally that sits BETWEEN the male and the female blocks.
//
// PRIVACY: every learner below is INVENTED. The layout quirks are copied from a
// real LIS export, but its learner records must never be — they are the names,
// LRNs, birth dates and parents of real minors, protected under the Philippine
// Data Privacy Act. Reproduce the file's SHAPE, never its people.

import { describe, it, expect } from "vitest";
import { readWorkbook } from "../shared/excelReader.js";
import { detectSF1Structure, canonicalizeGradeLevel } from "./detectSF1Structure.js";
import { parseSF1 } from "./parseSF1.js";
import { normalizeSF1 } from "./normalizeSF1.js";
import { processSF1Buffer } from "./importSF1.js";
import { parsePersonName, formatPersonName, extractSuffix } from "../shared/nameParser.js";
import { isLrnValue, isSummaryRow, isTerminatorRow, SF1_COLUMNS } from "./sf1Layout.js";
import { buildLisSF1Workbook, lisLearner } from "./__fixtures__/helpers.js";

/** Two males and one female, in the shape of a LIS register (invented people). */
function sampleWorkbook(overrides = {}) {
  return buildLisSF1Workbook({
    males: [
      lisLearner({
        lrn: "900000000018",
        name: "SANTIAGO,MARIA ELENA, RIVERA",
        sex: "M",
        birthDate: "05-14-2013",
        age: "13 ",
        motherTongue: "Cebuano / Sinugbuanong Binisay",
        religion: "Christianity",
        barangay: "TINGUB",
        municipalityCity: "MANDAUE CITY",
        province: "CEBU",
        fathersName: "SANTIAGO, RODRIGO CRUZ",
        mothersMaidenName: "RIVERA,TERESA,MENDOZA,",
        learningModality: "Face to Face",
        remarks: "T/I DATE:2026-06-08",
      }),
      lisLearner({
        lrn: "900000000057",
        name: "DELGADO,RAMON, JR. SALAZAR",
        sex: "M",
        birthDate: "11-02-2012",
        age: "13 ",
        religion: "Christianity",
        barangay: "TINGUB",
        municipalityCity: "MANDAUE CITY",
        province: "CEBU",
        learningModality: "Face to Face",
      }),
    ],
    females: [
      lisLearner({
        lrn: "900000000012",
        name: "GARCIA,ROSA LINDA, -",
        sex: "F",
        birthDate: "08-19-2013",
        age: "12 ",
        religion: "Christianity",
        barangay: "PAGSABUNGAN",
        municipalityCity: "MANDAUE CITY",
        province: "CEBU",
        guardianName: "GARCIA, LILIA",
        guardianRelationship: "Mother",
        contactNumber: "09171234567",
        learningModality: "Face to Face",
      }),
    ],
    ...overrides,
  });
}

describe("SF1 layout constants", () => {
  it("describes all 19 official columns without a gap or overlap", () => {
    expect(SF1_COLUMNS).toHaveLength(19);
    for (let i = 1; i < SF1_COLUMNS.length; i++) {
      // Each column starts exactly where the previous merged range ended.
      expect(SF1_COLUMNS[i].col).toBe(SF1_COLUMNS[i - 1].endCol + 1);
    }
  });

  it("accepts only 12-digit LRNs as learner-row markers", () => {
    expect(isLrnValue("900000000018")).toBe(true);
    expect(isLrnValue(900000000018)).toBe(true);
    expect(isLrnValue("900-000-000-018")).toBe(true);
    expect(isLrnValue("12345")).toBe(false);
    expect(isLrnValue("<=== TOTAL MALE")).toBe(false);
    expect(isLrnValue(null)).toBe(false);
  });

  it("separates mid-table tallies from true end-of-table markers", () => {
    expect(isSummaryRow("11 <=== TOTAL MALE")).toBe(true);
    expect(isTerminatorRow("11 <=== TOTAL MALE")).toBe(false);
    expect(isTerminatorRow("List and Code of Indicators under REMARKS column")).toBe(true);
    expect(isTerminatorRow("Generated thru LIS")).toBe(true);
    expect(isTerminatorRow("Certified Correct:")).toBe(true);
  });
});

describe("combined name parsing", () => {
  it("splits the LIS learner form LAST,FIRST, MIDDLE", () => {
    expect(parsePersonName("SANTIAGO,MARIA ELENA, RIVERA")).toMatchObject({
      lastName: "SANTIAGO",
      firstName: "MARIA ELENA",
      middleName: "RIVERA",
      nameExtension: "",
    });
  });

  it("treats a '-' placeholder as an absent middle name, keeping both given names", () => {
    expect(parsePersonName("BAUTISTA,ANA MARIE, -")).toMatchObject({
      lastName: "BAUTISTA",
      firstName: "ANA MARIE",
      middleName: "",
    });
  });

  it("pulls a name extension out of the middle segment", () => {
    expect(parsePersonName("DELGADO,RAMON, JR. SALAZAR")).toMatchObject({
      lastName: "DELGADO",
      firstName: "RAMON",
      middleName: "SALAZAR",
      nameExtension: "JR.",
    });
    expect(parsePersonName("MERCADO,LUIS MIGUEL, III NAVARRO")).toMatchObject({
      lastName: "MERCADO",
      firstName: "LUIS MIGUEL",
      middleName: "NAVARRO",
      nameExtension: "III",
    });
  });

  it("ignores trailing empty segments", () => {
    expect(parsePersonName("TOLENTINO,CARMEN,,")).toMatchObject({
      lastName: "TOLENTINO",
      firstName: "CARMEN",
      middleName: "",
    });
    expect(parsePersonName("RIVERA,TERESA,MENDOZA,")).toMatchObject({
      lastName: "RIVERA",
      firstName: "TERESA",
      middleName: "MENDOZA",
    });
  });

  it("reads the single-comma parent form LAST, FIRST MIDDLE [SUFFIX]", () => {
    expect(parsePersonName("SANTIAGO, RODRIGO CRUZ")).toMatchObject({
      lastName: "SANTIAGO",
      firstName: "RODRIGO",
      middleName: "CRUZ",
    });
    expect(parsePersonName("MERCADO, ROMEO VILLAR JR")).toMatchObject({
      lastName: "MERCADO",
      firstName: "ROMEO",
      middleName: "VILLAR",
      nameExtension: "JR",
    });
    expect(parsePersonName("AQUINO, ARIEL -")).toMatchObject({
      lastName: "AQUINO",
      firstName: "ARIEL",
      middleName: "",
    });
  });

  it("handles empty and placeholder-only values", () => {
    expect(parsePersonName("")).toMatchObject({ lastName: "", firstName: "" });
    expect(parsePersonName(null)).toMatchObject({ lastName: "", firstName: "" });
    expect(parsePersonName("-")).toMatchObject({ lastName: "", firstName: "" });
  });

  it("never strips a lone token that happens to be a suffix", () => {
    expect(extractSuffix("JR")).toMatchObject({ suffix: "", rest: "JR" });
    expect(extractSuffix("RAMON JR")).toMatchObject({ suffix: "JR", rest: "RAMON" });
  });

  it("renders names back into the official display form", () => {
    expect(
      formatPersonName({ lastName: "DELGADO", firstName: "RAMON", middleName: "SALAZAR", nameExtension: "JR." })
    ).toBe("DELGADO, RAMON JR. SALAZAR");
  });
});

describe("LIS positional structure detection", () => {
  it("recognizes the LIS layout and reads metadata from its fixed cells", () => {
    const { sheets } = readWorkbook(sampleWorkbook());
    const structure = detectSF1Structure(sheets[0]);

    expect(structure.layout).toBe("positional");
    expect(structure.headerRow).toBe(4);
    expect(structure.dataStartRow).toBe(6);
    expect(structure.context).toMatchObject({
      schoolId: "312810",
      schoolName: "Tingub National High School",
      region: "Region VII",
      division: "Mandaue City",
      schoolYear: "2026-2027",
      section: "FAITH",
    });
  });

  it("repairs the grade level cell that LIS truncates on export", () => {
    expect(canonicalizeGradeLevel("Grade 7 (Year ")).toBe("Grade 7");
    expect(canonicalizeGradeLevel("Grade 10")).toBe("Grade 10");
    expect(canonicalizeGradeLevel("")).toBe("");

    const { sheets } = readWorkbook(sampleWorkbook());
    expect(detectSF1Structure(sheets[0]).context.gradeLevel).toBe("Grade 7");
  });

  it("keeps the female block, which follows the mid-table TOTAL MALE tally", () => {
    const { sheets } = readWorkbook(sampleWorkbook());
    const structure = detectSF1Structure(sheets[0]);
    const { rawLearners } = parseSF1(structure);
    const { learners } = normalizeSF1(rawLearners);

    // 2 males + 1 female. Stopping at "<=== TOTAL MALE" would have yielded 2.
    expect(learners).toHaveLength(3);
    expect(learners.map((l) => l.sex)).toEqual(["Male", "Male", "Female"]);
    expect(learners[2].lastName).toBe("GARCIA");
  });

  it("records the printed tallies without treating them as learners", () => {
    const { sheets } = readWorkbook(sampleWorkbook());
    const structure = detectSF1Structure(sheets[0]);
    expect(structure.tallies).toEqual({ male: 2, female: 1, combined: 3 });
    expect(structure.dataRows).toHaveLength(3);
  });

  it("stops at the legend and never imports footer or signature rows", () => {
    const { sheets } = readWorkbook(sampleWorkbook());
    const structure = detectSF1Structure(sheets[0]);
    const { rawLearners } = parseSF1(structure);
    const names = rawLearners.map((r) => String(r.name || ""));
    expect(names.some((n) => /TOTAL|COMBINED|Indicator|Generated/i.test(n))).toBe(false);
  });
});

describe("LIS field mapping", () => {
  it("maps every SF1 column to the right learner field", async () => {
    const model = await processSF1Buffer(sampleWorkbook(), {
      filename: "SF1_2026_Grade 7 (Year I) - FAITH.xls",
      fileIndex: 0,
    });

    expect(model.learnerCount).toBe(3);
    expect(model.stats).toMatchObject({ total: 3, male: 2, female: 1 });

    const first = model.records[0].learner;
    expect(first).toMatchObject({
      lrn: "900000000018",
      lastName: "SANTIAGO",
      firstName: "MARIA ELENA",
      middleName: "RIVERA",
      sex: "Male",
      birthDate: "2013-05-14",
      age: "13",
      motherTongue: "Cebuano / Sinugbuanong Binisay",
      religion: "Christianity",
      barangay: "TINGUB",
      municipalityCity: "MANDAUE CITY",
      province: "CEBU",
      fathersName: "SANTIAGO, RODRIGO CRUZ",
      mothersMaidenName: "RIVERA,TERESA,MENDOZA,",
      learningModality: "Face to Face",
      remarks: "T/I DATE:2026-06-08",
      gradeLevel: "Grade 7",
      section: "FAITH",
    });

    const female = model.records[2].learner;
    expect(female).toMatchObject({
      guardianName: "GARCIA, LILIA",
      guardianRelationship: "Mother",
      contactNumber: "09171234567",
    });
  });

  it("parses the MM-DD-YYYY birth dates LIS writes as plain text", async () => {
    const model = await processSF1Buffer(sampleWorkbook(), { filename: "a.xls", fileIndex: 0 });
    expect(model.records.map((r) => r.learner.birthDate)).toEqual([
      "2013-05-14",
      "2012-11-02",
      "2013-08-19",
    ]);
  });

  it("builds a single-line address from the four SF1 address columns", async () => {
    const model = await processSF1Buffer(sampleWorkbook(), { filename: "a.xls", fileIndex: 0 });
    expect(model.records[0].learner.address).toBe("TINGUB, MANDAUE CITY, CEBU");
  });

  it("agrees with the register's own printed tallies", async () => {
    const model = await processSF1Buffer(sampleWorkbook(), { filename: "a.xls", fileIndex: 0 });
    // Counts derived from the parsed rows match the sheet's tally rows, so no
    // mismatch warning is raised.
    expect(model.summaryWarnings).toHaveLength(0);
    expect(model.status).toBe("valid");
  });
});
