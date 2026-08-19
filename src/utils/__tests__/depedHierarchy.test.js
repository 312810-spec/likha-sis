import { describe, it, expect } from "vitest";
import {
  formatDivisionHeader,
  findSchoolPreset,
  findDivisionInfo,
  autofillSchoolData,
  DEPED_REGIONS,
} from "../depedHierarchy.js";

describe("depedHierarchy utilities", () => {
  it("formats division headers correctly without manual divisionName input", () => {
    expect(formatDivisionHeader("Division of Mandaue City")).toBe(
      "Department of Education - Division of Mandaue City"
    );
    expect(formatDivisionHeader("Department of Education - Division of Cebu City")).toBe(
      "Department of Education - Division of Cebu City"
    );
    expect(formatDivisionHeader("")).toBe("Department of Education");
  });

  it("finds school presets by exact or partial name", () => {
    const tingub = findSchoolPreset("Tingub National High School");
    expect(tingub).toBeDefined();
    expect(tingub.schoolId).toBe("302975");
    expect(tingub.region).toBe("Region VII");
    expect(tingub.divisionOffice).toBe("Division of Mandaue City");
  });

  it("autofills school info when schoolName is entered", () => {
    const initial = { schoolName: "", schoolId: "", region: "", divisionOffice: "" };
    const updated = autofillSchoolData(initial, "schoolName", "Tingub National High School");
    expect(updated.schoolId).toBe("302975");
    expect(updated.region).toBe("Region VII");
    expect(updated.divisionOffice).toBe("Division of Mandaue City");
    expect(updated.district).toBe("Mandaue City District III");
    expect(updated.municipalityCityProvince).toBe("Mandaue City, Cebu");
  });

  it("autofills region and cityProvince when divisionOffice is entered", () => {
    const initial = { divisionOffice: "", region: "", municipalityCityProvince: "" };
    const updated = autofillSchoolData(initial, "divisionOffice", "Division of Mandaue City");
    expect(updated.region).toBe("Region VII");
    expect(updated.municipalityCityProvince).toBe("Mandaue City, Cebu");
  });

  it("contains all standard DepEd regions", () => {
    expect(DEPED_REGIONS).toContain("Region VII");
    expect(DEPED_REGIONS).toContain("NCR");
    expect(DEPED_REGIONS).toContain("Region IV-A");
  });
});
