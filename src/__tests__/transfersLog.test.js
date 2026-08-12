import { describe, it, expect } from "vitest";

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

describe("Transfers Log Constants & Schema Helpers", () => {
  it("includes Grade 4 to Grade 10 and 'All' in GRADE_OPTIONS", () => {
    expect(GRADE_OPTIONS).toContain("All");
    for (let g = 4; g <= 10; g++) {
      expect(GRADE_OPTIONS).toContain(`Grade ${g}`);
    }
  });

  it("maps transferType correctly to learner enrollmentStatus", () => {
    const getEnrollmentStatus = (transferType) =>
      transferType === "out" ? "transferred-out" : "active";

    expect(getEnrollmentStatus("out")).toBe("transferred-out");
    expect(getEnrollmentStatus("in")).toBe("active");
  });

  it("defaults missing enrollmentStatus on learner doc to 'active'", () => {
    const learnerDoc = { id: "learner1", lastName: "Dela Cruz", firstName: "Juan" };
    const effectiveStatus = learnerDoc.enrollmentStatus || "active";
    expect(effectiveStatus).toBe("active");
  });

  it("constructs a valid transfer document shape", () => {
    const transferDoc = {
      learnerId: "l123",
      learnerName: "Dela Cruz, Juan",
      learnerLRN: "123456789012",
      gradeLevel: "Grade 7",
      section: "Sampaguita",
      schoolYear: "2026-2027",
      transferType: "out",
      otherSchool: "Central High School",
      transferDate: "2026-08-13",
      reason: "Family relocated",
      recordedByEmail: "teacher@example.com",
    };

    expect(transferDoc.transferType).toMatch(/^(in|out)$/);
    expect(transferDoc.learnerId).toBe("l123");
    expect(transferDoc.otherSchool).toBe("Central High School");
  });
});
