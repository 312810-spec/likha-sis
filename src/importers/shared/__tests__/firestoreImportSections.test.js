// src/importers/shared/__tests__/firestoreImportSections.test.js
// Regression coverage for executeImport() auto-creating missing registry
// sections (schedules/{schoolYear}/sections) for every grade/section pair an
// SF1 import references, so a freshly-imported grade level (e.g. Grade 7)
// isn't stranded with learners but no section for School Settings / Class
// Program Generator to schedule against.

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
}));

vi.mock("firebase/firestore", () => mocks);

const { executeImport } = await import("../firestoreImport.js");

function record(learner, overrides = {}) {
  return { learner, severity: "info", summary: {}, ...overrides };
}

describe("executeImport — SF1 auto-creates missing sections", () => {
  let sectionWrites;
  let learnerBatchSet;

  beforeEach(() => {
    vi.clearAllMocks();
    sectionWrites = [];
    learnerBatchSet = [];

    mocks.collection.mockImplementation((_db, ...pathParts) => ({ path: pathParts.join("/") }));
    mocks.doc.mockImplementation((_db, ...pathParts) => ({ path: pathParts.join("/") }));
    mocks.setDoc.mockResolvedValue(undefined);

    // First getDocs call is fetchExistingLearnersByLrn (empty: no existing learners).
    // Subsequent calls are the per-school-year existing-sections lookups.
    mocks.getDocs.mockImplementation((ref) => {
      if (ref.path === "learners") {
        return Promise.resolve({ forEach: () => {} });
      }
      // schedules/{schoolYear}/sections -- no pre-existing sections.
      return Promise.resolve({ docs: [] });
    });

    mocks.writeBatch.mockImplementation(() => {
      return {
        set: (ref, data) => {
          if (String(ref.path).includes("/sections/")) {
            sectionWrites.push({ path: ref.path, data });
          } else {
            learnerBatchSet.push({ path: ref.path, data });
          }
        },
        update: () => {},
        commit: () => Promise.resolve(),
      };
    });
  });

  it("creates one section per distinct grade/section pair for a fresh SF1 import", async () => {
    const records = [
      record({
        lrn: "100000000001",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
        section: "Narra",
      }),
      record({
        lrn: "100000000002",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
        section: "Narra",
      }),
      record({
        lrn: "100000000003",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
        section: "Molave",
      }),
    ];

    await executeImport({}, { records, documentType: "sf1" });

    expect(sectionWrites).toHaveLength(2);
    const ids = sectionWrites.map((w) => w.data.id).sort();
    expect(ids).toEqual(["grade-7_molave", "grade-7_narra"]);
    sectionWrites.forEach((w) => {
      expect(w.data.gradeLevel).toBe("Grade 7");
      expect(w.data.shiftId).toBe("");
    });
  });

  it("does not recreate a section that already exists in the registry", async () => {
    mocks.getDocs.mockImplementation((ref) => {
      if (ref.path === "learners") return Promise.resolve({ forEach: () => {} });
      return Promise.resolve({ docs: [{ id: "grade-7_narra" }] });
    });

    const records = [
      record({
        lrn: "100000000004",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
        section: "Narra",
      }),
    ];

    await executeImport({}, { records, documentType: "sf1" });

    expect(sectionWrites).toHaveLength(0);
  });

  it("skips records missing a school year, grade level, or section", async () => {
    const records = [
      record({ lrn: "100000000005", schoolYear: "", gradeLevel: "Grade 7", section: "Narra" }),
      record({ lrn: "100000000006", schoolYear: "2026-2027", gradeLevel: "", section: "Narra" }),
      record({ lrn: "100000000007", schoolYear: "2026-2027", gradeLevel: "Grade 7", section: "" }),
    ];

    await executeImport({}, { records, documentType: "sf1" });

    expect(sectionWrites).toHaveLength(0);
  });

  it("does not auto-create sections for SF10 imports", async () => {
    const records = [
      record({
        lrn: "100000000008",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
        section: "Narra",
      }),
    ];

    await executeImport({}, { records, documentType: "sf10" });

    expect(sectionWrites).toHaveLength(0);
  });
});
