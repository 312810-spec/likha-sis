import { describe, it, expect } from "vitest";
import fallbackConfig from "../../schoolConfig";
import { snapshotToConfig } from "../useSchoolConfig";

describe("useSchoolConfig snapshot helper", () => {
  it("returns fallback when snapshot does not exist", () => {
    const fakeSnap = { exists: () => false };
    const result = snapshotToConfig(fakeSnap, fallbackConfig);
    expect(result).toEqual(fallbackConfig);
    expect(result.gradeLevelsOffered).toEqual(fallbackConfig.gradeLevelsOffered);
  });

  it("merges data from snapshot over fallback when present", () => {
    const fakeData = {
      schoolName: "My New School",
      principalName: "Jane Doe",
      gradeLevelsOffered: ["Grade 4", "Grade 5", "Grade 6"],
    };
    const fakeSnap = { exists: () => true, data: () => fakeData };
    const result = snapshotToConfig(fakeSnap, fallbackConfig);
    expect(result.schoolName).toBe("My New School");
    expect(result.principalName).toBe("Jane Doe");
    expect(result.gradeLevelsOffered).toEqual(["Grade 4", "Grade 5", "Grade 6"]);
    // other keys should remain from fallback
    expect(result.region).toBe(fallbackConfig.region);
  });

  it("falls back to the default grade levels when the snapshot is missing the field", () => {
    const fakeSnap = { exists: () => true, data: () => ({ schoolName: "My New School" }) };
    const result = snapshotToConfig(fakeSnap, fallbackConfig);
    expect(result.schoolName).toBe("My New School");
    expect(result.gradeLevelsOffered).toEqual(fallbackConfig.gradeLevelsOffered);
  });
});
