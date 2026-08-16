import { describe, it, expect } from "vitest";
import {
  DEPED_REGIONS,
  DEPED_DIVISIONS,
  getDivisionsForRegion,
  findRegionForDivision,
  getRegionName,
} from "../data/depedReferenceData.js";

describe("depedReferenceData", () => {
  describe("structural integrity", () => {
    it("has 18 regions, each with a unique code and a name", () => {
      expect(DEPED_REGIONS).toHaveLength(18);
      const codes = DEPED_REGIONS.map((r) => r.code);
      expect(new Set(codes).size).toBe(codes.length);
      DEPED_REGIONS.forEach((r) => {
        expect(r.name.trim().length).toBeGreaterThan(0);
      });
    });

    it("gives every region a non-empty division list", () => {
      DEPED_REGIONS.forEach((region) => {
        expect(getDivisionsForRegion(region.code).length).toBeGreaterThan(0);
      });
    });

    it("has no division list keyed to an unknown region code", () => {
      const knownCodes = new Set(DEPED_REGIONS.map((r) => r.code));
      Object.keys(DEPED_DIVISIONS).forEach((code) => {
        expect(knownCodes.has(code)).toBe(true);
      });
    });

    it("has no duplicate division names within a single region", () => {
      Object.entries(DEPED_DIVISIONS).forEach(([code, divisions]) => {
        const lowered = divisions.map((d) => d.toLowerCase());
        expect(new Set(lowered).size, `duplicate division in ${code}`).toBe(lowered.length);
      });
    });

    it("keeps each region's divisions alphabetically sorted", () => {
      Object.entries(DEPED_DIVISIONS).forEach(([code, divisions]) => {
        const sorted = [...divisions].sort((a, b) => a.localeCompare(b));
        expect(divisions, `${code} is not sorted`).toEqual(sorted);
      });
    });
  });

  describe("Negros Island Region split", () => {
    // NIR was re-established as its own region, so Region VI must no longer
    // carry the Negros divisions. A regression here silently prints the wrong
    // region on every School Form.
    it("puts the Negros divisions and Siquijor under NIR, not Region VI", () => {
      const nir = getDivisionsForRegion("NIR");
      expect(nir).toContain("Negros Occidental");
      expect(nir).toContain("Negros Oriental");
      expect(nir).toContain("Siquijor");

      const r6 = getDivisionsForRegion("R6");
      expect(r6).not.toContain("Negros Occidental");
      expect(r6).not.toContain("Negros Oriental");
      expect(r6).not.toContain("Siquijor");
    });
  });

  describe("getDivisionsForRegion", () => {
    it("returns Central Visayas divisions including this school's own", () => {
      const r7 = getDivisionsForRegion("R7");
      expect(r7).toContain("Cebu");
      expect(r7).toContain("Mandaue City");
      expect(r7).toContain("Bohol");
    });

    it("returns an empty array for unknown or blank codes", () => {
      expect(getDivisionsForRegion("R99")).toEqual([]);
      expect(getDivisionsForRegion("")).toEqual([]);
      expect(getDivisionsForRegion(undefined)).toEqual([]);
    });
  });

  describe("findRegionForDivision", () => {
    it("finds a region for a uniquely-named division, case-insensitively", () => {
      expect(findRegionForDivision("Bohol")?.code).toBe("R7");
      expect(findRegionForDivision("  bohol  ")?.code).toBe("R7");
      expect(findRegionForDivision("Quezon City")?.code).toBe("NCR");
    });

    it("returns null for an unrecognised division", () => {
      expect(findRegionForDivision("Atlantis")).toBeNull();
      expect(findRegionForDivision("")).toBeNull();
    });

    it("returns the first match for names reused across regions", () => {
      // "San Carlos City" exists in both Region I and NIR; Region I comes first
      // in DEPED_REGIONS order. Documented as a convenience-only lookup.
      expect(findRegionForDivision("San Carlos City")?.code).toBe("R1");
    });
  });

  describe("getRegionName", () => {
    it("resolves a code to its display name", () => {
      expect(getRegionName("R7")).toBe("Region VII (Central Visayas)");
    });

    it("falls back to the raw code, and to an empty string when blank", () => {
      expect(getRegionName("R99")).toBe("R99");
      expect(getRegionName("")).toBe("");
    });
  });
});
