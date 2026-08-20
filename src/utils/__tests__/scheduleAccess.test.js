import { describe, it, expect } from "vitest";
import { canAccessPage, SCHEDULE_EDIT_ROLES } from "../../pageAccess";

describe("classProgram page access", () => {
  it("admits the roles that read or print schedules", () => {
    expect(canAccessPage("classProgram", ["ictCoordinator"])).toBe(true);
    expect(canAccessPage("classProgram", ["principal"])).toBe(true);
    expect(canAccessPage("classProgram", ["adviser"])).toBe(true);
    expect(canAccessPage("classProgram", ["masterTeacher"])).toBe(true);
  });

  it("blocks roles with no scheduling business", () => {
    expect(canAccessPage("classProgram", ["stakeholder"])).toBe(false);
    expect(canAccessPage("classProgram", ["guidance"])).toBe(false);
    expect(canAccessPage("classProgram", [])).toBe(false);
  });

  it("restricts editing to the roles that can write the collection", () => {
    expect(SCHEDULE_EDIT_ROLES).toEqual(["ictCoordinator", "principal"]);
  });
});
