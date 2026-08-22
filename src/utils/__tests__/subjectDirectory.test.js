import { describe, it, expect } from "vitest";
import {
  getSubjectsForGradeLevel,
  getKeyStageForGradeLevel,
  resolveGrade12Curriculum,
} from "../subjectDirectory";

describe("subjectDirectory", () => {
  it("Grade 8 returns only the KS3 learning areas, no SHS or elementary-only entries", () => {
    const labels = getSubjectsForGradeLevel("Grade 8").map((s) => s.label);
    expect(labels).toContain("Mathematics");
    expect(labels).toContain("MAPEH");
    expect(labels).not.toContain("General Mathematics");
    expect(labels).not.toContain("Makabansa (National Identity, Civics & Culture)");
  });

  it("Grade 10 returns the same KS3 set (MATATAG combined MAPEH, one entry)", () => {
    const labels = getSubjectsForGradeLevel("Grade 10").map((s) => s.label);
    expect(labels.filter((l) => l === "MAPEH")).toHaveLength(1);
  });

  it("Grade 11 returns the streamlined core + elective clusters, not the Grade 12 set", () => {
    const labels = getSubjectsForGradeLevel("Grade 11").map((s) => s.label);
    expect(labels).toContain("General Mathematics");
    expect(labels).toContain("Pre-Calculus 1");
    expect(labels).not.toContain("Practical Research 1");
  });

  it("Grade 12 returns the applied + strand set, distinct from Grade 11", () => {
    const labels = getSubjectsForGradeLevel("Grade 12").map((s) => s.label);
    expect(labels).toContain("Practical Research 1");
    expect(labels).toContain("General Biology 2");
    expect(labels).not.toContain("General Mathematics");
  });

  it("SHS subjects default to all three terms (source document has no per-subject term breakdown)", () => {
    const term1 = getSubjectsForGradeLevel("Grade 11", { term: 1 }).map((s) => s.label);
    const term3 = getSubjectsForGradeLevel("Grade 11", { term: 3 }).map((s) => s.label);
    expect(term1).toContain("General Mathematics");
    expect(term3).toContain("General Mathematics");
    expect(term1).toEqual(getSubjectsForGradeLevel("Grade 11").map((s) => s.label));
  });

  it("an unrecognized grade level returns an empty list, never a fallback to everything", () => {
    expect(getSubjectsForGradeLevel("")).toEqual([]);
    expect(getSubjectsForGradeLevel("Grade 99")).toEqual([]);
  });

  it("the current (transition) school year keeps Grade 12 on the Original K-12 curriculum", () => {
    expect(resolveGrade12Curriculum("2026-2027")).toBe("current");
    const labels = getSubjectsForGradeLevel("Grade 12", { schoolYear: "2026-2027" }).map((s) => s.label);
    expect(labels).toContain("Practical Research 1");
  });

  it("the next school year onward switches Grade 12 to the Strengthened SHS curriculum automatically", () => {
    expect(resolveGrade12Curriculum("2027-2028")).toBe("strengthened");
    const labels = getSubjectsForGradeLevel("Grade 12", { schoolYear: "2027-2028" }).map((s) => s.label);
    expect(labels).toContain("General Mathematics");
    expect(labels).not.toContain("Practical Research 1");
  });

  it("historical school years continue resolving against their own curriculum, unaffected by later years", () => {
    const current = getSubjectsForGradeLevel("Grade 12", { schoolYear: "2026-2027" }).map((s) => s.label);
    const future = getSubjectsForGradeLevel("Grade 12", { schoolYear: "2028-2029" }).map((s) => s.label);
    expect(current).toContain("Practical Research 1");
    expect(future).not.toContain("Practical Research 1");
  });

  it("getKeyStageForGradeLevel maps grades to the correct key stage", () => {
    expect(getKeyStageForGradeLevel("Grade 5")).toBe("ks2");
    expect(getKeyStageForGradeLevel("Grade 9")).toBe("ks3");
    expect(getKeyStageForGradeLevel("Grade 11")).toBe("ks4");
    expect(getKeyStageForGradeLevel("Grade 99")).toBeNull();
  });

  it("Grade 5 (Key Stage 2 / elementary) offers EPP and GMRC as their own subjects, not the combined names", () => {
    const labels = getSubjectsForGradeLevel("Grade 5").map((s) => s.label);
    expect(labels).toContain("EPP");
    expect(labels).toContain("GMRC");
    expect(labels).not.toContain("EPP / TLE");
    expect(labels).not.toContain("GMRC / Values Education");
    expect(labels).not.toContain("TLE");
    expect(labels).not.toContain("Values Education");
  });

  it("Grade 8 (Key Stage 3 / JHS) offers TLE and Values Education as their own subjects, not the combined names", () => {
    const labels = getSubjectsForGradeLevel("Grade 8").map((s) => s.label);
    expect(labels).toContain("TLE");
    expect(labels).toContain("Values Education");
    expect(labels).not.toContain("EPP / TLE");
    expect(labels).not.toContain("GMRC / Values Education");
    expect(labels).not.toContain("EPP");
    expect(labels).not.toContain("GMRC");
  });

  it("no Grade 4-10 subject label ever contains a slash, so it can never break a Class Record document ID", () => {
    ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"].forEach((gradeLevel) => {
      const labels = getSubjectsForGradeLevel(gradeLevel).map((s) => s.label);
      labels.forEach((label) => expect(label).not.toContain("/"));
    });
  });
});
