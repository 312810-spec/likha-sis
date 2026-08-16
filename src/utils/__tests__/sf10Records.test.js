import { describe, it, expect } from "vitest";
import { buildLearnerAcademicHistory } from "../sf10Records.js";
import { getSubjectWeights } from "../subjectWeights.js";

// FILIPINO weights are ww:0.2, pt:0.5, ex:0.3 (subjectWeights.js). Perfect
// scores everywhere (raw == highest possible score) always transmute to
// 100, so this fixture gives a deterministic, non-mocked expected result.
function perfectClassRecord({ learnerId, subject, term, schoolYear, gradeLevel, section = "Kindness" }) {
  return {
    subject,
    term,
    schoolYear,
    gradeLevel,
    section,
    wwItems: [{ id: "ww1", hps: 10 }],
    ptItems: [{ id: "pt1", hps: 10 }],
    exHPS: { st1: 10, st2: 10, te: 10 },
    scores: {
      [learnerId]: {
        ww: { ww1: 10 },
        pt: { pt1: 10 },
        st1: 10,
        st2: 10,
        te: 10,
      },
    },
  };
}

describe("buildLearnerAcademicHistory", () => {
  it("returns an empty array when there are no records for the learner", () => {
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      [],
      [],
      getSubjectWeights
    );
    expect(result).toEqual([]);
  });

  it("builds a live row from classRecords with a computed subject grade and general average", () => {
    const classRecords = [
      perfectClassRecord({
        learnerId: "learner-1",
        subject: "Filipino",
        term: "Term 1",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
      perfectClassRecord({
        learnerId: "learner-1",
        subject: "Filipino",
        term: "Term 2",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      classRecords,
      [],
      getSubjectWeights
    );
    expect(result).toEqual([
      {
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
        subjects: { FILIPINO: 100 },
        generalAverage: 100,
        promotionStatus: "",
        source: "live",
      },
    ]);
  });

  it("ignores classRecords for a different learner", () => {
    const classRecords = [
      perfectClassRecord({
        learnerId: "someone-else",
        subject: "Filipino",
        term: "Term 1",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      classRecords,
      [],
      getSubjectWeights
    );
    expect(result).toEqual([]);
  });

  it("builds an imported row from academicRecords and normalizes bare-digit gradeLevel to 'Grade N'", () => {
    const academicRecords = [
      {
        lrn: "123456789012",
        schoolYear: "2024-2025",
        gradeLevel: "6",
        learningAreas: [
          { name: "Filipino", grades: [88, 90] },
          { name: "English", grades: [85] },
        ],
        generalAverage: "87",
        promotionStatus: "Promoted",
      },
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      [],
      academicRecords,
      getSubjectWeights
    );
    expect(result).toEqual([
      {
        schoolYear: "2024-2025",
        gradeLevel: "Grade 6",
        subjects: { FILIPINO: 90, ENGLISH: 85 },
        generalAverage: 87,
        promotionStatus: "Promoted",
        source: "imported",
      },
    ]);
  });

  it("ignores academicRecords for a different learner's LRN", () => {
    const academicRecords = [
      {
        lrn: "999999999999",
        schoolYear: "2024-2025",
        gradeLevel: "6",
        learningAreas: [{ name: "Filipino", grades: [88] }],
        generalAverage: "88",
        promotionStatus: "Promoted",
      },
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      [],
      academicRecords,
      getSubjectWeights
    );
    expect(result).toEqual([]);
  });

  it("prefers the live classRecords row over an imported row for the same school year + grade level", () => {
    const classRecords = [
      perfectClassRecord({
        learnerId: "learner-1",
        subject: "Filipino",
        term: "Term 1",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
    ];
    const academicRecords = [
      {
        lrn: "123456789012",
        schoolYear: "2026-2027",
        gradeLevel: "7",
        learningAreas: [{ name: "Filipino", grades: [70] }],
        generalAverage: "70",
        promotionStatus: "Promoted",
      },
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      classRecords,
      academicRecords,
      getSubjectWeights
    );
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("live");
    expect(result[0].subjects.FILIPINO).toBe(100);
  });

  it("merges and sorts a live year and an imported year chronologically regardless of input order", () => {
    const classRecords = [
      perfectClassRecord({
        learnerId: "learner-1",
        subject: "Filipino",
        term: "Term 1",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
    ];
    const academicRecords = [
      {
        lrn: "123456789012",
        schoolYear: "2024-2025",
        gradeLevel: "6",
        learningAreas: [{ name: "Filipino", grades: [85] }],
        generalAverage: "85",
        promotionStatus: "Promoted",
      },
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      classRecords,
      academicRecords,
      getSubjectWeights
    );
    expect(result.map((r) => r.schoolYear)).toEqual(["2024-2025", "2026-2027"]);
    expect(result.map((r) => r.source)).toEqual(["imported", "live"]);
  });
});
