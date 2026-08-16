// src/utils/userAccountManagement.js
// Pure logic backing the ICT Coordinator / Principal "manage other users"
// features in UserManagement.jsx: the deactivation gate checked in App.jsx,
// the self-edit guard on the User Directory table, and edit-form validation.

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
