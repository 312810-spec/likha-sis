import { describe, it, expect } from "vitest";
import {
  formatDivisionHeader,
  findSchoolPreset,
  autofillSchoolData,
  DEPED_REGIONS,
  DEPED_DIVISIONS,
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

  it("keeps the re-established Negros Island Region separate from Region VI/VII", () => {
    // NIR was re-established as its own region, so a division list that still
    // files Negros Occidental, Negros Oriental, or Siquijor under Region VI or
    // VII is out of date and would print the wrong division heading.
    expect(DEPED_REGIONS).toContain("Negros Island Region");

    const region6Names = DEPED_DIVISIONS["Region VI"].map((d) => d.name);
    const region7Names = DEPED_DIVISIONS["Region VII"].map((d) => d.name);
    const nirNames = DEPED_DIVISIONS["Negros Island Region"].map((d) => d.name);

    for (const stale of ["Negros Occidental", "Negros Oriental", "Siquijor"]) {
      expect(region6Names.some((name) => name.includes(stale))).toBe(false);
      expect(region7Names.some((name) => name.includes(stale))).toBe(false);
      expect(nirNames.some((name) => name.includes(stale))).toBe(true);
    }
  });
});
