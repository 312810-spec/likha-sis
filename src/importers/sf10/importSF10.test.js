// src/importers/sf10/importSF10.test.js
// Tests for the SF10 (Learner's Permanent Academic Record) importer. No real SF10
// file was available in the repository, so an in-memory workbook that mirrors the
// official form layout (school header block, label/value identity, learning-areas
// grade table, GENERAL AVERAGE + promotion footer) is used as a fixture.

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { processSF10Buffer, analyzeSF10Files } from "./importSF10.js";

// Build an SF10 workbook mirroring the official layout.
function buildSF10Workbook(opts = {}) {
  const {
    lrn = "136789012345",
    lastName = "Dela Cruz",
    firstName = "Juan",
    sex = "M",
    birthDate = "2010-01-15",
    schoolYear = "SY 2026-2027",
    grade = "Grade 10",
    section = "Rizal",
    invalidLrn = false,
    promotionRow = ["PROMOTED", "", "", "", "", "", "", "", "", "", ""],
  } = opts;

  const aoa = [
    ["Republic of the Philippines"],
    ["Department of Education"],
    ["Tingub National High School"],
    ["School ID: 304212"],
    ["Division: Division of Cebu Province", "", "", "", "District: District of Consolacion"],
    [`GRADE LEVEL: ${grade}`, "", `SECTION: ${section}`, "", `SCHOOL YEAR: ${schoolYear}`],
    // identity label/value form row
    [
      "Learner's Reference Number",
      invalidLrn ? "123" : lrn,
      "Last Name",
      lastName,
      "First Name",
      firstName,
      "Sex",
      sex,
      "Birth Date",
      birthDate,
    ],
    ["LEARNING AREAS", "", "Final Grade", "", "", "", "", "", "", "", ""],
    ["Filipino", "", 90, "", "", "", "", "", "", "", ""],
    ["English", "", 88, "", "", "", "", "", "", "", ""],
    ["GENERAL AVERAGE: 89", "", "", "", "", "", "", "", "", "", ""],
    promotionRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SF10");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

function fakeFile(name, buffer) {
  return { name, arrayBuffer: async () => buffer };
}

describe("SF10 importer", () => {
  it("extracts identity, school context, learning areas and general average", async () => {
    const buffer = buildSF10Workbook();
    const model = await processSF10Buffer(buffer, { filename: "sf10.xlsx", fileIndex: 0 });

    expect(model.status).toBe("valid");
    expect(model.records).toHaveLength(1);
    const learner = model.records[0].learner;

    expect(learner.lrn).toBe("136789012345");
    expect(learner.lastName).toBe("Dela Cruz");
    expect(learner.firstName).toBe("Juan");
    expect(learner.sex).toBe("Male");
    expect(learner.birthDate).toBe("2010-01-15");
    expect(learner.schoolYear).toBe("2026-2027");
    expect(learner.gradeLevel).toBe("10");
    expect(learner.section).toBe("Rizal");
    expect(learner.schoolId).toBe("304212");

    expect(learner.learningAreas).toHaveLength(2);
    expect(learner.learningAreas.map((a) => a.name)).toEqual(["Filipino", "English"]);
    expect(learner.generalAverage).toBe("89");
    expect(learner.promotionStatus).toBe("PROMOTED");
  });

  it("captures RETAINED as the promotion status", async () => {
    const buffer = buildSF10Workbook({ promotionRow: ["RETAINED", "", "", "", "", "", "", "", "", "", ""] });
    const model = await processSF10Buffer(buffer, { filename: "sf10.xlsx", fileIndex: 0 });
    expect(model.records[0].learner.promotionStatus).toBe("RETAINED");
  });

  it("captures a REMARKS row's full text as the promotion status", async () => {
    const buffer = buildSF10Workbook({
      promotionRow: ["REMARKS:", "Promoted with recognition", "", "", "", "", "", "", "", "", ""],
    });
    const model = await processSF10Buffer(buffer, { filename: "sf10.xlsx", fileIndex: 0 });
    expect(model.records[0].learner.promotionStatus).toBe("REMARKS: Promoted with recognition");
  });

  it("does not capture a signature-block row as promotion status", async () => {
    const buffer = buildSF10Workbook({
      promotionRow: ["PREPARED BY:", "Maria Santos", "", "", "", "", "", "", "", "", ""],
    });
    const model = await processSF10Buffer(buffer, { filename: "sf10.xlsx", fileIndex: 0 });
    expect(model.records[0].learner.promotionStatus).toBe("");
  });

  it("flags an invalid LRN as a blocking error", async () => {
    const buffer = buildSF10Workbook({ invalidLrn: true });
    const model = await processSF10Buffer(buffer, { filename: "bad.xlsx", fileIndex: 0 });
    expect(model.records[0].severity).toBe("error");
    expect(model.records[0].issues.some((i) => i.code === "invalid-lrn")).toBe(true);
  });

  it("detects the same LRN colliding across two SF10 files", async () => {
    const a = buildSF10Workbook({ lrn: "136789012345" });
    const b = buildSF10Workbook({ lrn: "136789012345", firstName: "Pedro" });
    const { files, batch } = await analyzeSF10Files([
      fakeFile("a.xlsx", a),
      fakeFile("b.xlsx", b),
    ]);
    const crossed = files.flatMap((f) => f.records).filter((r) => r.duplicate.crossFile);
    expect(crossed).toHaveLength(2);
    expect(batch.blockingErrors).toBe(true);
  });

  it("flags an SF10 record already present in Firestore as skip", async () => {
    const buffer = buildSF10Workbook();
    const existing = {
      "136789012345": {
        id: "doc",
        data: {
          lrn: "136789012345",
          lastName: "Dela Cruz",
          firstName: "Juan",
          sex: "Male",
          birthDate: "2010-01-15",
        },
      },
    };
    const { files } = await analyzeSF10Files([fakeFile("ex.xlsx", buffer)], existing);
    const rec = files[0].records[0];
    expect(rec.duplicate.inFirestore).toBe(true);
    expect(rec.severity).not.toBe("error"); // matching identity -> skip warning
  });
});
