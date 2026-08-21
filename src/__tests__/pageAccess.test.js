import { describe, it, expect } from "vitest";
import {
  canAccessPage,
  canEditLearners,
  canPostAnnouncements,
  canManageSchoolEvents,
  PAGE_ACCESS,
  ANNOUNCEMENT_AUTHOR_ROLES,
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

    it("blocks viewLearners for stakeholder, and for teacher/adviser accounts (no section-scoped view exists)", () => {
      expect(canAccessPage("viewLearners", ["principal"])).toBe(true);
      expect(canAccessPage("viewLearners", ["ictCoordinator"])).toBe(true);
      expect(canAccessPage("viewLearners", ["adviser"])).toBe(false);
      expect(canAccessPage("viewLearners", ["subjectTeacher"])).toBe(false);
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

  describe("announcements and school calendar", () => {
    it("lets every role read announcements and the calendar", () => {
      // A class suspension is useless if the teachers it applies to can't see
      // it, so viewing is deliberately open to every assigned role.
      ["adviser", "subjectTeacher", "stakeholder", "guidance", "masterTeacher"].forEach((role) => {
        expect(canAccessPage("announcements", [role])).toBe(true);
        expect(canAccessPage("schoolCalendar", [role])).toBe(true);
      });
    });

    it("still blocks a signed-in account with no assigned role", () => {
      expect(canAccessPage("announcements", [])).toBe(false);
      expect(canAccessPage("schoolCalendar", null)).toBe(false);
    });

    describe("canPostAnnouncements", () => {
      it("allows only the principal and ICT coordinator", () => {
        expect(canPostAnnouncements(["principal"])).toBe(true);
        expect(canPostAnnouncements(["ictCoordinator"])).toBe(true);
        expect(canPostAnnouncements(["adviser", "ictCoordinator"])).toBe(true);
      });

      it("rejects every other role, including senior ones", () => {
        ["adviser", "subjectTeacher", "masterTeacher", "smeaCoordinator", "guidance", "stakeholder"].forEach(
          (role) => {
            expect(canPostAnnouncements([role]), `${role} must not post`).toBe(false);
          }
        );
      });

      it("rejects empty, null, and undefined role lists", () => {
        expect(canPostAnnouncements([])).toBe(false);
        expect(canPostAnnouncements(null)).toBe(false);
        expect(canPostAnnouncements(undefined)).toBe(false);
      });
    });

    it("gates school event management the same way as announcements", () => {
      expect(canManageSchoolEvents(["principal"])).toBe(true);
      expect(canManageSchoolEvents(["adviser"])).toBe(false);
      expect(canManageSchoolEvents([])).toBe(false);
    });
  });

  describe("exported constants", () => {
    it("exports expected PAGE_ACCESS object and array constants", () => {
      expect(PAGE_ACCESS.dashboard).toBe("all");
      expect(PAGE_ACCESS.sf1).toEqual(["adviser", "ictCoordinator", "principal"]);
      expect(PAGE_ACCESS.announcements).toBe("all");
      expect(PAGE_ACCESS.schoolCalendar).toBe("all");
      expect(ANNOUNCEMENT_AUTHOR_ROLES).toEqual(["principal", "ictCoordinator"]);
      expect(VIEW_LEARNERS_BLOCKED_ROLES).toEqual(["stakeholder", "parent", "adviser", "subjectTeacher"]);
      expect(VIEW_LEARNERS_EDIT_ROLES).toEqual(["adviser"]);
    });
  });
});
