import { describe, it, expect } from "vitest";
import {
  buildAssignmentKeys,
  subjectAssignmentKey,
  adviserAssignmentKey,
} from "../assignmentKeys";

describe("assignmentKeys", () => {
  it("builds one key per subjectTeacher assignment", () => {
    const keys = buildAssignmentKeys([
      { role: "subjectTeacher", subject: "Math 7", gradeLevel: "Grade 7", section: "LOVE" },
      { role: "subjectTeacher", subject: "Science 7", gradeLevel: "Grade 7", section: "LOVE" },
    ]);
    expect(keys).toEqual([
      subjectAssignmentKey("Math 7", "Grade 7", "LOVE"),
      subjectAssignmentKey("Science 7", "Grade 7", "LOVE"),
    ]);
  });

  it("builds an ADVISER-prefixed key for adviser assignments", () => {
    const keys = buildAssignmentKeys([{ role: "adviser", gradeLevel: "Grade 8", section: "HOPE" }]);
    expect(keys).toEqual([adviserAssignmentKey("Grade 8", "HOPE")]);
  });

  it("dedupes identical keys and ignores incomplete entries", () => {
    const keys = buildAssignmentKeys([
      { role: "subjectTeacher", subject: "Math 7", gradeLevel: "Grade 7", section: "LOVE" },
      { role: "subjectTeacher", subject: "Math 7", gradeLevel: "Grade 7", section: "LOVE" },
      { role: "subjectTeacher", subject: "", gradeLevel: "Grade 7", section: "LOVE" },
      { role: "adviser", gradeLevel: "", section: "LOVE" },
    ]);
    expect(keys).toEqual([subjectAssignmentKey("Math 7", "Grade 7", "LOVE")]);
  });

  it("returns an empty array for no assignments", () => {
    expect(buildAssignmentKeys([])).toEqual([]);
    expect(buildAssignmentKeys(undefined)).toEqual([]);
  });
});
