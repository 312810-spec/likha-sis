// src/importers/sf1/officialLayout.test.js
// Regression tests for the OFFICIAL DepEd SF1 School Register layout, which
// differs from the flat single-row-header fixture in helpers.js: it uses a
// two-row merged header, parenthetically-qualified column labels, and separate
// MALE / FEMALE blocks. Before these tests existed the importer parsed such a
// workbook to ZERO learners — every row was dropped for having no last name,
// because the "Last Name" sub-header lived on a row the column map never read.

import { describe, it, expect } from "vitest";
import { processSF1Buffer } from "./importSF1.js";
import { buildOfficialSF1Workbook, officialLearner } from "./__fixtures__/helpers.js";

const MALES = [
  officialLearner({ lrn: "136789012301", lastName: "Dela Cruz", firstName: "Juan", middleName: "Santos", sex: "M", birthDate: "01/15/2010" }),
  officialLearner({ lrn: "136789012302", lastName: "Reyes", firstName: "Mark", middleName: "Lim", sex: "M", birthDate: "03/02/2010" }),
];
const FEMALES = [
  officialLearner({ lrn: "136789012303", lastName: "Santos", firstName: "Ana", middleName: "Cruz", sex: "F", birthDate: "05/20/2010" }),
  officialLearner({ lrn: "136789012304", lastName: "Garcia", firstName: "Bea", middleName: "Uy", sex: "F", birthDate: "07/11/2010" }),
];

async function analyze(opts) {
  const buf = buildOfficialSF1Workbook(opts);
  return processSF1Buffer(buf, { filename: "SF1-G10-Rizal.xlsx", fileIndex: 0 });
}

describe("SF1 importer — official DepEd layout", () => {
  it("extracts every learner from a two-row merged header", async () => {
    const model = await analyze({ males: MALES, females: FEMALES });
    expect(model.learnerCount).toBe(4);
    expect(model.records).toHaveLength(4);
  });

  it("maps the name columns from the sub-header row", async () => {
    const model = await analyze({ males: MALES, females: FEMALES });
    const first = model.records[0].learner;
    expect(first.lrn).toBe("136789012301");
    expect(first.lastName).toBe("Dela Cruz");
    expect(first.firstName).toBe("Juan");
    expect(first.middleName).toBe("Santos");
  });

  it("reads parenthetically-qualified Sex and Birth Date columns", async () => {
    const model = await analyze({ males: MALES, females: FEMALES });
    const first = model.records[0].learner;
    expect(first.sex).toBe("Male");
    expect(first.birthDate).toBe("2010-01-15");
    expect(model.stats).toMatchObject({ total: 4, male: 2, female: 2 });
  });

  it("reads the school context from the header block", async () => {
    const model = await analyze({ males: MALES, females: FEMALES });
    expect(model.school).toMatchObject({
      schoolId: "304212",
      schoolName: "Tingub National High School",
      division: "Cebu Province",
      district: "Consolacion",
      schoolYear: "2026-2027",
      gradeLevel: "Grade 10",
      section: "Rizal",
    });
  });

  it("keeps the FEMALE block when a blank spacer row splits the table", async () => {
    const model = await analyze({ males: MALES, females: FEMALES, blankBetweenBlocks: true });
    expect(model.learnerCount).toBe(4);
    expect(model.stats.female).toBe(2);
  });

  it("does not treat the MALE/FEMALE total separator rows as learners", async () => {
    const model = await analyze({ males: MALES, females: FEMALES });
    const lrns = model.records.map((r) => r.learner.lrn);
    expect(lrns).toEqual([
      "136789012301",
      "136789012302",
      "136789012303",
      "136789012304",
    ]);
  });

  it("splits a single merged NAME column into last/first/middle", async () => {
    const model = await analyze({ males: MALES, females: FEMALES, singleNameColumn: true });
    expect(model.learnerCount).toBe(4);
    const first = model.records[0].learner;
    expect(first.lastName).toBe("Dela Cruz");
    expect(first.firstName).toBe("Juan");
    expect(first.middleName).toBe("Santos");
  });

  it("reports no bogus 'no LRN column' / 'no Last Name column' warnings", async () => {
    const model = await analyze({ males: MALES, females: FEMALES });
    const messages = (model.fileIssues || []).map((i) => i.message).join(" ");
    expect(messages).not.toMatch(/no LRN column/i);
    expect(messages).not.toMatch(/no recognized Last Name column/i);
  });

  it("produces importable records with no blocking errors", async () => {
    const model = await analyze({ males: MALES, females: FEMALES });
    const errors = model.records.flatMap((r) =>
      r.issues.filter((i) => i.severity === "error")
    );
    expect(errors).toEqual([]);
  });
});
