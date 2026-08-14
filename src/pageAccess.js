// src/pageAccess.js

export const PAGE_ACCESS = {
  dashboard: "all",
  sf1: ["adviser", "ictCoordinator", "principal"],
  sf2: ["adviser"],
  classRecord: ["subjectTeacher", "adviser"],
  consolidatedGrades: ["subjectTeacher", "adviser", "principal", "masterTeacher", "smeaCoordinator"],
  reportCard: ["adviser", "principal"],
  viewLearners: "all",
  lardoTracking: ["adviser", "masterTeacher", "principal", "smeaCoordinator"],
  nutritionStatus: ["adviser", "smeaCoordinator"],
  transfersLog: ["adviser", "ictCoordinator", "principal", "smeaCoordinator"],
  certificates: ["ictCoordinator", "principal", "adviser"],
  idGenerator: ["ictCoordinator"],
  smeaEnrollment: ["principal", "masterTeacher", "ictCoordinator", "smeaCoordinator"],
  importCenter: ["ictCoordinator"],
  sf1Import: ["ictCoordinator"],
  sf10Import: ["ictCoordinator"],
  userManagement: ["ictCoordinator", "principal"],
  brandingSettings: ["ictCoordinator", "principal"]
};

export const VIEW_LEARNERS_BLOCKED_ROLES = ["stakeholder"];
export const VIEW_LEARNERS_EDIT_ROLES = ["adviser"];

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
