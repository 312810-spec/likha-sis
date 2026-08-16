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
  accountSettings: "all",
  // Both pages are readable by every role — a teacher must be able to see a
  // class suspension or an upcoming holiday. Authoring is gated separately by
  // canPostAnnouncements / canManageSchoolEvents below, the same way LARDO
  // Tracking is viewable more widely than its discipline tab is.
  announcements: "all",
  schoolCalendar: "all"
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

// School-wide publishing rights. The Principal owns official school
// communication; the ICT Coordinator is the one who actually operates the
// system and transcribes DepEd issuances into it. Nobody else can post, so a
// class suspension or a DepEd Order carries the weight of those two offices —
// mirrored in firestore.rules, since a client-side check alone is not a control.
export const ANNOUNCEMENT_AUTHOR_ROLES = ["principal", "ictCoordinator"];

export function canPostAnnouncements(userRoles) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) {
    return false;
  }
  return ANNOUNCEMENT_AUTHOR_ROLES.some((role) => userRoles.includes(role));
}

// School calendar events (exam weeks, Brigada Eskwela, card distribution) are
// scheduled by the same two offices that post announcements.
export function canManageSchoolEvents(userRoles) {
  return canPostAnnouncements(userRoles);
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
