import { describe, it, expect } from "vitest";
import {
  LEGACY_SUBJECT_ROWS,
  PRE_MATATAG_MAPEH_ROWS,
  isShsGradeLevel,
  getSubjectRows,
  isMatatagSchoolYear,
  findCanonicalKey,
  getImportMatchRows,
} from "../subjectRows.js";

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

  describe("isMatatagSchoolYear", () => {
    it("K/1/4/7 switch to combined MAPEH starting SY 2024-2025", () => {
      expect(isMatatagSchoolYear("2023-2024", "Grade 7")).toBe(false);
      expect(isMatatagSchoolYear("2024-2025", "Grade 7")).toBe(true);
      expect(isMatatagSchoolYear("2026-2027", "Grade 1")).toBe(true);
      expect(isMatatagSchoolYear("2023-2024", "Kindergarten")).toBe(false);
      expect(isMatatagSchoolYear("2024-2025", "Kindergarten")).toBe(true);
    });

    it("2/5/8 switch starting SY 2025-2026", () => {
      expect(isMatatagSchoolYear("2024-2025", "Grade 8")).toBe(false);
      expect(isMatatagSchoolYear("2025-2026", "Grade 8")).toBe(true);
    });

    it("3/6/9/10 switch starting SY 2026-2027, including Grade 10's accelerated rollout", () => {
      expect(isMatatagSchoolYear("2025-2026", "Grade 9")).toBe(false);
      expect(isMatatagSchoolYear("2026-2027", "Grade 9")).toBe(true);
      expect(isMatatagSchoolYear("2025-2026", "Grade 10")).toBe(false);
      expect(isMatatagSchoolYear("2026-2027", "Grade 10")).toBe(true);
    });

    it("defaults to true (combined) for SHS grade levels, which have no legacy 4-component MAPEH", () => {
      expect(isMatatagSchoolYear("2020-2021", "Grade 11")).toBe(true);
      expect(isMatatagSchoolYear("2020-2021", "Grade 12")).toBe(true);
    });

    it("defaults to true when the school year or grade level can't be determined", () => {
      expect(isMatatagSchoolYear("", "Grade 7")).toBe(true);
      expect(isMatatagSchoolYear("2020-2021", "")).toBe(true);
    });

    it("accepts bare-digit grade levels the same as 'Grade N' formatted ones", () => {
      expect(isMatatagSchoolYear("2023-2024", "7")).toBe(false);
      expect(isMatatagSchoolYear("2024-2025", "7")).toBe(true);
    });
  });

  describe("findCanonicalKey", () => {
    it("matches by exact key", () => {
      expect(findCanonicalKey("FILIPINO", LEGACY_SUBJECT_ROWS)).toBe("FILIPINO");
    });

    it("matches by canonical label, ignoring punctuation and case", () => {
      expect(findCanonicalKey("GMRC / Values Education", LEGACY_SUBJECT_ROWS)).toBe("GMRC/ESP");
      expect(findCanonicalKey("gmrc/values education", LEGACY_SUBJECT_ROWS)).toBe("GMRC/ESP");
    });

    it("matches known historical DepEd name variants via aliases", () => {
      expect(findCanonicalKey("Edukasyon sa Pagpapakatao", LEGACY_SUBJECT_ROWS)).toBe("GMRC/ESP");
      expect(findCanonicalKey("Araling Panlipunan (AP)", LEGACY_SUBJECT_ROWS)).toBe("ARALING PANLIPUNAN");
      expect(findCanonicalKey("Technology and Livelihood Education", LEGACY_SUBJECT_ROWS)).toBe("EPP/TLE");
    });

    it("matches with whitespace/punctuation normalization even when not an explicit alias", () => {
      expect(findCanonicalKey("P.E. and Health", LEGACY_SUBJECT_ROWS)).toBe("PE AND HEALTH");
    });

    it("returns null when nothing matches, rather than guessing", () => {
      expect(findCanonicalKey("Home Economics", LEGACY_SUBJECT_ROWS)).toBeNull();
      expect(findCanonicalKey("", LEGACY_SUBJECT_ROWS)).toBeNull();
    });

    it("does not merge legacy 4-component MAPEH names into the combined keys", () => {
      expect(findCanonicalKey("Music", LEGACY_SUBJECT_ROWS)).toBeNull();
      expect(findCanonicalKey("Arts", LEGACY_SUBJECT_ROWS)).toBeNull();
      expect(findCanonicalKey("P.E.", LEGACY_SUBJECT_ROWS)).toBeNull();
    });

    it("matches the pre-MATATAG 4-component MAPEH rows against their own set", () => {
      expect(findCanonicalKey("Music", PRE_MATATAG_MAPEH_ROWS)).toBe("MUSIC");
      expect(findCanonicalKey("Arts", PRE_MATATAG_MAPEH_ROWS)).toBe("ARTS");
      expect(findCanonicalKey("P.E.", PRE_MATATAG_MAPEH_ROWS)).toBe("PHYSICAL EDUCATION");
      expect(findCanonicalKey("Health", PRE_MATATAG_MAPEH_ROWS)).toBe("HEALTH");
    });
  });

  describe("getImportMatchRows", () => {
    it("returns the combined-MAPEH rows for a MATATAG-era school year", () => {
      const rows = getImportMatchRows("2026-2027", "Grade 10");
      expect(rows.some((r) => r.key === "MUSIC AND ARTS")).toBe(true);
      expect(rows.some((r) => r.key === "PE AND HEALTH")).toBe(true);
      expect(rows.some((r) => r.key === "MUSIC")).toBe(false);
      expect(rows.some((r) => r.key === "HEALTH")).toBe(false);
    });

    it("returns the 4-component legacy MAPEH rows for a pre-MATATAG school year", () => {
      const rows = getImportMatchRows("2025-2026", "Grade 10");
      expect(rows.some((r) => r.key === "MUSIC")).toBe(true);
      expect(rows.some((r) => r.key === "ARTS")).toBe(true);
      expect(rows.some((r) => r.key === "PHYSICAL EDUCATION")).toBe(true);
      expect(rows.some((r) => r.key === "HEALTH")).toBe(true);
      expect(rows.some((r) => r.key === "MUSIC AND ARTS")).toBe(false);
      expect(rows.some((r) => r.key === "PE AND HEALTH")).toBe(false);
    });

    it("keeps the non-MAPEH subjects unchanged in both cases", () => {
      const matatagRows = getImportMatchRows("2026-2027", "Grade 10");
      const legacyRows = getImportMatchRows("2025-2026", "Grade 10");
      expect(matatagRows.some((r) => r.key === "FILIPINO")).toBe(true);
      expect(legacyRows.some((r) => r.key === "FILIPINO")).toBe(true);
    });
  });
});
