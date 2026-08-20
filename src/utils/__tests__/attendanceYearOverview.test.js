import { describe, it, expect } from "vitest";
import buildAttendanceYearOverview from "../attendanceYearOverview.js";

describe("buildAttendanceYearOverview", () => {
  it("computes each learner's monthly attendance rate from A-marks against weekdays in the month", () => {
    // 2026-08 has 21 weekdays (Aug 1 2026 is a Saturday, Aug 31 is a Monday).
    const monthDocs = [
      {
        month: "2026-08",
        records: { l1: { "2026-08-03": "A", "2026-08-04": "A" } },
      },
    ];
    const learners = [{ id: "l1", lastName: "Cruz", firstName: "Ana" }];

    const overview = buildAttendanceYearOverview({ monthDocs, learners });

    expect(overview.months).toEqual(["2026-08"]);
    const rate = overview.perLearner[0].monthlyRates["2026-08"];
    // 2 absences out of 21 weekdays -> 19/21 present.
    expect(rate).toBeCloseTo((19 / 21) * 100, 5);
  });

  it("sorts months chronologically regardless of input order", () => {
    const monthDocs = [
      { month: "2026-10", records: {} },
      { month: "2026-08", records: {} },
      { month: "2026-09", records: {} },
    ];

    const overview = buildAttendanceYearOverview({ monthDocs, learners: [] });

    expect(overview.months).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("computes a learner's year average across only the months with data", () => {
    const monthDocs = [
      { month: "2026-08", records: {} }, // no absences -> 100%
      { month: "2026-09", records: { l1: { "2026-09-01": "A" } } },
    ];
    const learners = [{ id: "l1", lastName: "Cruz", firstName: "Ana" }];

    const overview = buildAttendanceYearOverview({ monthDocs, learners });
    const [aug, sep] = overview.months.map((m) => overview.perLearner[0].monthlyRates[m]);

    expect(overview.perLearner[0].yearAverage).toBeCloseTo((aug + sep) / 2, 5);
  });

  it("computes a class-wide average per month across all learners with data that month", () => {
    const monthDocs = [
      {
        month: "2026-08",
        records: { l1: { "2026-08-03": "A" }, l2: {} },
      },
    ];
    const learners = [
      { id: "l1", lastName: "Cruz", firstName: "Ana" },
      { id: "l2", lastName: "Reyes", firstName: "Ben" },
    ];

    const overview = buildAttendanceYearOverview({ monthDocs, learners });
    const l1Rate = overview.perLearner[0].monthlyRates["2026-08"];
    const l2Rate = overview.perLearner[1].monthlyRates["2026-08"];

    expect(overview.classAverage["2026-08"]).toBeCloseTo((l1Rate + l2Rate) / 2, 5);
  });

  it("returns an empty overview when there are no attendance docs", () => {
    const overview = buildAttendanceYearOverview({ monthDocs: [], learners: [] });

    expect(overview.months).toEqual([]);
    expect(overview.perLearner).toEqual([]);
    expect(overview.classAverage).toEqual({});
  });
});
