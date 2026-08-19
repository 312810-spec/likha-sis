// src/utils/schedulePalette.js
// Builds the teacher roster the palette filters on. Account-backed teachers are
// seeded from users[].assignments -- the app already knows who teaches what --
// and ad-hoc entries cover staff without a LIKHA-SIS account, including the
// "Teacher A" placeholders in the source document.
//
// A third source, storedTeachers (the schedules/{sy}/teachers docs that are not
// ad-hoc), fills in for account-backed teachers when the `users` collection
// could not be listed (adviser/masterTeacher cannot LIST users per
// firestore.rules) -- their displayName and handles are already sitting in the
// stored teacher doc, keyed by the same id. When `users` IS available, a
// stored doc for the same id enriches rather than duplicates the
// users-derived entry, so nothing changes for the editing roles.

export function buildTeacherRoster({
  users = [],
  adhocTeachers = [],
  storedHandles = {},
  storedTeachers = [],
}) {
  const fromUsers = users.map((user) => {
    const assignments = Array.isArray(user.assignments) ? user.assignments : [];
    const seeded = [
      ...new Set(
        assignments
          .filter((a) => a.role === "subjectTeacher" && a.subject)
          .map((a) => a.subject)
      ),
    ];

    return {
      id: user.id,
      source: "user",
      userId: user.id,
      displayName: user.fullName || user.email || user.id,
      handles: storedHandles[user.id] || seeded,
    };
  });

  const byId = new Map(fromUsers.map((t) => [t.id, t]));

  storedTeachers
    .filter((t) => t.source !== "adhoc")
    .forEach((t) => {
      const entry = {
        id: t.id,
        source: "user",
        userId: t.id,
        displayName: t.displayName || t.id,
        handles: storedHandles[t.id] || t.handles || [],
      };
      const existing = byId.get(t.id);
      // Merge by id, do not duplicate: the users-derived entry (if any) stays
      // the primary source, and the stored doc only fills the row in when
      // `users` had nothing for this id.
      byId.set(t.id, existing ? { ...entry, ...existing } : entry);
    });

  const fromAdhoc = adhocTeachers.map((teacher) => ({
    id: teacher.id,
    source: "adhoc",
    userId: null,
    displayName: teacher.displayName,
    handles: Array.isArray(teacher.handles) ? teacher.handles : [],
  }));

  return [...byId.values(), ...fromAdhoc];
}

export function subjectsForTeacher(teacher) {
  return Array.isArray(teacher && teacher.handles) ? teacher.handles : [];
}

export function teachersForSubject(teachers, subject) {
  if (!subject) return teachers;
  return teachers.filter(
    (t) => Array.isArray(t.handles) && t.handles.includes(subject)
  );
}
