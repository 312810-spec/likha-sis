// src/utils/personnelPositions.js
// Centralized DepEd plantilla position/designation list, shared by
// AccountSettings.jsx (self-service profile) and UserManagement.jsx (ICT
// Coordinator editing other staff), so both use the same dropdown options
// instead of two independently-typed lists.
//
// Positions are NOT the same thing as LIKHA-SIS application roles (Adviser,
// ICT Coordinator, SMEA Coordinator, Clinic Teacher, ...) -- those already
// live in src/utils/roles.js and control what a user can access in the app.
// This list is plantilla/civil-service designation only (e.g. "Teacher III"),
// shown under Position / Designation, never duplicated into Role(s).

export const PERSONNEL_POSITIONS = [
  "Teacher I",
  "Teacher II",
  "Teacher III",
  "Teacher IV",
  "Teacher V",
  "Teacher VI",
  "Teacher VII",
  "Master Teacher I",
  "Master Teacher II",
  "Master Teacher III",
  "Master Teacher IV",
  "Master Teacher V",
  "Head Teacher I",
  "Head Teacher II",
  "Head Teacher III",
  "Head Teacher IV",
  "Head Teacher V",
  "Head Teacher VI",
  "Assistant School Principal",
  "School Principal I",
  "School Principal II",
  "School Principal III",
  "School Principal IV",
  "Guidance Counselor",
  "School Guidance Counselor",
  "Administrative Officer",
  "Administrative Assistant",
];

// Sentinel value for a stored position that isn't in PERSONNEL_POSITIONS --
// either legacy free-text data, or a title not yet on the list. Never
// silently dropped: resolvePositionOptions() below always keeps it visible
// and selected rather than falling back to some other option.
export const OTHER_POSITION_VALUE = "__other__";
export const OTHER_POSITION_LABEL = "Other / Existing Position";

/**
 * {value, label} options for a Position <select>, given the currently-stored
 * value (if any). A stored value already on the canonical list is left
 * alone. A stored value NOT on the list (legacy data, or a title this list
 * doesn't cover yet) is preserved as its own selectable option -- value ===
 * label === the exact stored text -- rather than being replaced or lost.
 * The trailing "Other / Existing Position" entry uses the OTHER_POSITION_VALUE
 * sentinel so the caller can detect it and reveal a free-text input.
 */
export function resolvePositionOptions(storedPosition) {
  const trimmed = String(storedPosition || "").trim();
  const options = PERSONNEL_POSITIONS.map((p) => ({ value: p, label: p }));
  if (trimmed && !PERSONNEL_POSITIONS.includes(trimmed)) {
    options.push({ value: trimmed, label: trimmed });
  }
  options.push({ value: OTHER_POSITION_VALUE, label: OTHER_POSITION_LABEL });
  return options;
}

/** The <select> value to show for a stored position: itself if listed/preserved, OTHER_POSITION_VALUE if blank/unset. */
export function resolvePositionSelectValue(storedPosition) {
  const trimmed = String(storedPosition || "").trim();
  return trimmed || OTHER_POSITION_VALUE;
}
