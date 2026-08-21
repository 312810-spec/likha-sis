// src/utils/__tests__/sf1RecordQuality.test.js
// Grade-aware SF1 completeness checks behind the Record Check panel and the
// Needs Sex Assignment list.
//
// PRIVACY: every learner below is INVENTED.

import { describe, it, expect } from "vitest";
import { getSf1RecordIssues, needsSexAssignment, sf1RecordSummary } from "../sf1RecordQuality.js";

const COMPLETE_LEARNER = {
  lrn: "900000000018",
  lastName: "SANTIAGO",
  firstName: "MARIA ELENA",
  sex: "F",
  birthDate: "2013-05-14",
  contactNumber: "09171234567",
  motherTongue: "",
};

describe("needsSexAssignment", () => {
  it("is true only when sex could not be read", () => {
    expect(needsSexAssignment({ sex: "" })).toBe(true);
    expect(needsSexAssignment({ sex: undefined })).toBe(true);
    expect(needsSexAssignment({ sex: "M" })).toBe(false);
    expect(needsSexAssignment({ sex: "F" })).toBe(false);
  });
});

describe("getSf1RecordIssues", () => {
  it("flags nothing for a complete Grade 7 learner", () => {
    expect(getSf1RecordIssues(COMPLETE_LEARNER, "Grade 7")).toEqual([]);
  });

  it("flags each missing required field", () => {
    const issues = getSf1RecordIssues({}, "Grade 7");
    const fields = issues.map((i) => i.field);
    expect(fields).toEqual(
      expect.arrayContaining(["lrn", "lastName", "firstName", "birthDate", "contactNumber"])
    );
  });

  it("does NOT flag missing Sex — that is handled separately", () => {
    const issues = getSf1RecordIssues({ ...COMPLETE_LEARNER, sex: "" }, "Grade 7");
    expect(issues.find((i) => i.field === "sex")).toBeUndefined();
  });

  it("is grade-aware: Mother Tongue is only required for Grades 1-3", () => {
    const grade7Issues = getSf1RecordIssues(COMPLETE_LEARNER, "Grade 7");
    expect(grade7Issues.find((i) => i.field === "motherTongue")).toBeUndefined();

    const grade2Issues = getSf1RecordIssues(COMPLETE_LEARNER, "Grade 2");
    expect(grade2Issues.find((i) => i.field === "motherTongue")).toBeDefined();
  });
});

describe("sf1RecordSummary", () => {
  it("counts complete vs needing-attention learners, sex-unresolved included", () => {
    const learners = [
      COMPLETE_LEARNER,
      { ...COMPLETE_LEARNER, lrn: "900000000057", sex: "M", birthDate: "" }, // missing birth date
      { ...COMPLETE_LEARNER, lrn: "900000000012", sex: "" }, // missing sex only
    ];
    const summary = sf1RecordSummary(learners, "Grade 7");
    expect(summary.total).toBe(3);
    expect(summary.complete).toBe(1);
    expect(summary.needAttentionCount).toBe(2);
    expect(summary.sexUnresolved).toHaveLength(1);
  });

  it("returns a complete summary for an empty roster", () => {
    const summary = sf1RecordSummary([], "Grade 7");
    expect(summary).toEqual({
      total: 0,
      complete: 0,
      needAttentionCount: 0,
      needAttention: [],
      sexUnresolved: [],
    });
  });
});
