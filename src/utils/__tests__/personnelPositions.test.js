import { describe, it, expect } from "vitest";
import {
  PERSONNEL_POSITIONS,
  OTHER_POSITION_VALUE,
  resolvePositionOptions,
  resolvePositionSelectValue,
} from "../personnelPositions.js";

describe("personnelPositions", () => {
  it("includes common DepEd teaching and admin positions", () => {
    expect(PERSONNEL_POSITIONS).toContain("Teacher III");
    expect(PERSONNEL_POSITIONS).toContain("Master Teacher I");
    expect(PERSONNEL_POSITIONS).toContain("School Principal I");
    expect(PERSONNEL_POSITIONS).toContain("Guidance Counselor");
  });

  it("does not include application roles as positions", () => {
    expect(PERSONNEL_POSITIONS).not.toContain("ICT Coordinator");
    expect(PERSONNEL_POSITIONS).not.toContain("Adviser");
    expect(PERSONNEL_POSITIONS).not.toContain("SMEA Coordinator");
    expect(PERSONNEL_POSITIONS).not.toContain("Clinic Teacher");
  });

  it("resolves options unchanged for a listed position", () => {
    const options = resolvePositionOptions("Teacher III");
    expect(options.filter((o) => o.value === "Teacher III")).toHaveLength(1);
  });

  it("preserves an unlisted stored position as its own option", () => {
    const options = resolvePositionOptions("Senior High School Coordinator");
    const preserved = options.find((o) => o.value === "Senior High School Coordinator");
    expect(preserved).toBeTruthy();
    expect(preserved.label).toBe("Senior High School Coordinator");
  });

  it("always appends an Other option using the sentinel value", () => {
    const options = resolvePositionOptions("Teacher I");
    const other = options[options.length - 1];
    expect(other.value).toBe(OTHER_POSITION_VALUE);
  });

  it("resolves the select value for a blank stored position to the Other sentinel", () => {
    expect(resolvePositionSelectValue("")).toBe(OTHER_POSITION_VALUE);
    expect(resolvePositionSelectValue(undefined)).toBe(OTHER_POSITION_VALUE);
  });

  it("resolves the select value for a set stored position to itself", () => {
    expect(resolvePositionSelectValue("Teacher III")).toBe("Teacher III");
    expect(resolvePositionSelectValue("Some Legacy Title")).toBe("Some Legacy Title");
  });
});
