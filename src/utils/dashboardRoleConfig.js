// src/utils/dashboardRoleConfig.js
// Pure derivation of "what should this signed-in user's Dashboard show" from
// their roles. Built entirely on canAccessPage()/role membership so this is
// presentation-layer configuration, never a competing authorization system --
// pageAccess.js and firestore.rules remain authoritative (CLAUDE.md §13).

import { canAccessPage } from "../pageAccess.js";

/**
 * @param {string[]} roles
 * @returns {{
 *   isAdviser: boolean,
 *   isSubjectTeacher: boolean,
 *   schoolOverview: boolean,
 *   systemOverview: boolean,
 *   smeaOverview: boolean,
 *   guidanceOverview: boolean,
 *   masterTeacherOverview: boolean,
 *   lardoOverview: boolean,
 *   nutritionOverview: boolean,
 *   schoolForms: boolean,
 * }}
 */
export function getDashboardCapabilities(roles = []) {
  const list = Array.isArray(roles) ? roles : [];
  const has = (role) => list.includes(role);

  return {
    isAdviser: has("adviser"),
    isSubjectTeacher: has("subjectTeacher"),
    schoolOverview: has("principal"),
    systemOverview: has("ictCoordinator"),
    smeaOverview: has("smeaCoordinator"),
    guidanceOverview: has("guidance"),
    masterTeacherOverview: has("masterTeacher"),
    lardoOverview: canAccessPage("lardoTracking", list),
    nutritionOverview: canAccessPage("nutritionStatus", list) || canAccessPage("nutritionConsolidator", list),
    schoolForms: canAccessPage("sf1", list),
  };
}

// Candidate quick actions, in priority order. Every entry is filtered through
// canAccessPage() before being returned, so a button is never rendered for a
// page that would immediately show "Access Restricted" (spec §16).
const QUICK_ACTION_CANDIDATES = [
  { page: "viewLearners", label: "View Learners" },
  { page: "sf1", label: "SF1" },
  { page: "sf2", label: "SF2" },
  { page: "sf4", label: "SF4" },
  { page: "reportCard", label: "Report Card / SF9" },
  { page: "sf10Generate", label: "SF10" },
  { page: "classRecord", label: "Class Record" },
  { page: "consolidatedGrades", label: "Consolidated Grades" },
  { page: "lardoTracking", label: "LARDO Tracking" },
  { page: "anecdotalRecords", label: "Anecdotal Records" },
  { page: "nutritionConsolidator", label: "Nutrition Consolidator" },
  { page: "smeaEnrollment", label: "SMEA Enrollment" },
  { page: "userManagement", label: "User Management" },
  { page: "importCenter", label: "Import Center" },
  { page: "schoolSettings", label: "School Settings" },
  { page: "classProgram", label: "Class Program" },
  { page: "schoolCalendar", label: "School Calendar" },
  { page: "announcements", label: "Announcements" },
];

/** Quick-action candidates this role set is actually allowed to open. */
export function getQuickActions(roles = []) {
  return QUICK_ACTION_CANDIDATES.filter((action) => canAccessPage(action.page, roles));
}
