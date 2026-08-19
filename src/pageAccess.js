// src/pageAccess.js

export const PAGE_ACCESS = {
  dashboard: "all",
  sf1: ["adviser", "ictCoordinator", "principal"],
  // Adviser marks attendance; the other roles only see the read-only Year
  // Overview tab (SF2.jsx gates the monthly grid itself to adviser).
  sf2: ["adviser", "principal", "masterTeacher", "smeaCoordinator", "guidance", "ictCoordinator"],
  sf4: ["adviser"],
  classRecord: ["subjectTeacher", "adviser"],
  consolidatedGrades: ["subjectTeacher", "adviser", "principal", "masterTeacher", "smeaCoordinator"],
  reportCard: ["adviser", "principal"],
  viewLearners: "all",
  lardoTracking: ["adviser", "masterTeacher", "principal", "smeaCoordinator", "guidance"],
  nutritionStatus: ["adviser", "smeaCoordinator"],
  nutritionConsolidator: ["adviser", "smeaCoordinator", "principal"],
  transfersLog: ["adviser", "ictCoordinator", "principal", "smeaCoordinator"],
  certificates: ["adviser", "subjectTeacher", "principal"],
  idGenerator: ["adviser", "ictCoordinator", "principal"],
  smeaEnrollment: ["principal", "masterTeacher", "ictCoordinator", "smeaCoordinator"],
  smeaAcademicHub: ["principal", "masterTeacher", "ictCoordinator", "smeaCoordinator", "adviser", "subjectTeacher"],
  importCenter: ["ictCoordinator", "principal"],
  sf1Import: ["ictCoordinator", "principal"],
  sf10Import: ["ictCoordinator", "principal"],
  sf10Generate: ["adviser", "principal", "ictCoordinator"],
  userManagement: ["ictCoordinator", "principal"],
  schoolSettings: ["ictCoordinator"],
  accountSettings: "all",
  anecdotalRecords: ["adviser", "guidance", "principal", "masterTeacher"],
  // Parent portal: accessible only to the parent role.
  // Parents are provisioned by ICT Coordinator and have no access to staff tools.
  parentPortal: ["parent"],
};

export const VIEW_LEARNERS_BLOCKED_ROLES = ["stakeholder", "parent"];
export const VIEW_LEARNERS_EDIT_ROLES = ["adviser"];

// Roles that are restricted to the Parent Portal only — they must never
// gain access to any staff page even if PAGE_ACCESS is accidentally set to "all".
export const PARENT_ONLY_ROLES = ["parent"];

export function canAccessPage(page, userRoles = []) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return false;
  const allowed = PAGE_ACCESS[page];
  if (!allowed) return false;
  if (page === "viewLearners") {
    if (userRoles.some((role) => VIEW_LEARNERS_BLOCKED_ROLES.includes(role))) {
      return false;
    }
  }
  if (allowed === "all") return true;
  return userRoles.some((role) => allowed.includes(role));
}

export function canEditLearners(userRoles = []) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return false;
  return userRoles.some((role) => VIEW_LEARNERS_EDIT_ROLES.includes(role));
}

export function canAccessDisciplineRecords(userRoles = []) {
  return canAccessPage("lardoTracking", userRoles);
}
