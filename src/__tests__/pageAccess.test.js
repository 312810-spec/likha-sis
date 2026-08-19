import { describe, it, expect } from "vitest";
import {
  canAccessPage,
  canEditLearners,
  PAGE_ACCESS,
  VIEW_LEARNERS_BLOCKED_ROLES,
  VIEW_LEARNERS_EDIT_ROLES,
} from "../pageAccess.js";

describe("pageAccess", () => {
  describe("canAccessPage", () => {
    it('allows "all" pages for any valid role', () => {
      expect(canAccessPage("dashboard", ["stakeholder"])).toBe(true);
      expect(canAccessPage("dashboard", ["adviser"])).toBe(true);
      expect(canAccessPage("dashboard", ["ictCoordinator"])).toBe(true);
    });

    it("allows restricted pages for listed roles and blocks unlisted roles", () => {
      // sf1: ["adviser", "ictCoordinator", "principal"]
      expect(canAccessPage("sf1", ["adviser"])).toBe(true);
      expect(canAccessPage("sf1", ["ictCoordinator"])).toBe(true);
      expect(canAccessPage("sf1", ["principal"])).toBe(true);
      expect(canAccessPage("sf1", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("sf1", ["stakeholder"])).toBe(false);

      // sf2: ["adviser", "principal", "masterTeacher", "smeaCoordinator", "guidance", "ictCoordinator"]
      // Non-adviser roles can open SF2 to view the Year Overview tab, but the
      // page itself (SF2.jsx) still gates attendance-marking to adviser.
      expect(canAccessPage("sf2", ["adviser"])).toBe(true);
      expect(canAccessPage("sf2", ["principal"])).toBe(true);
      expect(canAccessPage("sf2", ["guidance"])).toBe(true);
      expect(canAccessPage("sf2", ["subjectTeacher"])).toBe(false);

      // userManagement: ["ictCoordinator", "principal"]
      expect(canAccessPage("userManagement", ["ictCoordinator"])).toBe(true);
      expect(canAccessPage("userManagement", ["principal"])).toBe(true);
      expect(canAccessPage("userManagement", ["adviser"])).toBe(false);

      // sf10Generate: ["adviser", "principal", "ictCoordinator"]
      expect(canAccessPage("sf10Generate", ["adviser"])).toBe(true);
      expect(canAccessPage("sf10Generate", ["principal"])).toBe(true);
      expect(canAccessPage("sf10Generate", ["ictCoordinator"])).toBe(true);
      expect(canAccessPage("sf10Generate", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("sf10Generate", ["stakeholder"])).toBe(false);

      // schoolSettings: ["ictCoordinator"] -- branding folded in as a tab, and
      // principal no longer edits school configuration.
      expect(canAccessPage("schoolSettings", ["ictCoordinator"])).toBe(true);
      expect(canAccessPage("schoolSettings", ["principal"])).toBe(false);
      expect(canAccessPage("schoolSettings", ["adviser"])).toBe(false);
      expect(canAccessPage("schoolSettings", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("schoolSettings", ["stakeholder"])).toBe(false);

      // brandingSettings is retired as a standalone page.
      expect(canAccessPage("brandingSettings", ["ictCoordinator"])).toBe(false);
      expect(canAccessPage("brandingSettings", ["principal"])).toBe(false);

      // consolidatedGrades: ["subjectTeacher", "adviser", "principal", "masterTeacher", "smeaCoordinator"]
      expect(canAccessPage("consolidatedGrades", ["subjectTeacher"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["adviser"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["principal"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["masterTeacher"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["smeaCoordinator"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["ictCoordinator"])).toBe(false);
      expect(canAccessPage("consolidatedGrades", ["stakeholder"])).toBe(false);

      // reportCard: ["adviser", "principal"]
      expect(canAccessPage("reportCard", ["adviser"])).toBe(true);
      expect(canAccessPage("reportCard", ["principal"])).toBe(true);
      expect(canAccessPage("reportCard", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("reportCard", ["ictCoordinator"])).toBe(false);
      expect(canAccessPage("reportCard", ["stakeholder"])).toBe(false);

      // nutritionConsolidator: ["adviser", "smeaCoordinator", "principal"]
      expect(canAccessPage("nutritionConsolidator", ["adviser"])).toBe(true);
      expect(canAccessPage("nutritionConsolidator", ["smeaCoordinator"])).toBe(true);
      expect(canAccessPage("nutritionConsolidator", ["principal"])).toBe(true);
      expect(canAccessPage("nutritionConsolidator", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("nutritionConsolidator", ["stakeholder"])).toBe(false);

      // anecdotalRecords: ["adviser", "guidance", "principal", "masterTeacher"]
      expect(canAccessPage("anecdotalRecords", ["adviser"])).toBe(true);
      expect(canAccessPage("anecdotalRecords", ["guidance"])).toBe(true);
      expect(canAccessPage("anecdotalRecords", ["principal"])).toBe(true);
      expect(canAccessPage("anecdotalRecords", ["masterTeacher"])).toBe(true);
      expect(canAccessPage("anecdotalRecords", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("anecdotalRecords", ["stakeholder"])).toBe(false);
    });

    it("blocks viewLearners specifically for stakeholder role", () => {
      expect(canAccessPage("viewLearners", ["adviser"])).toBe(true);
      expect(canAccessPage("viewLearners", ["subjectTeacher"])).toBe(true);
      expect(canAccessPage("viewLearners", ["stakeholder"])).toBe(false);
      expect(canAccessPage("viewLearners", ["adviser", "stakeholder"])).toBe(false);
    });

    it("returns false for empty, null, or undefined userRoles", () => {
      expect(canAccessPage("dashboard", null)).toBe(false);
      expect(canAccessPage("dashboard", undefined)).toBe(false);
      expect(canAccessPage("dashboard", [])).toBe(false);
      expect(canAccessPage("sf1", null)).toBe(false);
      expect(canAccessPage("sf1", undefined)).toBe(false);
      expect(canAccessPage("sf1", [])).toBe(false);
    });

    it("returns false for non-existent page key", () => {
      expect(canAccessPage("nonExistentPage", ["adviser"])).toBe(false);
    });
  });

  describe("canEditLearners", () => {
    it("returns true only if userRoles includes adviser", () => {
      expect(canEditLearners(["adviser"])).toBe(true);
      expect(canEditLearners(["adviser", "subjectTeacher"])).toBe(true);
      expect(canEditLearners(["subjectTeacher"])).toBe(false);
      expect(canEditLearners(["principal"])).toBe(false);
      expect(canEditLearners([])).toBe(false);
      expect(canEditLearners(null)).toBe(false);
      expect(canEditLearners(undefined)).toBe(false);
    });
  });

  describe("exported constants", () => {
    it("exports expected PAGE_ACCESS object and array constants", () => {
      expect(PAGE_ACCESS.dashboard).toBe("all");
      expect(PAGE_ACCESS.sf1).toEqual(["adviser", "ictCoordinator", "principal"]);
      expect(VIEW_LEARNERS_BLOCKED_ROLES).toEqual(["stakeholder", "parent"]);
      expect(VIEW_LEARNERS_EDIT_ROLES).toEqual(["adviser"]);
    });
  });
});
