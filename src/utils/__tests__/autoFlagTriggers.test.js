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
});
