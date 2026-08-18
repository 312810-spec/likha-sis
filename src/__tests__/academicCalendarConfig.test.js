import { describe, it, expect } from "vitest";
import {
  academicCalendar,
  TERM_LABELS,
  makeEmptySchoolYear,
  mergeAcademicCalendar,
  listSchoolYears,
  validateAcademicCalendar,
  getCurrentTermForSchoolYear,
} from "../academicCalendar.js";

const VALID_SY = {
  schoolYearLabel: "2027-2028",
  terms: [
    { id: "term-1", label: "Term 1", startDate: "2027-06-07", endDate: "2027-09-14" },
    { id: "term-2", label: "Term 2", startDate: "2027-09-15", endDate: "2027-12-17" },
    { id: "term-3", label: "Term 3", startDate: "2028-01-03", endDate: "2028-04-07" },
  ],
};

describe("makeEmptySchoolYear", () => {
  it("creates the mandated 3-term structure (DO 15 s.2026 -- no legacy quarters)", () => {
    const sy = makeEmptySchoolYear("2028-2029");
    expect(sy.schoolYearLabel).toBe("2028-2029");
    expect(sy.terms).toHaveLength(3);
    expect(sy.terms.map((t) => t.label)).toEqual(TERM_LABELS);
    expect(sy.terms.map((t) => t.id)).toEqual(["term-1", "term-2", "term-3"]);
  });

  it("leaves the dates blank for the school to fill in", () => {
    const sy = makeEmptySchoolYear("2028-2029");
    expect(sy.terms.every((t) => t.startDate === "" && t.endDate === "")).toBe(true);
  });
});

describe("mergeAcademicCalendar", () => {
  it("falls back to the built-in calendar when nothing is stored", () => {
    expect(mergeAcademicCalendar(null)).toEqual(academicCalendar);
    expect(mergeAcademicCalendar(undefined)).toEqual(academicCalendar);
    expect(mergeAcademicCalendar({})).toEqual(academicCalendar);
  });

  it("lets a stored school year override the built-in one of the same name", () => {
    const stored = {
      schoolYears: {
        "2026-2027": {
          schoolYearLabel: "2026-2027",
          terms: [
            { id: "term-1", label: "Term 1", startDate: "2026-06-01", endDate: "2026-09-10" },
            { id: "term-2", label: "Term 2", startDate: "2026-09-11", endDate: "2026-12-15" },
            { id: "term-3", label: "Term 3", startDate: "2027-01-05", endDate: "2027-04-10" },
          ],
        },
      },
    };
    const merged = mergeAcademicCalendar(stored);
    expect(merged["2026-2027"].terms[0].startDate).toBe("2026-06-01");
  });

  it("adds stored school years alongside the built-in one", () => {
    const merged = mergeAcademicCalendar({ schoolYears: { "2027-2028": VALID_SY } });
    expect(Object.keys(merged).sort()).toEqual(["2026-2027", "2027-2028"]);
  });

  it("ignores malformed stored entries rather than crashing a consumer", () => {
    const merged = mergeAcademicCalendar({ schoolYears: { "bad-year": { terms: "nope" } } });
    expect(merged["bad-year"]).toBeUndefined();
    expect(merged["2026-2027"]).toBeDefined();
  });

  it("never mutates the built-in calendar", () => {
    const before = JSON.stringify(academicCalendar);
    mergeAcademicCalendar({ schoolYears: { "2027-2028": VALID_SY } });
    expect(JSON.stringify(academicCalendar)).toBe(before);
  });
});

describe("listSchoolYears", () => {
  it("lists school years newest first", () => {
    const merged = mergeAcademicCalendar({ schoolYears: { "2027-2028": VALID_SY } });
    expect(listSchoolYears(merged)).toEqual(["2027-2028", "2026-2027"]);
  });

  it("returns an empty list for an empty calendar", () => {
    expect(listSchoolYears({})).toEqual([]);
    expect(listSchoolYears(null)).toEqual([]);
  });
});

describe("validateAcademicCalendar", () => {
  it("accepts a well-formed calendar", () => {
    expect(validateAcademicCalendar({ "2027-2028": VALID_SY })).toBe("");
  });

  it("requires at least one school year", () => {
    expect(validateAcademicCalendar({})).toBeTruthy();
  });

  it("requires a YYYY-YYYY school year label", () => {
    expect(validateAcademicCalendar({ "2027": { ...VALID_SY, schoolYearLabel: "2027" } })).toBeTruthy();
  });

  it("requires exactly three terms", () => {
    const twoTerms = { ...VALID_SY, terms: VALID_SY.terms.slice(0, 2) };
    expect(validateAcademicCalendar({ "2027-2028": twoTerms })).toContain("three terms");
  });

  it("requires every term date to be filled in", () => {
    const blank = {
      ...VALID_SY,
      terms: VALID_SY.terms.map((t, i) => (i === 1 ? { ...t, endDate: "" } : t)),
    };
    expect(validateAcademicCalendar({ "2027-2028": blank })).toBeTruthy();
  });

  it("rejects a term that ends before it starts", () => {
    const backwards = {
      ...VALID_SY,
      terms: VALID_SY.terms.map((t, i) => (i === 0 ? { ...t, endDate: "2027-06-01" } : t)),
    };
    expect(validateAcademicCalendar({ "2027-2028": backwards })).toContain("Term 1");
  });

  it("rejects overlapping terms", () => {
    const overlapping = {
      ...VALID_SY,
      terms: VALID_SY.terms.map((t, i) => (i === 1 ? { ...t, startDate: "2027-09-01" } : t)),
    };
    expect(validateAcademicCalendar({ "2027-2028": overlapping })).toContain("Term 2");
  });
});

describe("getCurrentTermForSchoolYear with a merged calendar", () => {
  it("resolves a term from a school-edited calendar", () => {
    const merged = mergeAcademicCalendar({ schoolYears: { "2027-2028": VALID_SY } });
    const term = getCurrentTermForSchoolYear("2027-2028", "2027-10-01", merged);
    expect(term?.label).toBe("Term 2");
  });

  it("still defaults to the built-in calendar when no calendar is passed", () => {
    expect(getCurrentTermForSchoolYear("2026-2027", "2026-07-01")?.label).toBe("Term 1");
  });

  it("returns null outside every term", () => {
    expect(getCurrentTermForSchoolYear("2026-2027", "2026-05-01")).toBeNull();
  });
});
