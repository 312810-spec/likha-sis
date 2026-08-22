import { describe, it, expect } from "vitest";
import { consolidateByGradeLevel, withPercentages } from "../nutritionConsolidation.js";

const GRADE_LEVELS = ["Grade 7", "Grade 8"];

function learner(id, gradeLevel, section, sex) {
  return { id, gradeLevel, section, sex, schoolYear: "2026-2027" };
}

function record(learnerId, gradeLevel, section, sex, opts = {}) {
  return {
    learnerId,
    gradeLevel,
    section,
    sex,
    schoolYear: "2026-2027",
    period: "Baseline",
    nutritionalStatus: "Normal",
    heightForAgeStatus: "Normal",
    ...opts,
  };
}

describe("consolidateByGradeLevel", () => {
  it("counts enrolment for every learner in a grade level regardless of weigh-in status", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 7", "Faith", "F"),
      learner("l3", "Grade 7", "Hope", "F"),
    ];
    const result = consolidateByGradeLevel(learners, [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    // Learners in three different sections of the same grade collapse into
    // one grade-level row -- the real workbook has no per-section breakdown.
    expect(result.gradeLevels).toHaveLength(1);
    expect(result.gradeLevels[0].enrolment).toEqual({ M: 1, F: 2, T: 3 });
    expect(result.gradeLevels[0].weighed).toEqual({ M: 0, F: 0, T: 0 });
  });

  it("counts weighed and tallies BMI/HFA categories by sex from matching records", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 7", "Faith", "F"),
    ];
    const records = [
      record("l1", "Grade 7", "Love", "M", { nutritionalStatus: "Wasted", heightForAgeStatus: "Stunted" }),
      record("l2", "Grade 7", "Faith", "F", { nutritionalStatus: "Normal", heightForAgeStatus: "Tall" }),
    ];
    const result = consolidateByGradeLevel(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    const row = result.gradeLevels[0];
    expect(row.weighed).toEqual({ M: 1, F: 1, T: 2 });
    expect(row.bmi.wasted).toEqual({ M: 1, F: 0, T: 1 });
    expect(row.bmi.normal).toEqual({ M: 0, F: 1, T: 1 });
    expect(row.hfa.stunted).toEqual({ M: 1, F: 0, T: 1 });
    expect(row.hfa.tall).toEqual({ M: 0, F: 1, T: 1 });
  });

  it("groups multiple grade levels, ordered by gradeLevelsOffered", () => {
    const learners = [
      learner("l1", "Grade 8", "Peace", "M"),
      learner("l2", "Grade 7", "Love", "F"),
      learner("l3", "Grade 7", "Faith", "M"),
    ];
    const result = consolidateByGradeLevel(learners, [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.gradeLevels.map((g) => g.gradeLevel)).toEqual(["Grade 7", "Grade 8"]);
    expect(result.gradeLevels[0].enrolment).toEqual({ M: 1, F: 1, T: 2 });
  });

  it("isolates Baseline records from Endline records", () => {
    const learners = [learner("l1", "Grade 7", "Love", "M")];
    const records = [
      record("l1", "Grade 7", "Love", "M", { period: "Endline", nutritionalStatus: "Obese" }),
    ];
    const result = consolidateByGradeLevel(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.gradeLevels[0].weighed).toEqual({ M: 0, F: 0, T: 0 });
    expect(result.gradeLevels[0].bmi.obese).toEqual({ M: 0, F: 0, T: 0 });
  });

  it("ignores records for a different schoolYear", () => {
    const learners = [learner("l1", "Grade 7", "Love", "M")];
    const records = [
      record("l1", "Grade 7", "Love", "M", { schoolYear: "2025-2026" }),
    ];
    const result = consolidateByGradeLevel(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.gradeLevels[0].weighed.T).toBe(0);
  });

  it("computes a grandTotal row summing every grade level", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 8", "Peace", "F"),
    ];
    const records = [
      record("l1", "Grade 7", "Love", "M", { nutritionalStatus: "Severely Wasted", heightForAgeStatus: "Severely Stunted" }),
      record("l2", "Grade 8", "Peace", "F", { nutritionalStatus: "Overweight", heightForAgeStatus: "Normal" }),
    ];
    const result = consolidateByGradeLevel(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.grandTotal.enrolment).toEqual({ M: 1, F: 1, T: 2 });
    expect(result.grandTotal.weighed).toEqual({ M: 1, F: 1, T: 2 });
    expect(result.grandTotal.bmi.severelyWasted).toEqual({ M: 1, F: 0, T: 1 });
    expect(result.grandTotal.bmi.overweight).toEqual({ M: 0, F: 1, T: 1 });
    expect(result.grandTotal.hfa.severelyStunted).toEqual({ M: 1, F: 0, T: 1 });
    expect(result.grandTotal.hfa.normal).toEqual({ M: 0, F: 1, T: 1 });
  });

  it("groups a learner with an untrimmed gradeLevel into the same row as its trimmed record", () => {
    // NutritionStatus.jsx always trims gradeLevel when writing
    // nutritionRecords, but learner docs carry whatever was typed in SF1.
    // Untrimmed learner keys must not split one grade into two rows.
    const learners = [
      { id: "l1", gradeLevel: "Grade 7 ", section: "Love", sex: "M", schoolYear: "2026-2027" },
      { id: "l2", gradeLevel: " Grade 7", section: "Faith", sex: "F", schoolYear: "2026-2027" },
    ];
    const records = [
      record("l1", "Grade 7", "Love", "M", { nutritionalStatus: "Wasted", heightForAgeStatus: "Stunted" }),
      record("l2", "Grade 7", "Faith", "F", { nutritionalStatus: "Normal", heightForAgeStatus: "Normal" }),
    ];
    const result = consolidateByGradeLevel(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });

    expect(result.gradeLevels).toHaveLength(1);
    const row = result.gradeLevels[0];
    expect(row.gradeLevel).toBe("Grade 7");
    expect(row.enrolment).toEqual({ M: 1, F: 1, T: 2 });
    expect(row.weighed).toEqual({ M: 1, F: 1, T: 2 });
    expect(row.bmi.wasted).toEqual({ M: 1, F: 0, T: 1 });
    expect(row.hfa.stunted).toEqual({ M: 1, F: 0, T: 1 });
  });

  it("also trims record-side grouping keys, defensively", () => {
    const learners = [learner("l1", "Grade 7", "Love", "M")];
    const records = [record("l1", "Grade 7 ", "Love", "M")];
    const result = consolidateByGradeLevel(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.gradeLevels).toHaveLength(1);
    expect(result.gradeLevels[0].enrolment).toEqual({ M: 1, F: 0, T: 1 });
    expect(result.gradeLevels[0].weighed).toEqual({ M: 1, F: 0, T: 1 });
  });

  it("returns empty gradeLevels and a zeroed grandTotal for no learners", () => {
    const result = consolidateByGradeLevel([], [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.gradeLevels).toEqual([]);
    expect(result.grandTotal.enrolment).toEqual({ M: 0, F: 0, T: 0 });
  });
});

describe("withPercentages", () => {
  it("computes Pupils Weighed % as weighed / enrolment, matching the real workbook's formula", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 7", "Love", "M"),
      learner("l3", "Grade 7", "Love", "M"),
      learner("l4", "Grade 7", "Love", "M"),
    ];
    const records = [record("l1", "Grade 7", "Love", "M")];
    const result = consolidateByGradeLevel(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    const row = withPercentages(result.gradeLevels[0]);
    // 1 weighed / 4 enrolled = 25%, not 1 / (weighed count).
    expect(row.pct.weighed.M).toBeCloseTo(25, 5);
  });

  it("computes each BMI/HFA category % as count / weighed, NOT count / enrolment", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 7", "Love", "M"),
    ];
    // Only 1 of 2 enrolled learners was weighed, and that one is Wasted.
    const records = [
      record("l1", "Grade 7", "Love", "M", { nutritionalStatus: "Wasted", heightForAgeStatus: "Stunted" }),
    ];
    const result = consolidateByGradeLevel(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    const row = withPercentages(result.gradeLevels[0]);
    // 1 wasted / 1 weighed = 100%, NOT 1 / 2 enrolled = 50%.
    expect(row.pct.bmi.wasted.M).toBeCloseTo(100, 5);
    expect(row.pct.hfa.stunted.M).toBeCloseTo(100, 5);
    // A category with zero count still divides cleanly: 0%.
    expect(row.pct.bmi.normal.M).toBe(0);
  });

  it("returns null (not NaN or 0) when the denominator is zero", () => {
    const result = consolidateByGradeLevel([], [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    const row = withPercentages(result.grandTotal);
    expect(row.pct.weighed.T).toBeNull();
    expect(row.pct.bmi.normal.T).toBeNull();
  });
});
