// src/utils/userAccountManagement.js
// Pure logic backing the ICT Coordinator / Principal "manage other users"
// features in UserManagement.jsx: the deactivation gate checked in App.jsx,
// the self-edit guard on the User Directory table, and edit-form validation.

import { canonicalGradeLevel } from "../importers/shared/normalization.js";

/**
 * Whether a user's account is active. Existing accounts predate the `active`
 * field, so its absence (or a still-loading `null`/`undefined` profile)
 * defaults to active rather than force-signing people out.
 */
export function isAccountActive(profile) {
  if (!profile) return true;
  return profile.active !== false;
}

/**
 * Whether the given user directory row can be edited/deactivated/reset by
 * the currently signed-in user. Managing your own row is blocked here so an
 * ICT Coordinator can't accidentally remove their own access or deactivate
 * themselves -- self-service changes go through AccountSettings.jsx instead.
 */
export function isEditableUserRow(currentUid, rowUid) {
  if (!currentUid) return false;
  return rowUid !== currentUid;
}

/**
 * Whether an account can be deactivated through User Management. ICT
 * Coordinator accounts are exempt from every other managed user's
 * Deactivate action -- deactivating the only role with School Settings/User
 * Management access would be a lockout, so this is enforced here (and
 * re-checked inside the deactivate handler itself) rather than left as a
 * UI-only restriction that a direct call could bypass.
 */
export function canDeactivateAccount(roles) {
  return !(Array.isArray(roles) && roles.includes("ictCoordinator"));
}

/**
 * Validates the User Management edit form. Mirrors the account-creation
 * form's validation in UserManagement.jsx.
 */
export function validateUserEditForm({ fullName, roles }) {
  if (!fullName || !fullName.trim()) {
    return { valid: false, error: "Full Name is required." };
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    return { valid: false, error: "Please select at least one role for the user." };
  }
  return { valid: true, error: "" };
}

/**
 * Validates an ICT Coordinator's self-service role edit in AccountSettings.jsx.
 * Mirrors the firestore.rules guard: an ICT Coordinator may add other roles
 * to their own account but can never remove ictCoordinator from themselves,
 * so they can't accidentally lock themselves out of User Management.
 */
export function validateSelfRoleEdit(roles) {
  if (!Array.isArray(roles) || !roles.includes("ictCoordinator")) {
    return { valid: false, error: "You can't remove your own ICT Coordinator role." };
  }
  return { valid: true, error: "" };
}

/**
 * Keeps an account's `assignments` consistent with the "adviser" role:
 * - Role removed -> strip any leftover `role: "adviser"` entries (a stale
 *   assignment must never survive the role being unchecked).
 * - Role present -> require exactly one adviser assignment. Zero or more
 *   than one is rejected, since useTeacherScope/teacherScope.js resolves
 *   adviser scope to null (fail closed) in either case anyway.
 */
export function reconcileAdviserAssignments(assignments, roles) {
  const list = Array.isArray(assignments) ? assignments : [];
  const roleList = Array.isArray(roles) ? roles : [];

  if (!roleList.includes("adviser")) {
    return { assignments: list.filter((a) => a?.role !== "adviser"), error: "" };
  }

  const adviserCount = list.filter((a) => a?.role === "adviser").length;
  if (adviserCount === 0) {
    return { assignments: list, error: "Add exactly one advisory class assignment for this Adviser." };
  }
  if (adviserCount > 1) {
    return {
      assignments: list,
      error: "An adviser can only be assigned to one advisory class. Remove the extra assignment.",
    };
  }
  return { assignments: list, error: "" };
}

/**
 * Finds another user in the already-loaded directory who advises the same
 * grade + section, so User Management can refuse the duplicate without an
 * extra Firestore read. Grade level is normalized ("7" vs "Grade 7") and
 * section compared case-insensitively/trimmed to match how assignments are
 * actually stored (see teacherScope.js resolveAdviserScope).
 */
export function findAdviserAssignmentConflict(userList, gradeLevel, section, excludeUid) {
  const targetGrade = canonicalGradeLevel(gradeLevel);
  const targetSection = String(section ?? "").trim().toLowerCase();
  if (!targetGrade || !targetSection) return null;

  const list = Array.isArray(userList) ? userList : [];
  return (
    list.find((u) => {
      if (!u || u.id === excludeUid) return false;
      const assignments = Array.isArray(u.assignments) ? u.assignments : [];
      return assignments.some(
        (a) =>
          a?.role === "adviser" &&
          canonicalGradeLevel(a.gradeLevel) === targetGrade &&
          String(a.section ?? "").trim().toLowerCase() === targetSection
      );
    }) || null
  );
}
