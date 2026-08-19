import { describe, it, expect } from "vitest";
import { consolidateBySection } from "../nutritionConsolidation.js";

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

describe("consolidateBySection", () => {
  it("counts enrolment for every learner in a section regardless of weigh-in status", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 7", "Love", "F"),
      learner("l3", "Grade 7", "Love", "F"),
    ];
    const result = consolidateBySection(learners, [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].enrolment).toEqual({ M: 1, F: 2, T: 3 });
    expect(result.sections[0].weighed).toEqual({ M: 0, F: 0, T: 0 });
  });

  it("counts weighed and tallies BMI/HFA categories by sex from matching records", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 7", "Love", "F"),
    ];
    const records = [
      record("l1", "Grade 7", "Love", "M", { nutritionalStatus: "Wasted", heightForAgeStatus: "Stunted" }),
      record("l2", "Grade 7", "Love", "F", { nutritionalStatus: "Normal", heightForAgeStatus: "Tall" }),
    ];
    const result = consolidateBySection(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    const row = result.sections[0];
    expect(row.weighed).toEqual({ M: 1, F: 1, T: 2 });
    expect(row.bmi.wasted).toEqual({ M: 1, F: 0, T: 1 });
    expect(row.bmi.normal).toEqual({ M: 0, F: 1, T: 1 });
    expect(row.hfa.stunted).toEqual({ M: 1, F: 0, T: 1 });
    expect(row.hfa.tall).toEqual({ M: 0, F: 1, T: 1 });
  });

  it("groups multiple sections across multiple grades, ordered by gradeLevelsOffered then section name", () => {
    const learners = [
      learner("l1", "Grade 8", "Peace", "M"),
      learner("l2", "Grade 7", "Love", "F"),
      learner("l3", "Grade 7", "Faith", "M"),
    ];
    const result = consolidateBySection(learners, [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections.map((s) => `${s.gradeLevel}/${s.section}`)).toEqual([
      "Grade 7/Faith",
      "Grade 7/Love",
      "Grade 8/Peace",
    ]);
  });

  it("isolates Baseline records from Endline records", () => {
    const learners = [learner("l1", "Grade 7", "Love", "M")];
    const records = [
      record("l1", "Grade 7", "Love", "M", { period: "Endline", nutritionalStatus: "Obese" }),
    ];
    const result = consolidateBySection(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections[0].weighed).toEqual({ M: 0, F: 0, T: 0 });
    expect(result.sections[0].bmi.obese).toEqual({ M: 0, F: 0, T: 0 });
  });

  it("ignores records for a different schoolYear", () => {
    const learners = [learner("l1", "Grade 7", "Love", "M")];
    const records = [
      record("l1", "Grade 7", "Love", "M", { schoolYear: "2025-2026" }),
    ];
    const result = consolidateBySection(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections[0].weighed.T).toBe(0);
  });

  it("computes a grandTotal row summing every section", () => {
    const learners = [
      learner("l1", "Grade 7", "Love", "M"),
      learner("l2", "Grade 8", "Peace", "F"),
    ];
    const records = [
      record("l1", "Grade 7", "Love", "M", { nutritionalStatus: "Severely Wasted", heightForAgeStatus: "Severely Stunted" }),
      record("l2", "Grade 8", "Peace", "F", { nutritionalStatus: "Overweight", heightForAgeStatus: "Normal" }),
    ];
    const result = consolidateBySection(learners, records, {
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

  it("groups a learner with untrimmed gradeLevel/section into the same row as its trimmed record", () => {
    // NutritionStatus.jsx always trims gradeLevel/section when writing
    // nutritionRecords, but learner docs carry whatever was typed in SF1.
    // Untrimmed learner keys must not split one section into two rows.
    const learners = [
      { id: "l1", gradeLevel: "Grade 7 ", section: " Love", sex: "M", schoolYear: "2026-2027" },
      { id: "l2", gradeLevel: " Grade 7", section: "Love ", sex: "F", schoolYear: "2026-2027" },
    ];
    const records = [
      record("l1", "Grade 7", "Love", "M", { nutritionalStatus: "Wasted", heightForAgeStatus: "Stunted" }),
      record("l2", "Grade 7", "Love", "F", { nutritionalStatus: "Normal", heightForAgeStatus: "Normal" }),
    ];
    const result = consolidateBySection(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });

    expect(result.sections).toHaveLength(1);
    const row = result.sections[0];
    expect(row.gradeLevel).toBe("Grade 7");
    expect(row.section).toBe("Love");
    // Same row carries both the enrolment and the weighed counts.
    expect(row.enrolment).toEqual({ M: 1, F: 1, T: 2 });
    expect(row.weighed).toEqual({ M: 1, F: 1, T: 2 });
    expect(row.bmi.wasted).toEqual({ M: 1, F: 0, T: 1 });
    expect(row.hfa.stunted).toEqual({ M: 1, F: 0, T: 1 });
  });

  it("also trims record-side grouping keys, defensively", () => {
    const learners = [learner("l1", "Grade 7", "Love", "M")];
    const records = [record("l1", "Grade 7 ", " Love ", "M")];
    const result = consolidateBySection(learners, records, {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].enrolment).toEqual({ M: 1, F: 0, T: 1 });
    expect(result.sections[0].weighed).toEqual({ M: 1, F: 0, T: 1 });
  });

  it("returns empty sections and a zeroed grandTotal for no learners", () => {
    const result = consolidateBySection([], [], {
      schoolYear: "2026-2027",
      period: "Baseline",
      gradeLevelsOffered: GRADE_LEVELS,
    });
    expect(result.sections).toEqual([]);
    expect(result.grandTotal.enrolment).toEqual({ M: 0, F: 0, T: 0 });
  });
});
