import { describe, it, expect } from "vitest";
import { buildClassRecordId } from "../classRecordId";

describe("classRecordId", () => {
  it("is deterministic for the same inputs", () => {
    const input = { gradeLevel: "Grade 7", section: "LOVE", subject: "Mathematics", term: "Term 1", schoolYear: "2026-2027" };
    expect(buildClassRecordId(input)).toBe(buildClassRecordId({ ...input }));
  });

  it("matches the original getDocId()/classRecordDocId() format for an ordinary subject with no punctuation", () => {
    const id = buildClassRecordId({
      gradeLevel: "Grade 7",
      section: "LOVE",
      subject: "Mathematics",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    expect(id).toBe("grade-7_love_mathematics_term-1_2026-2027");
  });

  it("preserves parentheses and other harmless punctuation exactly as the original format did", () => {
    const id = buildClassRecordId({
      gradeLevel: "Grade 8",
      section: "HOPE",
      subject: "Araling Panlipunan (AP)",
      term: "Term 2",
      schoolYear: "2026-2027",
    });
    expect(id).toBe("grade-8_hope_araling-panlipunan-(ap)_term-2_2026-2027");
  });

  it("never lets a slash in the subject name become a path separator", () => {
    const id = buildClassRecordId({
      gradeLevel: "Grade 5",
      section: "FAITH",
      subject: "EPP / TLE",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    expect(id).not.toContain("/");
  });

  it("builds a valid ID for the new EPP subject (Key Stage 2)", () => {
    const id = buildClassRecordId({
      gradeLevel: "Grade 5",
      section: "FAITH",
      subject: "EPP",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    expect(id).toBe("grade-5_faith_epp_term-1_2026-2027");
  });

  it("builds a valid ID for the new TLE subject (Key Stage 3)", () => {
    const id = buildClassRecordId({
      gradeLevel: "Grade 9",
      section: "OBEDIENCE",
      subject: "TLE",
      term: "Term 2",
      schoolYear: "2026-2027",
    });
    expect(id).not.toContain("/");
    expect(id).toBe("grade-9_obedience_tle_term-2_2026-2027");
  });

  it("never lets a slash in the legacy combined GMRC / Values Education name become a path separator", () => {
    const id = buildClassRecordId({
      gradeLevel: "Grade 9",
      section: "OBEDIENCE",
      subject: "GMRC / Values Education",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    expect(id).not.toContain("/");
  });

  it("builds a valid ID for the new standalone GMRC and Values Education subjects", () => {
    expect(
      buildClassRecordId({ gradeLevel: "Grade 5", section: "LOVE", subject: "GMRC", term: "Term 1", schoolYear: "2026-2027" })
    ).not.toContain("/");
    expect(
      buildClassRecordId({ gradeLevel: "Grade 9", section: "LOVE", subject: "Values Education", term: "Term 1", schoolYear: "2026-2027" })
    ).not.toContain("/");
  });

  it("keeps grade, section, subject, term, and school year as separate identity components", () => {
    const base = { gradeLevel: "Grade 7", section: "LOVE", subject: "Science", term: "Term 1", schoolYear: "2026-2027" };
    const differentSection = buildClassRecordId({ ...base, section: "HOPE" });
    const differentTerm = buildClassRecordId({ ...base, term: "Term 2" });
    const differentYear = buildClassRecordId({ ...base, schoolYear: "2027-2028" });
    const original = buildClassRecordId(base);
    expect(differentSection).not.toBe(original);
    expect(differentTerm).not.toBe(original);
    expect(differentYear).not.toBe(original);
  });
});
