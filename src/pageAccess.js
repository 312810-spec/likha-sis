// src/pageAccess.js

export const PAGE_ACCESS = {
  dashboard: "all",
  sf1: ["adviser", "ictCoordinator", "principal"],
  sf2: ["adviser"],
  sf4: ["adviser"],
  classRecord: ["subjectTeacher", "adviser"],
  consolidatedGrades: ["subjectTeacher", "adviser", "principal", "masterTeacher", "smeaCoordinator"],
  reportCard: ["adviser", "principal"],
  viewLearners: "all",
  lardoTracking: ["adviser", "masterTeacher", "principal", "smeaCoordinator", "guidance"],
  nutritionStatus: ["adviser", "smeaCoordinator"],
  nutritionConsolidator: ["adviser", "smeaCoordinator", "principal"],
  transfersLog: ["adviser", "ictCoordinator", "principal", "smeaCoordinator"],
  certificates: ["ictCoordinator", "principal", "adviser"],
  idGenerator: ["ictCoordinator"],
  smeaEnrollment: ["principal", "masterTeacher", "ictCoordinator", "smeaCoordinator"],
  importCenter: ["ictCoordinator"],
  sf1Import: ["ictCoordinator"],
  sf10Import: ["ictCoordinator"],
  sf10Generate: ["adviser", "principal", "ictCoordinator"],
  userManagement: ["ictCoordinator", "principal"],
  brandingSettings: ["ictCoordinator", "principal"],
  schoolSettings: ["ictCoordinator", "principal"],
  accountSettings: "all"
};

export const VIEW_LEARNERS_BLOCKED_ROLES = ["stakeholder"];
export const VIEW_LEARNERS_EDIT_ROLES = ["adviser"];

// DO 006, s. 2026 (Safe Environment / LRP): behavioral incident records are
// restricted to smeaCoordinator, principal, and guidance — narrower than the
// dropout-risk side of LARDO Tracking, which adviser/masterTeacher can also see.
export const DISCIPLINE_STAFF_ROLES = ["smeaCoordinator", "principal", "guidance"];

export function canAccessDisciplineRecords(userRoles) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) {
    return false;
  }
  return DISCIPLINE_STAFF_ROLES.some((role) => userRoles.includes(role));
}

export function canAccessPage(pageKey, userRoles) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) {
    return false;
  }

  const access = PAGE_ACCESS[pageKey];
  if (!access) {
    return false;
  }

  if (access === "all") {
    if (
      pageKey === "viewLearners" &&
      VIEW_LEARNERS_BLOCKED_ROLES.some((role) => userRoles.includes(role))
    ) {
      return false;
    }
    return true;
  }

  if (Array.isArray(access)) {
    return access.some((role) => userRoles.includes(role));
  }

  return false;
}

export function canEditLearners(userRoles) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) {
    return false;
  }
  return userRoles.includes("adviser");
}
