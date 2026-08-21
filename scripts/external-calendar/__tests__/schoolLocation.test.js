import { describe, it, expect } from "vitest";
import { matchSchoolPrsd } from "../lib/schoolLocation.mjs";

describe("matchSchoolPrsd", () => {
  it("maps a recognized DepEd region to its PAGASA PRSD", () => {
    const result = matchSchoolPrsd({ region: "Region VII", municipalityCityProvince: "Mandaue City, Cebu" });
    expect(result.matched).toBe(true);
    expect(result.prsdSlug).toBe("visprsd");
    expect(result.regionalLabel).toContain("Mandaue City, Cebu");
  });

  it("does not falsely claim a local match for an unrecognized or missing region", () => {
    expect(matchSchoolPrsd({ region: "" })).toEqual({ matched: false, prsdSlug: null, regionalLabel: "" });
    expect(matchSchoolPrsd({ region: "Not A Real Region" })).toEqual({ matched: false, prsdSlug: null, regionalLabel: "" });
    expect(matchSchoolPrsd()).toEqual({ matched: false, prsdSlug: null, regionalLabel: "" });
  });

  it("maps NCR and Mindanao regions to their own PRSDs, not a default", () => {
    expect(matchSchoolPrsd({ region: "NCR" }).prsdSlug).toBe("ncrprsd");
    expect(matchSchoolPrsd({ region: "Region XI" }).prsdSlug).toBe("minprsd");
    expect(matchSchoolPrsd({ region: "BARMM" }).prsdSlug).toBe("minprsd");
  });
});
