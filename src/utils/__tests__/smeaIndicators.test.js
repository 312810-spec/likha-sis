import { describe, it, expect } from "vitest";
import computeSMEAIndicators from "../smeaIndicators.js";

describe("computeSMEAIndicators", () => {
  it("computes an average attendance rate per grade from attendance docs in the selected school year", () => {
    // 2026-08 has 21 weekdays; l1 has 1 absence -> 20/21 present.
    const attendanceDocs = [
      { gradeLevel: "Grade 7", section: "A", month: "2026-08", records: { l1: { "2026-08-03": "A" } } },
      // Different school year -> excluded.
      { gradeLevel: "Grade 7", section: "A", month: "2025-08", records: {} },
    ];

    const result = computeSMEAIndicators({ attendanceDocs, selectedSY: "2026-2027" });

    const row = result.rows.find((r) => r.grade === "Grade 7");
    expect(row.attendanceRate).toBeCloseTo((20 / 21) * 100, 5);
  });

  it("computes nutrition status percentages per grade from nutritionRecords", () => {
    const nutritionRecords = [
      { gradeLevel: "Grade 7", section: "A", schoolYear: "2026-2027", period: "Baseline", sex: "Male", nutritionalStatus: "Normal" },
      { gradeLevel: "Grade 7", section: "A", schoolYear: "2026-2027", period: "Baseline", sex: "Female", nutritionalStatus: "Wasted" },
    ];

    const result = computeSMEAIndicators({
      nutritionRecords,
      selectedSY: "2026-2027",
      nutritionPeriod: "Baseline",
    });

    const row = result.rows.find((r) => r.grade === "Grade 7");
    expect(row.nutrition.weighedCount).toBe(2);
    expect(row.nutrition.normalPct).toBeCloseTo(50, 5);
    expect(row.nutrition.wastedPct).toBeCloseTo(50, 5);
  });

  it("counts learners currently in LARDO monitoring status per grade", () => {
    const lardoRecords = [
      { gradeLevel: "Grade 7", schoolYear: "2026-2027", status: "monitoring" },
      { gradeLevel: "Grade 7", schoolYear: "2026-2027", status: "resolved" },
      { gradeLevel: "Grade 8", schoolYear: "2026-2027", status: "monitoring" },
    ];

    const result = computeSMEAIndicators({ lardoRecords, selectedSY: "2026-2027" });

    expect(result.rows.find((r) => r.grade === "Grade 7").lardoMonitoringCount).toBe(1);
    expect(result.rows.find((r) => r.grade === "Grade 8").lardoMonitoringCount).toBe(1);
  });

  it("returns grades sorted by gradeLevelsOffered order when provided", () => {
    const lardoRecords = [
      { gradeLevel: "Grade 8", schoolYear: "2026-2027", status: "monitoring" },
      { gradeLevel: "Grade 7", schoolYear: "2026-2027", status: "monitoring" },
    ];

    const result = computeSMEAIndicators({
      lardoRecords,
      selectedSY: "2026-2027",
      gradeLevelsOffered: ["Grade 7", "Grade 8", "Grade 9"],
    });

    expect(result.rows.map((r) => r.grade)).toEqual(["Grade 7", "Grade 8"]);
  });

  it("returns an empty rows array when there is no source data at all", () => {
    const result = computeSMEAIndicators({ selectedSY: "2026-2027" });
    expect(result.rows).toEqual([]);
  });
});
