import { describe, it, expect } from "vitest";
import { getDashboardCapabilities, getQuickActions } from "../dashboardRoleConfig.js";

describe("getDashboardCapabilities", () => {
  it("fails closed for no roles", () => {
    const caps = getDashboardCapabilities([]);
    expect(Object.values(caps).every((v) => v === false)).toBe(true);
  });

  it("fails closed for an unrecognized role", () => {
    const caps = getDashboardCapabilities(["madeUpRole"]);
    expect(Object.values(caps).every((v) => v === false)).toBe(true);
  });

  it("grants adviser-specific capabilities only", () => {
    const caps = getDashboardCapabilities(["adviser"]);
    expect(caps.isAdviser).toBe(true);
    expect(caps.lardoOverview).toBe(true);
    expect(caps.nutritionOverview).toBe(true);
    expect(caps.schoolForms).toBe(true);
    expect(caps.isSubjectTeacher).toBe(false);
    expect(caps.schoolOverview).toBe(false);
    expect(caps.systemOverview).toBe(false);
  });

  it("grants subjectTeacher capabilities without adviser-only ones", () => {
    const caps = getDashboardCapabilities(["subjectTeacher"]);
    expect(caps.isSubjectTeacher).toBe(true);
    expect(caps.isAdviser).toBe(false);
    expect(caps.schoolForms).toBe(false);
    expect(caps.lardoOverview).toBe(false);
  });

  it("grants principal school-level overview only", () => {
    const caps = getDashboardCapabilities(["principal"]);
    expect(caps.schoolOverview).toBe(true);
    expect(caps.systemOverview).toBe(false);
    expect(caps.isAdviser).toBe(false);
    expect(caps.schoolForms).toBe(false);
  });

  it("grants ictCoordinator system overview but no LARDO/nutrition", () => {
    const caps = getDashboardCapabilities(["ictCoordinator"]);
    expect(caps.systemOverview).toBe(true);
    expect(caps.lardoOverview).toBe(false);
    expect(caps.nutritionOverview).toBe(false);
    expect(caps.schoolOverview).toBe(false);
  });

  it("grants smeaCoordinator overview", () => {
    const caps = getDashboardCapabilities(["smeaCoordinator"]);
    expect(caps.smeaOverview).toBe(true);
    expect(caps.lardoOverview).toBe(true);
  });

  it("grants guidance overview and LARDO access", () => {
    const caps = getDashboardCapabilities(["guidance"]);
    expect(caps.guidanceOverview).toBe(true);
    expect(caps.lardoOverview).toBe(true);
    expect(caps.schoolOverview).toBe(false);
  });

  it("grants masterTeacher overview and LARDO access", () => {
    const caps = getDashboardCapabilities(["masterTeacher"]);
    expect(caps.masterTeacherOverview).toBe(true);
    expect(caps.lardoOverview).toBe(true);
  });

  it("stakeholder gets no dashboard capabilities", () => {
    const caps = getDashboardCapabilities(["stakeholder"]);
    expect(Object.values(caps).every((v) => v === false)).toBe(true);
  });

  it("unions capabilities for a multi-role account (adviser + subjectTeacher)", () => {
    const caps = getDashboardCapabilities(["adviser", "subjectTeacher"]);
    expect(caps.isAdviser).toBe(true);
    expect(caps.isSubjectTeacher).toBe(true);
    expect(caps.schoolForms).toBe(true);
  });

  it("unions capabilities for ictCoordinator + adviser", () => {
    const caps = getDashboardCapabilities(["ictCoordinator", "adviser"]);
    expect(caps.systemOverview).toBe(true);
    expect(caps.isAdviser).toBe(true);
  });
});

describe("getQuickActions", () => {
  it("returns nothing for no roles", () => {
    expect(getQuickActions([])).toEqual([]);
  });

  it("only returns pages canAccessPage permits for the role", () => {
    const actions = getQuickActions(["subjectTeacher"]);
    const pages = actions.map((a) => a.page);
    expect(pages).toContain("classRecord");
    // Consolidated Grades aggregates a whole advisory class across every
    // subject -- a bare subjectTeacher (no adviser role) does not get it.
    expect(pages).not.toContain("consolidatedGrades");
    // School Forms are adviser-only -- a bare subjectTeacher must never see them.
    expect(pages).not.toContain("sf1");
    expect(pages).not.toContain("sf2");
  });

  it("excludes School Forms and admin pages for stakeholder", () => {
    const actions = getQuickActions(["stakeholder"]);
    const pages = actions.map((a) => a.page);
    expect(pages).not.toContain("viewLearners");
    expect(pages).not.toContain("sf1");
    expect(pages).not.toContain("userManagement");
  });

  it("grants ictCoordinator admin pages but not School Forms/LARDO", () => {
    const actions = getQuickActions(["ictCoordinator"]);
    const pages = actions.map((a) => a.page);
    expect(pages).toContain("userManagement");
    expect(pages).toContain("importCenter");
    expect(pages).toContain("schoolSettings");
    expect(pages).not.toContain("sf1");
    expect(pages).not.toContain("lardoTracking");
  });
});
