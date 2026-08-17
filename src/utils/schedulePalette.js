// src/utils/schedulePalette.js
// Builds the teacher roster the palette filters on. Account-backed teachers are
// seeded from users[].assignments -- the app already knows who teaches what --
// and ad-hoc entries cover staff without a LIKHA-SIS account, including the
// "Teacher A" placeholders in the source document.

export function buildTeacherRoster({ users = [], adhocTeachers = [], storedHandles = {} }) {
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

  const fromAdhoc = adhocTeachers.map((teacher) => ({
    id: teacher.id,
    source: "adhoc",
    userId: null,
    displayName: teacher.displayName,
    handles: Array.isArray(teacher.handles) ? teacher.handles : [],
  }));

  return [...fromUsers, ...fromAdhoc];
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
