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
      // sf1: ["adviser"] -- School Forms are adviser-only.
      expect(canAccessPage("sf1", ["adviser"])).toBe(true);
      expect(canAccessPage("sf1", ["ictCoordinator"])).toBe(false);
      expect(canAccessPage("sf1", ["principal"])).toBe(false);
      expect(canAccessPage("sf1", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("sf1", ["stakeholder"])).toBe(false);

      // sf2: ["adviser"] -- the Year Overview tab for other roles was retired
      // along with their page access; SF2 is adviser-only end to end.
      expect(canAccessPage("sf2", ["adviser"])).toBe(true);
      expect(canAccessPage("sf2", ["principal"])).toBe(false);
      expect(canAccessPage("sf2", ["guidance"])).toBe(false);
      expect(canAccessPage("sf2", ["subjectTeacher"])).toBe(false);

      // userManagement: ["ictCoordinator", "principal"]
      expect(canAccessPage("userManagement", ["ictCoordinator"])).toBe(true);
      expect(canAccessPage("userManagement", ["principal"])).toBe(true);
      expect(canAccessPage("userManagement", ["adviser"])).toBe(false);

      // sf10Generate: ["adviser"]
      expect(canAccessPage("sf10Generate", ["adviser"])).toBe(true);
      expect(canAccessPage("sf10Generate", ["principal"])).toBe(false);
      expect(canAccessPage("sf10Generate", ["ictCoordinator"])).toBe(false);
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

      // consolidatedGrades: ["adviser", "principal", "masterTeacher", "smeaCoordinator"]
      // A bare subjectTeacher (no adviser role) does not get this page --
      // it aggregates a whole advisory class across every subject, not just
      // the classes a subjectTeacher personally teaches.
      expect(canAccessPage("consolidatedGrades", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("consolidatedGrades", ["adviser"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["adviser", "subjectTeacher"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["principal"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["masterTeacher"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["smeaCoordinator"])).toBe(true);
      expect(canAccessPage("consolidatedGrades", ["ictCoordinator"])).toBe(false);
      expect(canAccessPage("consolidatedGrades", ["stakeholder"])).toBe(false);

      // reportCard (SF9): ["adviser"]
      expect(canAccessPage("reportCard", ["adviser"])).toBe(true);
      expect(canAccessPage("reportCard", ["principal"])).toBe(false);
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

  describe("School Forms SF1-SF10 are adviser-only", () => {
    // The only School Form pages that actually exist: SF1, SF2, SF4,
    // Report Card (SF9), and SF10 Generator. canAccessPage() is the single
    // gate both Sidebar.jsx (nav visibility) and App.jsx (route rendering,
    // before any SF component mounts or reads Firestore) call, so exercising
    // it here covers navigation, direct route access, and data loading.
    const SF_PAGES = ["sf1", "sf2", "sf4", "reportCard", "sf10Generate"];

    it("an adviser can access every School Form page", () => {
      SF_PAGES.forEach((page) => {
        expect(canAccessPage(page, ["adviser"]), page).toBe(true);
      });
    });

    it("a multi-role account with adviser among its roles still has access", () => {
      SF_PAGES.forEach((page) => {
        expect(canAccessPage(page, ["subjectTeacher", "adviser"]), page).toBe(true);
        expect(canAccessPage(page, ["principal", "adviser"]), page).toBe(true);
        expect(canAccessPage(page, ["ictCoordinator", "adviser"]), page).toBe(true);
      });
    });

    it("subjectTeacher without the adviser role cannot access any School Form", () => {
      SF_PAGES.forEach((page) => {
        expect(canAccessPage(page, ["subjectTeacher"]), page).toBe(false);
      });
    });

    it("ictCoordinator without the adviser role cannot access any School Form", () => {
      SF_PAGES.forEach((page) => {
        expect(canAccessPage(page, ["ictCoordinator"]), page).toBe(false);
      });
    });

    it("principal without the adviser role cannot access any School Form", () => {
      SF_PAGES.forEach((page) => {
        expect(canAccessPage(page, ["principal"]), page).toBe(false);
      });
    });

    it("blocks direct route access for every other non-adviser role", () => {
      // App.jsx computes `hasAccess = canAccessPage(currentPage, userRoles)`
      // before its page switch runs, so a false result here is exactly what
      // stops a manually-set currentPage (typed URL/state) from ever
      // rendering the SF component -- the same function IS the route guard.
      ["masterTeacher", "smeaCoordinator", "guidance", "stakeholder", "clinicTeacher"].forEach((role) => {
        SF_PAGES.forEach((page) => {
          expect(canAccessPage(page, [role]), `${role} on ${page}`).toBe(false);
        });
      });
    });

    it("fails closed for every School Form when roles are unresolved or missing", () => {
      SF_PAGES.forEach((page) => {
        expect(canAccessPage(page, undefined), page).toBe(false);
        expect(canAccessPage(page, null), page).toBe(false);
        expect(canAccessPage(page, [])).toBe(false);
      });
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
      expect(PAGE_ACCESS.sf1).toEqual(["adviser"]);
      expect(PAGE_ACCESS.announcements).toBe("all");
      expect(PAGE_ACCESS.schoolCalendar).toBe("all");
      expect(ANNOUNCEMENT_AUTHOR_ROLES).toEqual(["principal", "ictCoordinator"]);
      expect(VIEW_LEARNERS_BLOCKED_ROLES).toEqual(["stakeholder", "parent", "adviser", "subjectTeacher"]);
      expect(VIEW_LEARNERS_EDIT_ROLES).toEqual(["adviser"]);
    });
  });
});
