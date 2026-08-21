import { describe, it, expect } from "vitest";
import {
  buildTeacherScope,
  resolveAdviserScope,
  resolveClassRecordCombos,
  groupClassRecordAssignments,
  findClassRecordAssignment,
  isSectionAllowed,
  subjectsForScope,
  sectionsForSubject,
  sectionKey,
  classCoversTerm,
} from "../teacherScope";

describe("teacherScope", () => {
  it("resolves an adviser to exactly one section from assignments", () => {
    const scope = buildTeacherScope({
      assignments: [{ role: "adviser", gradeLevel: "8", section: "LOVE" }],
    });
    expect(scope.isAdviser).toBe(true);
    expect(scope.adviser).toEqual({ gradeLevel: "Grade 8", section: "LOVE" });
    expect(isSectionAllowed(scope, "Grade 8", "LOVE")).toBe(true);
  });

  it("normalizes '10' and 'Grade 10' to the same canonical gradeLevel", () => {
    expect(resolveAdviserScope([{ role: "adviser", gradeLevel: "10", section: "Obedience" }])).toEqual({
      gradeLevel: "Grade 10",
      section: "Obedience",
    });
    expect(resolveAdviserScope([{ role: "adviser", gradeLevel: "Grade 10", section: "Obedience" }])).toEqual({
      gradeLevel: "Grade 10",
      section: "Obedience",
    });
  });

  it("rejects a second, unassigned section for an adviser", () => {
    const scope = buildTeacherScope({
      assignments: [{ role: "adviser", gradeLevel: "8", section: "LOVE" }],
    });
    expect(isSectionAllowed(scope, "Grade 8", "HOPE")).toBe(false);
    expect(isSectionAllowed(scope, "Grade 7", "LOVE")).toBe(false);
  });

  it("yields an empty scope for a teacher with no assignment at all", () => {
    const scope = buildTeacherScope({ assignments: [] });
    expect(scope.isAdviser).toBe(false);
    expect(scope.isSubjectTeacher).toBe(false);
    expect(scope.allowedSectionKeys.size).toBe(0);
    expect(isSectionAllowed(scope, "Grade 8", "LOVE")).toBe(false);
  });

  it("fails closed (adviser: null) when there is more than one adviser assignment", () => {
    const scope = buildTeacherScope({
      assignments: [
        { role: "adviser", gradeLevel: "8", section: "LOVE" },
        { role: "adviser", gradeLevel: "9", section: "HOPE" },
      ],
    });
    expect(scope.isAdviser).toBe(false);
    expect(scope.adviser).toBeNull();
  });

  it("derives subject-teacher subjects and per-subject sections", () => {
    const scope = buildTeacherScope({
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

  it("an adviser + subject-teacher combo keeps both scopes intact", () => {
    const scope = buildTeacherScope({
      assignments: [
        { role: "adviser", gradeLevel: "8", section: "LOVE" },
        { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "HOPE" },
      ],
    });
    expect(scope.isAdviser).toBe(true);
    expect(scope.adviser).toEqual({ gradeLevel: "Grade 8", section: "LOVE" });
    expect(subjectsForScope(scope)).toEqual(["Math 7"]);
    // Subject-teacher output format is untouched by the adviser normalization.
    expect(sectionsForSubject(scope, "Math 7")).toEqual([
      { gradeLevel: "7", section: "HOPE", terms: null },
    ]);
  });

  it("a subject taught to multiple sections yields all assigned sections, none unrelated", () => {
    const scope = buildTeacherScope({
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
      assignments: [
        { role: "subjectTeacher", subject: "Subject A", gradeLevel: "Grade 11", section: "STEM-A", terms: [1, 2] },
      ],
    });
    expect(sectionsForSubject(scope, "Subject A", 3)).toEqual([]);

    const scopeWithTerm3Coverage = buildTeacherScope({
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
      assignments: [
        { role: "subjectTeacher", subject: "Math 7", gradeLevel: "Grade 7", section: "LOVE" },
      ],
    });
    expect(subjectsForScope(scope, 1)).toEqual(["Math 7"]);
    expect(subjectsForScope(scope, 3)).toEqual(["Math 7"]);
  });
});

describe("Class Record hierarchy (Grade Level -> Subject -> Section)", () => {
  it("generates a Grade -> Subject -> Section hierarchy from subjectTeacher assignments", () => {
    const combos = resolveClassRecordCombos([
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "7", section: "Love" },
    ]);
    expect(combos).toEqual([{ gradeLevel: "Grade 7", subject: "Mathematics 7", section: "Love", terms: null }]);
    expect(groupClassRecordAssignments(combos)).toEqual({
      "Grade 7": { "Mathematics 7": [{ section: "Love", terms: null }] },
    });
  });

  it("groups multiple grades correctly and sorts grade levels numerically", () => {
    const combos = resolveClassRecordCombos([
      { role: "subjectTeacher", subject: "Oral Communication", gradeLevel: "11", section: "STEM-A" },
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "7", section: "Love" },
    ]);
    const hierarchy = groupClassRecordAssignments(combos);
    expect(Object.keys(hierarchy)).toEqual(["Grade 7", "Grade 11"]);
  });

  it("the same subject taught in multiple sections produces multiple section leaves", () => {
    const combos = resolveClassRecordCombos([
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "Grade 7", section: "Love" },
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "Grade 7", section: "Hope" },
    ]);
    const hierarchy = groupClassRecordAssignments(combos);
    expect(hierarchy["Grade 7"]["Mathematics 7"]).toEqual([
      { section: "Hope", terms: null },
      { section: "Love", terms: null },
    ]);
  });

  it("duplicate assignments do not create duplicate Class Record leaves", () => {
    const combos = resolveClassRecordCombos([
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "Grade 7", section: "Love" },
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "Grade 7", section: "Love" },
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "7", section: " Love " },
    ]);
    expect(combos).toHaveLength(1);
  });

  it("normalizes '7' and 'Grade 7' into one Grade 7 group", () => {
    const combos = resolveClassRecordCombos([
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "7", section: "Love" },
      { role: "subjectTeacher", subject: "Science 7", gradeLevel: "Grade 7", section: "Love" },
    ]);
    const hierarchy = groupClassRecordAssignments(combos);
    expect(Object.keys(hierarchy)).toEqual(["Grade 7"]);
    expect(Object.keys(hierarchy["Grade 7"]).sort()).toEqual(["Mathematics 7", "Science 7"]);
  });

  it("an adviser-only assignment creates no Class Record", () => {
    const combos = resolveClassRecordCombos([{ role: "adviser", gradeLevel: "Grade 7", section: "Love" }]);
    expect(combos).toEqual([]);
    expect(groupClassRecordAssignments(combos)).toEqual({});
  });

  it("adviser + an explicit subjectTeacher assignment exposes only the explicit subject assignment", () => {
    // Matches the task's own example: an adviser of Grade 7 - Love who also
    // teaches Mathematics 7 there must see ONLY Mathematics 7, never every
    // subject in Love implied by the adviser assignment alone.
    const combos = resolveClassRecordCombos([
      { role: "adviser", gradeLevel: "Grade 7", section: "Love" },
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "Grade 7", section: "Love" },
    ]);
    expect(groupClassRecordAssignments(combos)).toEqual({
      "Grade 7": { "Mathematics 7": [{ section: "Love", terms: null }] },
    });
  });

  it("rejects an unrelated subject/grade/section combination", () => {
    const combos = resolveClassRecordCombos([
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "Grade 7", section: "Love" },
    ]);
    expect(findClassRecordAssignment(combos, { gradeLevel: "Grade 7", subject: "Science 7", section: "Love" })).toBeNull();
    expect(findClassRecordAssignment(combos, { gradeLevel: "Grade 8", subject: "Mathematics 7", section: "Love" })).toBeNull();
    expect(findClassRecordAssignment(combos, { gradeLevel: "Grade 7", subject: "Mathematics 7", section: "Hope" })).toBeNull();
  });

  it("fails closed (empty hierarchy) when there are no subjectTeacher assignments at all", () => {
    const combos = resolveClassRecordCombos([]);
    expect(combos).toEqual([]);
    expect(groupClassRecordAssignments(combos)).toEqual({});
    expect(findClassRecordAssignment(combos, { gradeLevel: "Grade 7", subject: "Mathematics 7", section: "Love" })).toBeNull();
  });

  it("preserves SHS term restrictions through the combo and the hierarchy", () => {
    const combos = resolveClassRecordCombos([
      { role: "subjectTeacher", subject: "Oral Communication", gradeLevel: "Grade 11", section: "STEM-A", terms: [1, 2] },
    ]);
    expect(combos[0].terms).toEqual([1, 2]);
    expect(groupClassRecordAssignments(combos)["Grade 11"]["Oral Communication"]).toEqual([
      { section: "STEM-A", terms: [1, 2] },
    ]);
  });

  it("the exact Sidebar leaf payload shape contains gradeLevel + subject + section", () => {
    const combos = resolveClassRecordCombos([
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "Grade 7", section: "Love" },
    ]);
    const hierarchy = groupClassRecordAssignments(combos);
    const gradeLevel = Object.keys(hierarchy)[0];
    const subject = Object.keys(hierarchy[gradeLevel])[0];
    const { section, terms } = hierarchy[gradeLevel][subject][0];
    const leafPayload = { gradeLevel, subject, section, terms };
    expect(leafPayload).toEqual({ gradeLevel: "Grade 7", subject: "Mathematics 7", section: "Love", terms: null });
    expect(findClassRecordAssignment(combos, leafPayload)).toEqual(combos[0]);
  });

  it("rejects a manipulated initialSelection outside the user's own assignments", () => {
    const combos = resolveClassRecordCombos([
      { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "Grade 7", section: "Love" },
    ]);
    // A tampered payload naming a real class the teacher just isn't assigned to.
    const tampered = { gradeLevel: "Grade 10", subject: "English 10", section: "Faith" };
    expect(findClassRecordAssignment(combos, tampered)).toBeNull();
  });

  it("buildTeacherScope exposes classRecordCombos and classRecordHierarchy consistently", () => {
    const scope = buildTeacherScope({
      assignments: [
        { role: "adviser", gradeLevel: "7", section: "Love" },
        { role: "subjectTeacher", subject: "Mathematics 7", gradeLevel: "7", section: "Love" },
      ],
    });
    expect(scope.classRecordCombos).toEqual([
      { gradeLevel: "Grade 7", subject: "Mathematics 7", section: "Love", terms: null },
    ]);
    expect(scope.classRecordHierarchy).toEqual({
      "Grade 7": { "Mathematics 7": [{ section: "Love", terms: null }] },
    });
  });
});
