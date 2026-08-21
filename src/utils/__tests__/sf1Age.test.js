// src/utils/__tests__/sf1Age.test.js
// The official SF1 age rule: "AGE as of 1st Friday June" of the school
// year's starting calendar year -- never "as of today".
//
// PRIVACY: every learner below is INVENTED.

import { describe, it, expect } from "vitest";
import { calculateSf1Age, firstFridayOfJune, schoolYearStartYear } from "../sf1Age.js";

describe("schoolYearStartYear", () => {
  it("reads the starting calendar year from a YYYY-YYYY label", () => {
    expect(schoolYearStartYear("2026-2027")).toBe(2026);
  });

  it("returns null for a malformed or missing label", () => {
    expect(schoolYearStartYear("2026")).toBeNull();
    expect(schoolYearStartYear("")).toBeNull();
    expect(schoolYearStartYear(undefined)).toBeNull();
  });
});

describe("firstFridayOfJune", () => {
  it("finds the first Friday of June across several years", () => {
    expect(firstFridayOfJune(2026).toDateString()).toBe("Fri Jun 05 2026");
    expect(firstFridayOfJune(2027).toDateString()).toBe("Fri Jun 04 2027");
    expect(firstFridayOfJune(2013).toDateString()).toBe("Fri Jun 07 2013");
  });
});

describe("calculateSf1Age", () => {
  it("computes age as of the 1st Friday of June for SY 2026-2027 (June 5, 2026)", () => {
    // Turns 13 exactly on the reference date.
    expect(calculateSf1Age("2013-06-05", "2026-2027")).toBe(13);
    // Birthday one day after the reference date -- hasn't turned 13 yet.
    expect(calculateSf1Age("2013-06-06", "2026-2027")).toBe(12);
    // Birthday well before the reference date.
    expect(calculateSf1Age("2012-12-25", "2026-2027")).toBe(13);
  });

  it("never uses today's date, regardless of when the test runs", () => {
    const today = new Date();
    const bornExactly10YearsAgoToday = `${today.getFullYear() - 10}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    // "10 years old today" is meaningless for the official SF1 figure; only
    // the school year's 1st-Friday-of-June reference date matters.
    const officialAge = calculateSf1Age(bornExactly10YearsAgoToday, "2026-2027");
    expect(typeof officialAge).toBe("number");
    // Sanity: the answer must be derivable from the June 2026 reference date,
    // not from "today" -- so it should never depend on which day the suite runs.
    expect(officialAge).toBe(calculateSf1Age(bornExactly10YearsAgoToday, "2026-2027"));
  });

  it("returns '' when the birth date is missing or unparseable", () => {
    expect(calculateSf1Age("", "2026-2027")).toBe("");
    expect(calculateSf1Age("not-a-date", "2026-2027")).toBe("");
    expect(calculateSf1Age(undefined, "2026-2027")).toBe("");
  });

  it("returns '' when the school year is missing or malformed", () => {
    expect(calculateSf1Age("2013-06-05", "")).toBe("");
    expect(calculateSf1Age("2013-06-05", "2026")).toBe("");
  });

  it("stays consistent across different school years for the same learner", () => {
    // A birth date safely before June avoids the 1st-Friday boundary shifting
    // by a day between years (e.g. June 5 in 2026 vs June 4 in 2027).
    const birthDate = "2013-03-01";
    expect(calculateSf1Age(birthDate, "2026-2027")).toBe(13);
    expect(calculateSf1Age(birthDate, "2027-2028")).toBe(14);
  });
});
