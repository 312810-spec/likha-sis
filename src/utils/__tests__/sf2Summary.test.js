// src/utils/__tests__/sf2Summary.test.js
// PRIVACY: every learner id/name below is INVENTED.

import { describe, it, expect } from "vitest";
import {
  cycleAttendanceValue,
  monthlyLearnerCounts,
  monthlyGroupTotals,
  groupCountOnDate,
  groupDailyTotals,
  computeMonthlySummary,
  countAbsentFiveConsecutiveDays,
  countDroppedOut,
} from "../sf2Summary.js";

const WEEKDAYS = [
  { day: 3, label: "M", dateString: "2026-08-03" },
  { day: 4, label: "T", dateString: "2026-08-04" },
  { day: 5, label: "W", dateString: "2026-08-05" },
  { day: 6, label: "TH", dateString: "2026-08-06" },
  { day: 7, label: "F", dateString: "2026-08-07" },
];

describe("cycleAttendanceValue", () => {
  it("cycles Present -> Absent -> Tardy -> Present", () => {
    expect(cycleAttendanceValue("")).toBe("A");
    expect(cycleAttendanceValue("A")).toBe("T");
    expect(cycleAttendanceValue("T")).toBe("");
  });
});

describe("monthlyLearnerCounts", () => {
  const records = {
    juan: { "2026-08-03": "A", "2026-08-04": "A", "2026-08-05": "T" },
    maria: {},
  };

  it("computes present as school days minus absences; tardy does not reduce present", () => {
    const juan = monthlyLearnerCounts(records, "juan", WEEKDAYS);
    expect(juan.absent).toBe(2);
    expect(juan.tardy).toBe(1);
    expect(juan.present).toBe(3); // 5 weekdays - 2 absences
  });

  it("a learner with no exceptions is present every school day", () => {
    const maria = monthlyLearnerCounts(records, "maria", WEEKDAYS);
    expect(maria).toEqual({ absent: 0, tardy: 0, present: 5 });
  });

  it("a learner missing from records entirely is treated as fully present", () => {
    const ghost = monthlyLearnerCounts(records, "unknown-id", WEEKDAYS);
    expect(ghost).toEqual({ absent: 0, tardy: 0, present: 5 });
  });
});

describe("monthlyGroupTotals / groupCountOnDate / groupDailyTotals", () => {
  const records = {
    juan: { "2026-08-03": "A" },
    pedro: { "2026-08-03": "A", "2026-08-04": "T" },
    maria: {},
  };

  it("sums monthly counts across a group", () => {
    const totals = monthlyGroupTotals(["juan", "pedro"], records, WEEKDAYS);
    expect(totals.absent).toBe(2);
    expect(totals.tardy).toBe(1);
    expect(totals.present).toBe(4 + 4); // juan:4, pedro:4 (5-1 each)
  });

  it("counts a specific code on one date across a group", () => {
    expect(groupCountOnDate(["juan", "pedro", "maria"], records, "2026-08-03", "A")).toBe(2);
    expect(groupCountOnDate(["juan", "pedro", "maria"], records, "2026-08-04", "T")).toBe(1);
  });

  it("builds a Present/Absent/Tardy/Total row for one date", () => {
    const totals = groupDailyTotals(["juan", "pedro", "maria"], records, "2026-08-03");
    expect(totals).toEqual({ present: 1, absent: 2, tardy: 0, total: 3 });
  });
});

describe("computeMonthlySummary", () => {
  it("computes registered/school days/attendance percentages and Absent+Present totals", () => {
    const records = {
      juan: { "2026-08-03": "A" },
      maria: { "2026-08-03": "A", "2026-08-04": "A" },
    };
    const summary = computeMonthlySummary({
      maleLearnerIds: ["juan"],
      femaleLearnerIds: ["maria"],
      weekdays: WEEKDAYS,
      records,
      enrolmentFirstFriday: 2,
    });

    expect(summary.numberSchoolDays).toBe(5);
    // Aug 3: both absent -> 0 present. Aug 4: maria absent -> 1 present.
    // Aug 5-7: nobody absent -> 2 present each. Total = 0+1+2+2+2 = 7.
    expect(summary.totalDailyAttendance).toBe(7);
    expect(summary.averageDailyAttendance).toBeCloseTo(7 / 5, 6);
    expect(summary.pctEnrolment).toBeCloseTo(100, 6); // 2 registered / 2 enrolled
    expect(summary.monthlyAbsentTotal).toBe(3); // juan:1 + maria:2
    expect(summary.monthlyPresentTotal).toBe(4 + 3); // juan:4, maria:3
  });

  it("returns null percentages rather than dividing by zero", () => {
    const summary = computeMonthlySummary({
      maleLearnerIds: [],
      femaleLearnerIds: [],
      weekdays: WEEKDAYS,
      records: {},
      enrolmentFirstFriday: 0,
    });
    expect(summary.pctEnrolment).toBeNull();
    expect(summary.pctAttendance).toBeNull();
  });

  it("includes the 5-consecutive-day and dropped-out summary fields", () => {
    const summary = computeMonthlySummary({
      maleLearnerIds: ["juan"],
      femaleLearnerIds: ["maria"],
      weekdays: WEEKDAYS,
      records: {
        juan: {
          "2026-08-03": "A",
          "2026-08-04": "A",
          "2026-08-05": "A",
          "2026-08-06": "A",
          "2026-08-07": "A",
        },
        maria: {},
      },
      remarksData: { maria: "Dropped Out - b3: Death" },
      enrolmentFirstFriday: 2,
    });
    expect(summary.absentFiveConsecutiveDays).toBe(1);
    expect(summary.droppedOut).toBe(1);
  });
});

describe("countAbsentFiveConsecutiveDays", () => {
  it("counts a learner absent every school day this month (streak reaches 5)", () => {
    const records = {
      juan: {
        "2026-08-03": "A",
        "2026-08-04": "A",
        "2026-08-05": "A",
        "2026-08-06": "A",
        "2026-08-07": "A",
      },
    };
    expect(countAbsentFiveConsecutiveDays(["juan"], records, WEEKDAYS)).toBe(1);
  });

  it("does not count a streak broken by a Present or Tardy day", () => {
    const records = {
      juan: {
        "2026-08-03": "A",
        "2026-08-04": "A",
        "2026-08-05": "T",
        "2026-08-06": "A",
        "2026-08-07": "A",
      },
    };
    expect(countAbsentFiveConsecutiveDays(["juan"], records, WEEKDAYS)).toBe(0);
  });
});

describe("countDroppedOut", () => {
  it("counts only learners whose remark starts with 'Dropped Out'", () => {
    const remarksData = {
      juan: "Dropped Out - b3: Death",
      maria: "Transferred Out - Public School XYZ",
      pedro: "Dropped Out - d2: Armed conflict (incl. Tribal wars & clanfeuds)",
    };
    expect(countDroppedOut(["juan", "maria", "pedro"], remarksData)).toBe(2);
  });

  it("returns 0 when no remarks are set", () => {
    expect(countDroppedOut(["juan", "maria"], {})).toBe(0);
  });
});
