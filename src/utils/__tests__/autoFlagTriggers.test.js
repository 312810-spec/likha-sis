import { describe, it, expect } from "vitest";
import { checkAutoFlagTriggers } from "../autoFlagTriggers";

describe("checkAutoFlagTriggers", () => {
  it("returns null for passing grades and no nutrition issue", () => {
    const res = checkAutoFlagTriggers({ generalAverage: 85, subjectFinalGrades: [80, 90, 88], nutritionStatus: "Normal" });
    expect(res).toBeNull();
  });

  it("flags when general average is below 75", () => {
    const res = checkAutoFlagTriggers({ generalAverage: 68.5, subjectFinalGrades: null, nutritionStatus: null });
    expect(res).not.toBeNull();
    expect(res.riskFactors).toContain("Academic difficulty");
    expect(res.reasons[0]).toMatch(/General Average 68.5/);
  });

  it("flags when a subject final grade is below 75", () => {
    const res = checkAutoFlagTriggers({ generalAverage: null, subjectFinalGrades: [78, 74, 80], nutritionStatus: null });
    expect(res).not.toBeNull();
    expect(res.riskFactors).toContain("Academic difficulty");
    expect(res.reasons).toContain("Final Grade below passing mark");
  });

  it("flags when nutrition status is concerning", () => {
    const res = checkAutoFlagTriggers({ generalAverage: null, subjectFinalGrades: null, nutritionStatus: "Severely Wasted" });
    expect(res).not.toBeNull();
    expect(res.riskFactors).toContain("Health condition");
    expect(res.reasons[0]).toBe("Nutrition status: Severely Wasted");
  });

  it("does not flag at boundary exactly 75", () => {
    const res = checkAutoFlagTriggers({ generalAverage: 75, subjectFinalGrades: [75, 80], nutritionStatus: "Normal" });
    expect(res).toBeNull();
  });

  it("flags when attendance rate is below 80", () => {
    const res = checkAutoFlagTriggers({ generalAverage: null, subjectFinalGrades: null, nutritionStatus: null, attendanceRate: 60 });
    expect(res).not.toBeNull();
    expect(res.riskFactors).toContain("Attendance concern");
    expect(res.reasons[0]).toBe("Attendance rate of 60 percent, below the 80 percent threshold");
  });

  it("does not flag at attendance rate 80 or above", () => {
    expect(checkAutoFlagTriggers({ attendanceRate: 80 })).toBeNull();
    expect(checkAutoFlagTriggers({ attendanceRate: 95 })).toBeNull();
  });

  it("ignores null attendance rate like the other nullable params", () => {
    const res = checkAutoFlagTriggers({ generalAverage: 85, subjectFinalGrades: [80, 90], nutritionStatus: "Normal", attendanceRate: null });
    expect(res).toBeNull();
  });

  it("flags only Attendance concern when attendance is low but general average is passing", () => {
    const res = checkAutoFlagTriggers({ generalAverage: 88, subjectFinalGrades: null, nutritionStatus: null, attendanceRate: 70 });
    expect(res).not.toBeNull();
    expect(res.riskFactors).toEqual(["Attendance concern"]);
    expect(res.riskFactors).not.toContain("Academic difficulty");
  });

  it("flags when Initial Grade is below 70", () => {
    const res = checkAutoFlagTriggers({ initialGrade: 65.333 });
    expect(res).not.toBeNull();
    expect(res.riskFactors).toContain("Academic difficulty");
    expect(res.reasons[0]).toBe("Initial Grade 65.33 below the 70 intervention threshold");
  });

  it("does not flag at Initial Grade boundary exactly 70", () => {
    expect(checkAutoFlagTriggers({ initialGrade: 70 })).toBeNull();
  });

  it("does not duplicate Academic difficulty when both Initial Grade and general average trigger", () => {
    const res = checkAutoFlagTriggers({ generalAverage: 68, initialGrade: 65 });
    expect(res.riskFactors).toEqual(["Academic difficulty"]);
    expect(res.reasons).toHaveLength(2);
  });
});
