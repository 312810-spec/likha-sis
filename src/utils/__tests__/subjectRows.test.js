import { describe, it, expect } from "vitest";
import { LEGACY_SUBJECT_ROWS, isShsGradeLevel, getSubjectRows } from "../subjectRows.js";

describe("subjectRows", () => {
  describe("isShsGradeLevel", () => {
    it("returns true only for Grade 11 and Grade 12", () => {
      expect(isShsGradeLevel("Grade 11")).toBe(true);
      expect(isShsGradeLevel("Grade 12")).toBe(true);
      expect(isShsGradeLevel("Grade 10")).toBe(false);
      expect(isShsGradeLevel("")).toBe(false);
    });
  });

  describe("getSubjectRows", () => {
    it("returns the Grade 4-10 legacy rows unchanged for non-SHS grade levels", () => {
      expect(getSubjectRows("Grade 7", null, null)).toBe(LEGACY_SUBJECT_ROWS);
      expect(getSubjectRows("Grade 10", null, null)).toBe(LEGACY_SUBJECT_ROWS);
    });

    it("returns configured SHS core subjects for Grade 11/12", () => {
      const shsConfig = {
        subjects: [{ name: "Oral Communication" }, { name: "General Mathematics" }],
        electiveClusters: [],
      };
      const rows = getSubjectRows("Grade 11", null, shsConfig);
      expect(rows).toEqual([
        { label: "Oral Communication", key: "ORAL COMMUNICATION", isHeader: false },
        { label: "General Mathematics", key: "GENERAL MATHEMATICS", isHeader: false },
      ]);
    });

    it("appends the learner's elective cluster subjects under a header row", () => {
      const shsConfig = {
        subjects: [{ name: "Oral Communication" }],
        electiveClusters: [
          { id: "stem", name: "STEM", subjects: [{ name: "Pre-Calculus" }, { name: "Biology" }] },
        ],
      };
      const learner = { cluster: "stem" };
      const rows = getSubjectRows("Grade 12", learner, shsConfig);
      expect(rows).toEqual([
        { label: "Oral Communication", key: "ORAL COMMUNICATION", isHeader: false },
        { label: "STEM", key: null, isHeader: true },
        { label: "Pre-Calculus", key: "PRE-CALCULUS", isHeader: false, isIndented: true },
        { label: "Biology", key: "BIOLOGY", isHeader: false, isIndented: true },
      ]);
    });
  });
});
