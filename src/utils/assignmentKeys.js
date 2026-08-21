// src/utils/assignmentKeys.js
// Denormalizes users/{uid}.assignments[] into a flat array of composite
// strings so firestore.rules can authorize a classRecords write with a
// simple `in` check instead of iterating/matching maps (security rules
// have no way to test "does any assignment map have these three fields",
// only exact list membership). Computed here and stored as
// users/{uid}.assignmentKeys alongside `assignments` -- kept in sync by
// whoever writes assignments (UserManagement.jsx), never edited directly.
//
// Format: "<subject>|<gradeLevel>|<section>" for subjectTeacher
// assignments, "ADVISER|<gradeLevel>|<section>" for adviser assignments.
// Matches the identity classRecords documents are keyed by (see
// ClassRecord.jsx getDocId): grade+section+subject, not per-teacher.

export function subjectAssignmentKey(subject, gradeLevel, section) {
  return `${subject}|${gradeLevel}|${section}`;
}

export function adviserAssignmentKey(gradeLevel, section) {
  return `ADVISER|${gradeLevel}|${section}`;
}

export function buildAssignmentKeys(assignments) {
  const list = Array.isArray(assignments) ? assignments : [];
  const keys = new Set();
  list.forEach((a) => {
    if (!a?.gradeLevel || !a?.section) return;
    if (a.role === "subjectTeacher" && a.subject) {
      keys.add(subjectAssignmentKey(a.subject, a.gradeLevel, a.section));
    } else if (a.role === "adviser") {
      keys.add(adviserAssignmentKey(a.gradeLevel, a.section));
    }
  });
  return Array.from(keys);
}
