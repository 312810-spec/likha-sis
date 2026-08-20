// src/importers/sf1/importSF1.test.js
// End-to-end + unit tests for the SF1 bulk importer pipeline. Uses in-memory
// SF1 workbooks that mirror the official DepEd layout (see __fixtures__/helpers.js).

import { describe, it, expect } from "vitest";
import { readWorkbook } from "../shared/excelReader.js";
import { detectSF1Structure } from "./detectSF1Structure.js";
import { parseSF1 } from "./parseSF1.js";
import { normalizeSF1 } from "./normalizeSF1.js";
import { processSF1Buffer, analyzeSF1Files, aggregateBatch } from "./importSF1.js";
import { normalizeHeader, normalizeLrn, normalizeSex, normalizeDate } from "../shared/normalization.js";
import { buildSF1Workbook, learner, asNumericLrn } from "./__fixtures__/helpers.js";
import { toFirestoreLearner } from "../shared/firestoreImport.js";

// Fake browser File so we can drive analyzeSF1Files without a DOM.
function fakeFile(name, buffer) {
  return { name, arrayBuffer: async () => buffer };
}

const VALID_LRN = "136789012345";

describe("normalization helpers", () => {
  it("maps official LRN header variants to the lrn field", () => {
    expect(normalizeHeader("Learner's Reference Number (LRN)")).toBe("lrn");
    expect(normalizeHeader("LRN")).toBe("lrn");
    expect(normalizeHeader("Learner's Reference Number")).toBe("lrn");
    expect(normalizeHeader("Last Name")).toBe("lastName");
  });

  it("normalizes numeric and formatted LRNs to plain digit strings", () => {
    expect(normalizeLrn(136789012345)).toBe("136789012345");
    expect(normalizeLrn("136-789-012-345")).toBe("136789012345");
    expect(normalizeLrn("")).toBe("");
  });

  it("normalizes sex to Male/Female and dates to YYYY-MM-DD", () => {
    expect(normalizeSex("M")).toBe("Male");
    expect(normalizeSex("female")).toBe("Female");
    expect(normalizeSex("X")).toBe("");
    expect(normalizeDate("01/15/2010")).toBe("2010-01-15");
    expect(normalizeDate("January 15, 2010")).toBe("2010-01-15");
  });
});

describe("SF1 structure detection", () => {
  it("finds the learner header and extracts school context from the workbook", () => {
    const buffer = buildSF1Workbook({
      learners: [learner()],
      schoolId: "304212",
      grade: "Grade 10",
      section: "Rizal",
      schoolYear: "SY 2026-2027",
    });
    const { sheets } = readWorkbook(buffer);
    const structure = detectSF1Structure(sheets[0]);

    expect(structure.headerRow).not.toBeNull();
    // columnMap is keyed by column index -> canonical field.
    expect(structure.columnMap[0]).toBe("lrn");
    expect(structure.columnMap[1]).toBe("lastName");
    expect(structure.context.schoolId).toBe("304212");
    expect(structure.context.gradeLevel).toBe("Grade 10"); // kept raw on the structure/context
    expect(structure.context.section).toBe("Rizal");
    expect(structure.context.schoolYear).toBe("2026-2027");
  });

  it("extracts learner rows and drops summary/blank rows", () => {
    const buffer = buildSF1Workbook({
      learners: [learner(), learner({ lrn: "200000000001", firstName: "Maria" })],
      summary: { male: 1, female: 1 },
    });
    const { sheets } = readWorkbook(buffer);
    const structure = detectSF1Structure(sheets[0]);
    const { rawLearners, droppedRows } = parseSF1(structure);
    const { learners } = normalizeSF1(rawLearners);

    // Only the 2 real learner rows survive — TOTAL MALE / TOTAL FEMALE / COMBINED
    // and signature rows are never treated as learners.
    expect(learners.length).toBe(2);
    expect(droppedRows).toHaveLength(0);
    expect(learners[0].lrn).toBe(VALID_LRN);
    expect(learners[1].lastName).toBe("Dela Cruz");
  });
});

describe("processSF1Buffer (single file)", () => {
  it("parses, normalizes and computes statistics independently of summary rows", async () => {
    const buffer = buildSF1Workbook({
      learners: [
        learner({ lrn: VALID_LRN, sex: "M" }),
        learner({ lrn: "200000000001", sex: "F" }),
        learner({ lrn: "200000000002", sex: "M" }),
      ],
      summary: { male: 9, female: 1 }, // intentionally wrong to test independency
    });
    const model = await processSF1Buffer(buffer, { filename: "grade10.xlsx", fileIndex: 0 });

    // The workbook's summary rows are NOT trusted: calculated stats come from the
    // parsed records (2 male, 1 female), and the erroneous summary (9 male) is
    // surfaced as a warning rather than used as the learner source.
    expect(model.status).toBe("warning");
    expect(model.records).toHaveLength(3);
    expect(model.stats.male).toBe(2);
    expect(model.stats.female).toBe(1);
    expect(model.stats.total).toBe(3);
    // Calculated stats differ from the workbook summary -> mismatch warning.
    expect(model.summaryWarnings.length).toBeGreaterThan(0);
    expect(model.school.gradeLevel).toBe("Grade 10");
    expect(model.school.section).toBe("Rizal");
  });

  it("flags an invalid (non-12-digit) LRN as a blocking error", async () => {
    const buffer = buildSF1Workbook({ learners: [learner({ lrn: "123" })] });
    const model = await processSF1Buffer(buffer, { filename: "bad.xlsx", fileIndex: 0 });
    expect(model.records[0].severity).toBe("error");
    expect(model.records[0].issues.some((i) => i.code === "invalid-lrn")).toBe(true);
  });

  it("handles LRN stored as a numeric Excel cell", async () => {
    const buffer = buildSF1Workbook({ learners: [learner({ lrn: asNumericLrn(VALID_LRN) })] });
    const model = await processSF1Buffer(buffer, { filename: "num.xlsx", fileIndex: 0 });
    expect(model.records[0].learner.lrn).toBe(VALID_LRN);
    expect(model.records[0].severity).toBe("valid");
  });

  it("reports unreadable files without throwing", async () => {
    const junk = new TextEncoder().encode("this is not an excel file").buffer;
    const model = await processSF1Buffer(junk, { filename: "junk.xlsx", fileIndex: 0 });
    expect(model.status).toBe("error");
    expect(model.fileIssues[0].severity).toBe("error");
  });
});

describe("duplicate detection", () => {
  it("flags duplicate LRN within one file as blocking", async () => {
    const buffer = buildSF1Workbook({
      learners: [learner(), learner({ lrn: VALID_LRN, firstName: "Pedro" })],
    });
    const { files } = await analyzeSF1Files([fakeFile("dup.xlsx", buffer)]);
    const within = files[0].records.filter((r) => r.duplicate.withinFile);
    expect(within.length).toBeGreaterThan(0);
    expect(within.some((r) => r.severity === "error")).toBe(true);
  });

  it("detects the same LRN across two files in one batch (cross-file)", async () => {
    const buf1 = buildSF1Workbook({ learners: [learner({ lrn: VALID_LRN })] });
    const buf2 = buildSF1Workbook({ learners: [learner({ lrn: VALID_LRN })] });
    const { files, batch } = await analyzeSF1Files([
      fakeFile("a.xlsx", buf1),
      fakeFile("b.xlsx", buf2),
    ]);

    const crossed = files.flatMap((f) => f.records).filter((r) => r.duplicate.crossFile);
    expect(crossed).toHaveLength(2);
    expect(batch.blockingErrors).toBe(true);
    expect(batch.duplicateCount).toBeGreaterThanOrEqual(2);
  });

  it("flags identity conflicts (same LRN, different name/birthdate/sex)", async () => {
    const buffer = buildSF1Workbook({
      learners: [
        learner({ lrn: VALID_LRN, firstName: "Juan", birthDate: "2010-01-15" }),
        learner({ lrn: VALID_LRN, firstName: "ERIKA", birthDate: "2012-06-20" }),
      ],
    });
    const { files } = await analyzeSF1Files([fakeFile("conflict.xlsx", buffer)]);
    const conflicted = files[0].records.filter((r) =>
      r.issues.some((i) => i.code === "identity-conflict")
    );
    expect(conflicted.length).toBeGreaterThan(0);
    expect(conflicted[0].severity).toBe("error");
  });

  it("flags an existing LRN with a new enrollment context as a re-enrollment update, not a skip", async () => {
    const buffer = buildSF1Workbook({ learners: [learner({ lrn: VALID_LRN })] });
    const existing = {
      [VALID_LRN]: {
        id: "existing-doc",
        data: {
          lrn: VALID_LRN,
          lastName: "Dela Cruz",
          firstName: "Juan",
          sex: "Male",
          birthDate: "2010-01-15",
          // Different enrollment context than the imported row -> re-enrollment.
          schoolYear: "2020-2021",
          gradeLevel: "Grade 4",
          section: "Old Section",
        },
      },
    };
    const { files } = await analyzeSF1Files([fakeFile("exists.xlsx", buffer)], existing);
    const rec = files[0].records[0];
    expect(rec.duplicate.inFirestore).toBe(true);
    expect(rec.duplicate.enrollment).toBe(false);
    expect(rec.duplicate.existingId).toBe("existing-doc");
    expect(rec.issues.some((i) => i.code === "existing-lrn-reenrollment")).toBe(true);
    // Matching identity -> warning, not a blocking error.
    expect(rec.severity).not.toBe("error");
  });

  it("flags an existing LRN with the exact same enrollment already recorded as a skip warning", async () => {
    const buffer = buildSF1Workbook({
      learners: [learner({ lrn: VALID_LRN })],
      grade: "Grade 7",
      section: "Rizal",
      schoolYear: "SY 2026-2027",
    });
    const existing = {
      [VALID_LRN]: {
        id: "existing-doc",
        data: {
          lrn: VALID_LRN,
          lastName: "Dela Cruz",
          firstName: "Juan",
          sex: "Male",
          birthDate: "2010-01-15",
          schoolYear: "2026-2027",
          gradeLevel: "Grade 7",
          section: "Rizal",
        },
      },
    };
    const { files } = await analyzeSF1Files([fakeFile("exists.xlsx", buffer)], existing);
    const rec = files[0].records[0];
    expect(rec.duplicate.inFirestore).toBe(true);
    expect(rec.duplicate.enrollment).toBe(true);
    expect(rec.issues.some((i) => i.code === "existing-lrn")).toBe(true);
    expect(rec.severity).not.toBe("error");
  });
});

describe("multiple files + batch aggregation", () => {
  it("analyzes several files and aggregates totals", async () => {
    const bufA = buildSF1Workbook({
      learners: [learner({ lrn: "100000000001", sex: "M" })],
      grade: "7",
      section: "A",
    });
    const bufB = buildSF1Workbook({
      learners: [
        learner({ lrn: "100000000002", sex: "F" }),
        learner({ lrn: "100000000003", sex: "M" }),
      ],
      grade: "8",
      section: "B",
    });
    const { files, batch } = await analyzeSF1Files([
      fakeFile("g7a.xlsx", bufA),
      fakeFile("g8b.xlsx", bufB),
    ]);

    expect(files).toHaveLength(2);
    expect(files[0].records).toHaveLength(1);
    expect(files[1].records).toHaveLength(2);
    expect(batch.totalLearners).toBe(3);
    expect(batch.male).toBe(2);
    expect(batch.female).toBe(1);
    expect(batch.filesWithErrors).toBe(0);
    expect(batch.canImport).toBe(true);
  });

  it("aggregateBatch counts duplicates and errors across files", () => {
    const batch = aggregateBatch([
      {
        status: "valid",
        records: [{ duplicate: { withinFile: true }, summary: { errors: 1, warnings: 0 } }],
        stats: { male: 1, female: 0 },
        fileIssues: [],
      },
    ]);
    expect(batch.duplicateCount).toBe(1);
    expect(batch.errorCount).toBe(1);
    expect(batch.blockingErrors).toBe(true);
  });
});

describe("toFirestoreLearner — SF1 page field schema alignment", () => {
  // SF1.jsx#toFormLearner reads these exact Firestore field keys. If the importer
  // writes a different key (e.g. guardian instead of guardianName) the SF1 page
  // renders an empty field even though the data exists in Firestore.
  const normalized = {
    lrn: "136789012345",
    lastName: "Dela Cruz",
    firstName: "Juan",
    middleName: "Santos",
    nameExtension: "Jr.",
    sex: "Male",
    birthDate: "2010-01-15",
    age: "16",
    motherTongue: "Filipino",
    ipEthnicGroup: "",
    religion: "Catholic",
    address: "123 Rizal St",
    houseStreetSitio: "123 Rizal St",
    barangay: "Poblacion",
    municipalityCity: "Cebu City",
    province: "Cebu",
    fathersName: "Pedro Dela Cruz",
    mothersName: "Maria Santos",
    guardian: "Lola Caring",
    guardianRelationship: "Grandmother",
    contactNumber: "09123456789",
    learningModality: "Face to Face",
    remarks: "transferee",
    schoolId: "304212",
    schoolName: "Test Elementary School",
    division: "Division of Cebu City",
    district: "District 1",
    schoolYear: "2026-2027",
    gradeLevel: "Grade 6",
    section: "Rizal",
  };

  it("writes fathersName (not fatherName) matching SF1.jsx toFormLearner fallback chain", () => {
    const doc = toFirestoreLearner(normalized, { importId: "x", sourceFileFingerprint: "y", userEmail: "t@t.com" });
    // SF1.jsx reads: d.fathersName ?? d.fatherName
    expect(doc).toHaveProperty("fathersName", "Pedro Dela Cruz");
    expect(doc).not.toHaveProperty("fatherName");
  });

  it("writes mothersMaidenName (not mothersName) matching SF1.jsx toFormLearner fallback chain", () => {
    const doc = toFirestoreLearner(normalized, { importId: "x", sourceFileFingerprint: "y", userEmail: "t@t.com" });
    // SF1.jsx reads: d.mothersMaidenName ?? d.mothersName ?? d.motherName
    expect(doc).toHaveProperty("mothersMaidenName", "Maria Santos");
    expect(doc).not.toHaveProperty("mothersName");
  });

  it("writes guardianName (not guardian) matching SF1.jsx toFormLearner fallback chain", () => {
    const doc = toFirestoreLearner(normalized, { importId: "x", sourceFileFingerprint: "y", userEmail: "t@t.com" });
    // SF1.jsx reads: d.guardianName ?? d.guardian
    expect(doc).toHaveProperty("guardianName", "Lola Caring");
    expect(doc).not.toHaveProperty("guardian");
  });

  it("includes all address sub-fields that SF1.jsx renders individually", () => {
    const doc = toFirestoreLearner(normalized, { importId: "x", sourceFileFingerprint: "y", userEmail: "t@t.com" });
    expect(doc).toHaveProperty("houseStreetSitio", "123 Rizal St");
    expect(doc).toHaveProperty("barangay", "Poblacion");
    expect(doc).toHaveProperty("municipalityCity", "Cebu City");
    expect(doc).toHaveProperty("province", "Cebu");
  });

  it("preserves sex as Male/Female (SF1.jsx applies sexLetter() on display)", () => {
    const doc = toFirestoreLearner(normalized, { importId: "x", sourceFileFingerprint: "y", userEmail: "t@t.com" });
    // SF1.jsx toFormLearner applies sexLetter(d.sex) which converts Male→M/Female→F.
    expect(doc.sex).toBe("Male");
  });
});

describe("executeImport LRN filter — regression for r.lrn vs r.learner.lrn", () => {
  // The record shape coming out of the pipeline is { learner: { lrn, ... }, issues, severity, ... }.
  // Previously the filter used r.lrn (always undefined), so nothing was ever written.
  // This test exercises the same filter logic to guard against regression.
  it("analyzeSF1Files produces records where lrn lives on r.learner.lrn, not r.lrn", async () => {
    const buffer = buildSF1Workbook({ learners: [learner({ lrn: "136789012345" })] });
    const fakeF = fakeFile("test.xlsx", buffer);
    const { files } = await analyzeSF1Files([fakeF]);
    const rec = files[0].records[0];
    // The outer record must NOT expose lrn at the top level (it only sits on .learner).
    expect(rec.lrn).toBeUndefined();
    // The importer pipeline must place lrn under .learner.lrn.
    expect(rec.learner.lrn).toBe("136789012345");
  });
});

