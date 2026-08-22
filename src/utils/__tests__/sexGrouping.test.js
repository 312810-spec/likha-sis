import { describe, it, expect } from "vitest";
import { sexLetter, groupLearnersBySex } from "../sexGrouping";

describe("sexLetter", () => {
  it("normalizes full words and letters, case-insensitively", () => {
    expect(sexLetter("Male")).toBe("M");
    expect(sexLetter("female")).toBe("F");
    expect(sexLetter("M")).toBe("M");
    expect(sexLetter("f")).toBe("F");
  });

  it("returns an empty string for missing or unrecognized values", () => {
    expect(sexLetter("")).toBe("");
    expect(sexLetter(undefined)).toBe("");
    expect(sexLetter(null)).toBe("");
    expect(sexLetter("Other")).toBe("");
  });
});

describe("groupLearnersBySex", () => {
  it("splits an alphabetically-sorted roster into Male then Female, preserving order", () => {
    const learners = [
      { id: "1", lastName: "Cruz", sex: "Male" },
      { id: "2", lastName: "Reyes", sex: "Female" },
      { id: "3", lastName: "Santos", sex: "M" },
      { id: "4", lastName: "Torres", sex: "F" },
    ];
    const { male, female, unresolved } = groupLearnersBySex(learners);
    expect(male.map((l) => l.id)).toEqual(["1", "3"]);
    expect(female.map((l) => l.id)).toEqual(["2", "4"]);
    expect(unresolved).toEqual([]);
  });

  it("puts learners with missing/unrecognized sex into the unresolved group instead of dropping them", () => {
    const learners = [
      { id: "1", sex: "Male" },
      { id: "2", sex: "" },
      { id: "3", sex: undefined },
    ];
    const { male, unresolved } = groupLearnersBySex(learners);
    expect(male.map((l) => l.id)).toEqual(["1"]);
    expect(unresolved.map((l) => l.id)).toEqual(["2", "3"]);
  });

  it("returns empty groups for an empty or missing list", () => {
    expect(groupLearnersBySex([])).toEqual({ male: [], female: [], unresolved: [] });
    expect(groupLearnersBySex(undefined)).toEqual({ male: [], female: [], unresolved: [] });
  });
});
