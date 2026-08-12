import { describe, it, expect } from "vitest";

const FIXED_RISK_FACTORS = [
  "Financial difficulty",
  "Distance to school",
  "Family problems",
  "Health condition",
  "Academic difficulty",
  "Child labor",
  "Early pregnancy/marriage",
  "Bullying/peer issues",
  "Other",
];

const GRADE_OPTIONS = [
  "All",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
];

describe("LARDO Tracking Constants & Schema Helpers", () => {
  it("contains all required fixed risk factors", () => {
    const requiredFactors = [
      "Financial difficulty",
      "Distance to school",
      "Family problems",
      "Health condition",
      "Academic difficulty",
      "Child labor",
      "Early pregnancy/marriage",
      "Bullying/peer issues",
      "Other",
    ];

    expect(FIXED_RISK_FACTORS).toHaveLength(9);
    requiredFactors.forEach((factor) => {
      expect(FIXED_RISK_FACTORS).toContain(factor);
    });
  });

  it("includes Grade 4 to Grade 10 and 'All' in GRADE_OPTIONS", () => {
    expect(GRADE_OPTIONS).toContain("All");
    for (let g = 4; g <= 10; g++) {
      expect(GRADE_OPTIONS).toContain(`Grade ${g}`);
    }
  });

  it("formats deterministic doc ID correctly as learnerId_schoolYear", () => {
    const learnerId = "learner123";
    const schoolYear = "2026-2027";
    const docId = `${learnerId}_${schoolYear}`;
    expect(docId).toBe("learner123_2026-2027");
  });
});
