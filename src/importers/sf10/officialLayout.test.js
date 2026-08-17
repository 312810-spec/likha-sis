// src/importers/sf10/officialLayout.test.js
// Regression tests for the OFFICIAL DepEd SF10-JHS layout. Before these tests
// existed the importer found the "LRN:" row but read nothing else: the name
// labels sit on the row ABOVE it, the school context sits BELOW it under
// SCHOLASTIC RECORD, and "Date of Birth (mm/dd/yyyy)" never matched a header
// alias because of its parenthetical qualifier.

import { describe, it, expect } from "vitest";
import { processSF10Buffer } from "./importSF10.js";
import { buildOfficialSF10Workbook } from "./__fixtures__/helpers.js";

async function analyze(opts) {
  const buf = buildOfficialSF10Workbook(opts);
  return processSF10Buffer(buf, { filename: "SF10-DelaCruz.xlsx", fileIndex: 0 });
}

describe("SF10 importer — official DepEd layout", () => {
  it("reads the learner identity across the whole information block", async () => {
    const model = await analyze();
    const rec = model.records[0].learner;
    expect(rec.lrn).toBe("136789012301");
    expect(rec.lastName).toBe("Dela Cruz");
    expect(rec.firstName).toBe("Juan");
    expect(rec.middleName).toBe("Santos");
    expect(rec.sex).toBe("Male");
  });

  it("reads a parenthetically-qualified Date of Birth label", async () => {
    const model = await analyze();
    expect(model.records[0].learner.birthDate).toBe("2010-01-15");
  });

  it("reads the school context from the SCHOLASTIC RECORD block below the identity", async () => {
    const model = await analyze();
    expect(model.school).toMatchObject({
      schoolId: "304212",
      schoolName: "Tingub National High School",
      division: "Cebu Province",
      district: "Consolacion",
      schoolYear: "2026-2027",
      gradeLevel: "10",
      section: "Rizal",
    });
  });

  it("extracts the learning areas without the quarter sub-header row", async () => {
    const model = await analyze();
    const areas = model.records[0].learner.learningAreas;
    expect(areas.map((a) => a.name)).toEqual([
      "Filipino",
      "English",
      "Mathematics",
      "Science",
    ]);
    expect(areas[0].grades).toEqual([85, 86, 87, 88, 87]);
  });

  it("captures the general average and promotion status", async () => {
    const model = await analyze();
    const rec = model.records[0].learner;
    expect(rec.generalAverage).toBe("87");
    expect(rec.promotionStatus).toMatch(/PROMOTED TO GRADE 11/);
  });

  it("produces an importable record with no blocking errors", async () => {
    const model = await analyze();
    const errors = model.records[0].issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
    expect(model.learnerCount).toBe(1);
  });
});
