import { describe, it, expect } from "vitest";
import {
  isAutoFlagOrigin,
  daysSinceLastIntervention,
  isEligibleForAutoResolveCheck,
} from "../lardoAutoResolve";

describe("isAutoFlagOrigin", () => {
  it("is true when every risk factor is an auto-flag factor", () => {
    expect(isAutoFlagOrigin(["Academic difficulty"])).toBe(true);
    expect(isAutoFlagOrigin(["Attendance concern"])).toBe(true);
    expect(isAutoFlagOrigin(["Academic difficulty", "Attendance concern"])).toBe(true);
  });

  it("is false when any risk factor is manually added", () => {
    expect(isAutoFlagOrigin(["Academic difficulty", "Family problems"])).toBe(false);
    expect(isAutoFlagOrigin(["Financial difficulty"])).toBe(false);
  });

  it("is false for empty or missing risk factors", () => {
    expect(isAutoFlagOrigin([])).toBe(false);
    expect(isAutoFlagOrigin(null)).toBe(false);
    expect(isAutoFlagOrigin(undefined)).toBe(false);
  });
});

describe("daysSinceLastIntervention", () => {
  const now = new Date("2026-08-15T00:00:00Z");

  it("returns days since the most recent dated entry", () => {
    const interventions = [
      { date: "2026-08-01T00:00:00Z", note: "first" },
      { date: "2026-08-05T00:00:00Z", note: "most recent" },
    ];
    expect(daysSinceLastIntervention(interventions, now)).toBeCloseTo(10, 5);
  });

  it("returns null for no interventions or invalid dates", () => {
    expect(daysSinceLastIntervention([], now)).toBe(null);
    expect(daysSinceLastIntervention(null, now)).toBe(null);
    expect(daysSinceLastIntervention([{ note: "no date" }], now)).toBe(null);
  });
});

describe("isEligibleForAutoResolveCheck", () => {
  const now = new Date("2026-08-15T00:00:00Z");

  it("is eligible when monitoring, auto-flag origin, and 14+ days elapsed", () => {
    const record = {
      status: "monitoring",
      riskFactors: ["Academic difficulty"],
      interventions: [{ date: "2026-08-01T00:00:00Z", note: "flagged" }],
    };
    expect(isEligibleForAutoResolveCheck(record, now)).toBe(true);
  });

  it("is not eligible before 14 days have elapsed", () => {
    const record = {
      status: "monitoring",
      riskFactors: ["Attendance concern"],
      interventions: [{ date: "2026-08-10T00:00:00Z", note: "flagged" }],
    };
    expect(isEligibleForAutoResolveCheck(record, now)).toBe(false);
  });

  it("is not eligible when already resolved or dropped", () => {
    const base = {
      riskFactors: ["Academic difficulty"],
      interventions: [{ date: "2026-08-01T00:00:00Z", note: "flagged" }],
    };
    expect(isEligibleForAutoResolveCheck({ ...base, status: "resolved" }, now)).toBe(false);
    expect(isEligibleForAutoResolveCheck({ ...base, status: "dropped" }, now)).toBe(false);
  });

  it("is not eligible when a manual risk factor is present", () => {
    const record = {
      status: "monitoring",
      riskFactors: ["Academic difficulty", "Family problems"],
      interventions: [{ date: "2026-08-01T00:00:00Z", note: "flagged" }],
    };
    expect(isEligibleForAutoResolveCheck(record, now)).toBe(false);
  });

  it("is not eligible with no dated interventions", () => {
    const record = { status: "monitoring", riskFactors: ["Academic difficulty"], interventions: [] };
    expect(isEligibleForAutoResolveCheck(record, now)).toBe(false);
  });
});
