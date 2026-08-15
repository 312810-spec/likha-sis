import { describe, it, expect } from "vitest";
import {
  computeSF4Rows,
  computeSectionAttendance,
  isDropoutRemark,
} from "../sf4Computations";

// Convenience builder for a learner object with a normalized sex field.
function learner(sex, enrollmentStatus = "active") {
  return { sex, enrollmentStatus };
}

describe("isDropoutRemark", () => {
  it("returns true when the string starts with 'Dropped Out'", () => {
    expect(isDropoutRemark("Dropped Out")).toBe(true);
    expect(isDropoutRemark("Dropped Out - b3: Death")).toBe(true);
    expect(isDropoutRemark("  Dropped Out - a4: Family problems")).toBe(true);
    expect(isDropoutRemark("DROPPED OUT")).toBe(false); // startsWith is case-sensitive
  });

  it("returns false for non-dropout remarks and non-strings", () => {
    expect(isDropoutRemark("Transferred In")).toBe(false);
    expect(isDropoutRemark("Transferred Out")).toBe(false);
    expect(isDropoutRemark("Present")).toBe(false);
    expect(isDropoutRemark("")).toBe(false);
    expect(isDropoutRemark(null)).toBe(false);
    expect(isDropoutRemark(undefined)).toBe(false);
    expect(isDropoutRemark(123)).toBe(false);
  });
});

describe("computeSectionAttendance", () => {
  it("computes daily averages and percentages per sex", () => {
    const result = computeSectionAttendance({
      records: {
        m1: { "2026-08-03": "A", "2026-08-04": "A" }, // 2 absences
        m2: { "2026-08-05": "A", "2026-08-06": "A", "2026-08-07": "A" }, // 3 absences
        f1: {},
      },
      learnerIds: { male: ["m1", "m2"], female: ["f1"] },
      weekdaysCount: 10,
    });

    // Male: (10-2) + (10-3) = 15 present days -> avg 1.5 -> 75%
    expect(result.dailyAverageMale).toBeCloseTo(1.5, 5);
    expect(result.percentageMale).toBeCloseTo(75, 5);
    // Female: 10 present days -> avg 1.0 -> 100%
    expect(result.dailyAverageFemale).toBeCloseTo(1, 5);
    expect(result.percentageFemale).toBeCloseTo(100, 5);
    // Combined: 25 present days / 10 -> avg 2.5 -> 2.5/3 = 83.33%
    expect(result.dailyAverageTotal).toBeCloseTo(2.5, 5);
    expect(result.percentageTotal).toBeCloseTo((2.5 / 3) * 100, 5);
  });

  it("counts tardy (T) as present — only A marks are absences", () => {
    const result = computeSectionAttendance({
      records: {
        m1: { "2026-08-01": "T", "2026-08-02": "T" },
        f1: { "2026-08-01": "A" },
      },
      learnerIds: { male: ["m1"], female: ["f1"] },
      weekdaysCount: 10,
    });
    expect(result.dailyAverageMale).toBeCloseTo(1, 5); // m1 attended all 10 days
    expect(result.percentageMale).toBeCloseTo(100, 5);
    expect(result.dailyAverageFemale).toBeCloseTo(0.9, 5); // 9 / 10
    expect(result.percentageFemale).toBeCloseTo(90, 5);
  });

  it("returns full attendance when there are no absence records", () => {
    const result = computeSectionAttendance({
      records: {},
      learnerIds: { male: ["m1", "m2"], female: ["f1"] },
      weekdaysCount: 20,
    });
    expect(result.dailyAverageTotal).toBeCloseTo(3, 5);
    expect(result.percentageTotal).toBeCloseTo(100, 5);
  });

  it("handles zero weekdays and empty learner lists", () => {
    const empty = computeSectionAttendance({ records: {}, learnerIds: {}, weekdaysCount: 0 });
    expect(empty.dailyAverageTotal).toBe(0);
    expect(empty.percentageMale).toBeNull();
    expect(empty.percentageFemale).toBeNull();
    expect(empty.percentageTotal).toBeNull();

    const noDays = computeSectionAttendance({
      records: {},
      learnerIds: { male: ["m1"] },
      weekdaysCount: 0,
    });
    expect(noDays.dailyAverageMale).toBe(0);
    expect(noDays.percentageMale).toBe(0);
  });
});

describe("computeSF4Rows", () => {
  it("reports registered (end of month) learners when there is no movement", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal"],
      learnersBySection: {
        Rizal: [learner("Male"), learner("Male"), learner("Female"), learner("Female")],
      },
      transfersInMonth: [],
      nlpaInMonth: [],
    });

    const sectionRow = rows[0];
    expect(sectionRow.section).toBe("Rizal");
    expect(sectionRow.endOfMonthMale).toBe(2);
    expect(sectionRow.endOfMonthFemale).toBe(2);
    expect(sectionRow.endOfMonthTotal).toBe(4);
    expect(sectionRow.transferredInForMonth).toEqual({ male: 0, female: 0, total: 0 });
    expect(sectionRow.transferredOutForMonth).toEqual({ male: 0, female: 0, total: 0 });
    expect(sectionRow.nlpaForMonth).toEqual({ male: 0, female: 0, total: 0 });
    // Cumulative periods default to zeros when no previous-month input exists.
    expect(sectionRow.nlpaPrev).toEqual({ male: 0, female: 0, total: 0 });
    expect(sectionRow.nlpaCumulative).toEqual({ male: 0, female: 0, total: 0 });
    expect(sectionRow.transferredInCumulative).toEqual({ male: 0, female: 0, total: 0 });
    expect(sectionRow.transferredOutCumulative).toEqual({ male: 0, female: 0, total: 0 });
    expect(sectionRow.attendance).toBeNull();
    expect(sectionRow.adviserName).toBe("");
  });

  it("accounts for sex-split transfers in and out", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal"],
      learnersBySection: {
        Rizal: [learner("Male"), learner("Male"), learner("Female")],
      },
      transfersInMonth: [
        { section: "Rizal", transferType: "in", sex: "Male" },
        { section: "Rizal", transferType: "in", sex: "Female" },
        { section: "Rizal", transferType: "in", sex: "" }, // unknown sex skipped
        { section: "Rizal", transferType: "out", sex: "Female" },
      ],
      nlpaInMonth: [],
    });

    const sectionRow = rows[0];
    expect(sectionRow.endOfMonthTotal).toBe(3);
    expect(sectionRow.transferredInForMonth).toEqual({ male: 1, female: 1, total: 2 });
    expect(sectionRow.transferredOutForMonth).toEqual({ male: 0, female: 1, total: 1 });
    // (A+B) = 0 previous + for-the-month
    expect(sectionRow.transferredInCumulative).toEqual({ male: 1, female: 1, total: 2 });
    expect(sectionRow.transferredOutCumulative).toEqual({ male: 0, female: 1, total: 1 });
  });

  it("counts NLPA (dropouts) by sex and ignores non-active learners", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal"],
      learnersBySection: {
        Rizal: [
          learner("Male"),
          learner("Male"),
          learner("Female"),
          learner("Female"),
          learner("Male", "transferred-out"), // not active -> excluded
        ],
      },
      transfersInMonth: [],
      nlpaInMonth: [{ section: "Rizal", sex: "Female" }],
    });

    const sectionRow = rows[0];
    expect(sectionRow.endOfMonthTotal).toBe(4);
    expect(sectionRow.nlpaForMonth).toEqual({ male: 0, female: 1, total: 1 });
    expect(sectionRow.nlpaCumulative).toEqual({ male: 0, female: 1, total: 1 });
  });

  it("builds (A+B) cumulative from the previous-month cumulative input", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal"],
      learnersBySection: {
        Rizal: [learner("Male"), learner("Female")],
      },
      transfersInMonth: [
        { section: "Rizal", transferType: "in", sex: "Male" },
        { section: "Rizal", transferType: "in", sex: "Female" },
      ],
      nlpaInMonth: [{ section: "Rizal", sex: "Male" }],
      previousMonthCumulative: {
        nlpa: { male: 3, female: 2 },
        transferredOut: { male: 1, female: 0 },
        transferredIn: { male: 4, female: 1 },
      },
    });

    const sectionRow = rows[0];
    // NLPA: prev {3,2} + for-the-month {1,0}
    expect(sectionRow.nlpaPrev).toEqual({ male: 3, female: 2, total: 5 });
    expect(sectionRow.nlpaForMonth).toEqual({ male: 1, female: 0, total: 1 });
    expect(sectionRow.nlpaCumulative).toEqual({ male: 4, female: 2, total: 6 });
    // Transferred in: prev {4,1} + for-the-month {1,1}
    expect(sectionRow.transferredInPrev).toEqual({ male: 4, female: 1, total: 5 });
    expect(sectionRow.transferredInCumulative).toEqual({ male: 5, female: 2, total: 7 });
    // Transferred out: prev {1,0} + 0
    expect(sectionRow.transferredOutPrev).toEqual({ male: 1, female: 0, total: 1 });
    expect(sectionRow.transferredOutCumulative).toEqual({ male: 1, female: 0, total: 1 });
  });

  it("supports per-section previous-month cumulative keys", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal"],
      learnersBySection: { Rizal: [learner("Male"), learner("Female")] },
      transfersInMonth: [],
      nlpaInMonth: [],
      previousMonthCumulative: {
        nlpa: { Rizal: { male: 5, female: 0 }, other: { male: 99, female: 99 } },
      },
    });
    expect(rows[0].nlpaPrev).toEqual({ male: 5, female: 0, total: 5 });
    expect(rows[0].nlpaCumulative).toEqual({ male: 5, female: 0, total: 5 });
  });

  it("attaches advisers and attendance to each row", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal"],
      learnersBySection: { Rizal: [learner("Male"), learner("Female")] },
      transfersInMonth: [],
      nlpaInMonth: [],
      advisersBySection: { Rizal: "Ms. Dela Cruz" },
      attendanceBySection: {
        Rizal: {
          dailyAverageMale: 1.5,
          dailyAverageFemale: 1,
          dailyAverageTotal: 2.5,
          percentageMale: 75,
          percentageFemale: 100,
          percentageTotal: 83.33333333333334,
        },
      },
    });
    expect(rows[0].adviserName).toBe("Ms. Dela Cruz");
    expect(rows[0].attendance.dailyAverageTotal).toBe(2.5);
  });

  it("sums all sections into a totals row", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal", "Bonifacio"],
      learnersBySection: {
        Rizal: [learner("Male"), learner("Male"), learner("Female"), learner("Female")],
        Bonifacio: [learner("Male"), learner("Female")],
      },
      transfersInMonth: [
        { section: "Rizal", transferType: "in", sex: "Male" },
        { section: "Bonifacio", transferType: "out", sex: "Female" },
      ],
      nlpaInMonth: [{ section: "Bonifacio", sex: "Female" }],
    });

    expect(rows).toHaveLength(3);

    const [rizal, bonifacio, totals] = rows;
    expect(rizal.endOfMonthTotal).toBe(4);
    expect(rizal.transferredInForMonth).toEqual({ male: 1, female: 0, total: 1 });

    expect(bonifacio.endOfMonthTotal).toBe(2);
    expect(bonifacio.transferredOutForMonth).toEqual({ male: 0, female: 1, total: 1 });
    expect(bonifacio.nlpaForMonth).toEqual({ male: 0, female: 1, total: 1 });

    expect(totals.section).toBe("TOTAL");
    expect(totals.endOfMonthMale).toBe(3); // 2 + 1
    expect(totals.endOfMonthFemale).toBe(3); // 2 + 1
    expect(totals.endOfMonthTotal).toBe(6); // 4 + 2
    expect(totals.transferredInForMonth).toEqual({ male: 1, female: 0, total: 1 });
    expect(totals.transferredOutForMonth).toEqual({ male: 0, female: 1, total: 1 });
    expect(totals.nlpaForMonth).toEqual({ male: 0, female: 1, total: 1 });
  });

  it("recomputes attendance percentages on the totals row", () => {
    const rows = computeSF4Rows({
      sections: ["Rizal", "Bonifacio"],
      learnersBySection: {
        Rizal: [learner("Male"), learner("Female")],
        Bonifacio: [learner("Male")],
      },
      transfersInMonth: [],
      nlpaInMonth: [],
      attendanceBySection: {
        Rizal: {
          dailyAverageMale: 1.5,
          dailyAverageFemale: 1,
          dailyAverageTotal: 2.5,
          percentageMale: 75,
          percentageFemale: 100,
          percentageTotal: 83.33333333333334,
        },
        Bonifacio: {
          dailyAverageMale: 1,
          dailyAverageFemale: 0,
          dailyAverageTotal: 1,
          percentageMale: 100,
          percentageFemale: null,
          percentageTotal: 100,
        },
      },
    });

    const totals = rows[2];
    expect(totals.attendance.dailyAverageMale).toBeCloseTo(2.5, 5);
    expect(totals.attendance.dailyAverageFemale).toBeCloseTo(1, 5);
    expect(totals.attendance.dailyAverageTotal).toBeCloseTo(3.5, 5);
    expect(totals.attendance.percentageMale).toBeCloseTo((2.5 / 2) * 100, 5);
    expect(totals.attendance.percentageFemale).toBeCloseTo(100, 5);
    expect(totals.attendance.percentageTotal).toBeCloseTo((3.5 / 3) * 100, 5);
  });
});
