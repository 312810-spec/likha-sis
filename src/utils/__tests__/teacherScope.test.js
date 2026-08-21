import { describe, it, expect } from "vitest";
import {
  buildTeacherScope,
  isSectionAllowed,
  subjectsForScope,
  sectionsForSubject,
  sectionKey,
  classCoversTerm,
} from "../teacherScope";

describe("teacherScope", () => {
  it("resolves an adviser to exactly one section", () => {
    const scope = buildTeacherScope({
      advisorySection: { gradeLevel: "Grade 8", name: "LOVE" },
      assignments: [],
    });
    expect(scope.isAdviser).toBe(true);
    expect(isSectionAllowed(scope, "Grade 8", "LOVE")).toBe(true);
  });

  it("rejects a second, unassigned section for an adviser", () => {
    const scope = buildTeacherScope({
      advisorySection: { gradeLevel: "Grade 8", name: "LOVE" },
      assignments: [],
    });
    expect(isSectionAllowed(scope, "Grade 8", "HOPE")).toBe(false);
    expect(isSectionAllowed(scope, "Grade 7", "LOVE")).toBe(false);
  });

  it("yields an empty scope for a teacher with no assignment at all", () => {
    const scope = buildTeacherScope({ advisorySection: null, assignments: [] });
    expect(scope.isAdviser).toBe(false);
    expect(scope.isSubjectTeacher).toBe(false);
    expect(scope.allowedSectionKeys.size).toBe(0);
    expect(isSectionAllowed(scope, "Grade 8", "LOVE")).toBe(false);
  });

  it("derives subject-teacher subjects and per-subject sections", () => {
    const scope = buildTeacherScope({
      advisorySection: null,
      assignments: [
        { role: "subjectTeacher", subject: "Math 7", gradeLevel: "Grade 7", section: "LOVE" },
        { role: "subjectTeacher", subject: "Science 7", gradeLevel: "Grade 7", section: "LOVE" },
      ],
    });
    expect(subjectsForScope(scope)).toEqual(["Math 7", "Science 7"]);
    expect(sectionsForSubject(scope, "Math 7")).toEqual([
      { gradeLevel: "Grade 7", section: "LOVE", terms: null },
    ]);
  });

  it("a subject taught to multiple sections yields all assigned sections, none unrelated", () => {
    const scope = buildTeacherScope({
      advisorySection: null,
      assignments: [
        { role: "subjectTeacher", subject: "Math 7", gradeLevel: "Grade 7", section: "LOVE" },
        { role: "subjectTeacher", subject: "Math 7", gradeLevel: "Grade 8", section: "HOPE" },
      ],
    });
    expect(sectionsForSubject(scope, "Math 7")).toEqual([
      { gradeLevel: "Grade 7", section: "LOVE", terms: null },
      { gradeLevel: "Grade 8", section: "HOPE", terms: null },
    ]);
    expect(isSectionAllowed(scope, "Grade 8", "HOPE")).toBe(true);
    expect(isSectionAllowed(scope, "Grade 9", "FAITH")).toBe(false);
  });

  it("sectionKey is stable and trims whitespace", () => {
    expect(sectionKey("Grade 7", "LOVE")).toBe(sectionKey(" Grade 7 ", " LOVE "));
  });

  it("a Term-1-only SHS subject is visible in Term 1 and hidden in Term 2/3", () => {
    const scope = buildTeacherScope({
      advisorySection: null,
      assignments: [
        { role: "subjectTeacher", subject: "Subject A", gradeLevel: "Grade 11", section: "STEM-A", terms: [1] },
      ],
    });
    expect(subjectsForScope(scope, 1)).toEqual(["Subject A"]);
    expect(subjectsForScope(scope, 2)).toEqual([]);
    expect(subjectsForScope(scope, 3)).toEqual([]);
    expect(classCoversTerm({ terms: [1] }, 1)).toBe(true);
    expect(classCoversTerm({ terms: [1] }, 2)).toBe(false);
  });

  it("a Term 1-3 cascading SHS subject stays visible across all three terms under one canonical key", () => {
    const scope = buildTeacherScope({
      advisorySection: null,
      assignments: [
        { role: "subjectTeacher", subject: "Subject B", gradeLevel: "Grade 11", section: "STEM-A", terms: [1, 2, 3] },
      ],
    });
    expect(subjectsForScope(scope, 1)).toEqual(["Subject B"]);
    expect(subjectsForScope(scope, 2)).toEqual(["Subject B"]);
    expect(subjectsForScope(scope, 3)).toEqual(["Subject B"]);
  });

  it("a Terms 1-2 assignment does not expose Term 3 unless another assignment covers it", () => {
    const scope = buildTeacherScope({
      advisorySection: null,
      assignments: [
        { role: "subjectTeacher", subject: "Subject A", gradeLevel: "Grade 11", section: "STEM-A", terms: [1, 2] },
      ],
    });
    expect(sectionsForSubject(scope, "Subject A", 3)).toEqual([]);

    const scopeWithTerm3Coverage = buildTeacherScope({
      advisorySection: null,
      assignments: [
        { role: "subjectTeacher", subject: "Subject A", gradeLevel: "Grade 11", section: "STEM-A", terms: [1, 2] },
        { role: "subjectTeacher", subject: "Subject A", gradeLevel: "Grade 11", section: "STEM-B", terms: [3] },
      ],
    });
    expect(sectionsForSubject(scopeWithTerm3Coverage, "Subject A", 3)).toEqual([
      { gradeLevel: "Grade 11", section: "STEM-B", terms: [3] },
    ]);
  });

  it("a non-SHS (whole-year, no terms field) assignment covers every term", () => {
    const scope = buildTeacherScope({
      advisorySection: null,
      assignments: [
        { role: "subjectTeacher", subject: "Math 7", gradeLevel: "Grade 7", section: "LOVE" },
      ],
    });
    expect(subjectsForScope(scope, 1)).toEqual(["Math 7"]);
    expect(subjectsForScope(scope, 3)).toEqual(["Math 7"]);
  });
});
