// src/utils/teacherScope.js
// Pure, Firestore-free scoping logic shared by useTeacherScope and every
// adviser/subject-teacher-facing form. Kept pure so scoping decisions are
// testable without mocking Firestore.
//
// Authoritative source for "what does this teacher teach": users/{uid}.assignments[]
// (role/subject/gradeLevel/section), NOT the schedules/{sy}/sections timetable.
// See docs/ai/DECISIONS.md for the rationale.

export function sectionKey(gradeLevel, section) {
  return `${String(gradeLevel ?? "").trim()}|${String(section ?? "").trim()}`;
}

// advisorySection: { gradeLevel, name } | null (from useMyAdvisorySection's
// schedules/{sy}/sections doc, where `name` is the section name).
export function resolveAdviserScope(advisorySection) {
  if (!advisorySection?.gradeLevel || !advisorySection?.name) return null;
  return { gradeLevel: advisorySection.gradeLevel, section: advisorySection.name };
}

// assignments: users/{uid}.assignments[] entries, e.g.
// { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "LOVE" }
// SHS (Grade 11/12) assignments may additionally carry `terms: [1,2,3]` --
// which term(s) of the school year this teacher actually teaches that
// subject/section combo. Absent `terms` means "every term" (today's
// whole-year default for non-SHS grades, unchanged).
export function resolveSubjectScope(assignments) {
  const list = Array.isArray(assignments) ? assignments : [];
  const bySubject = new Map();
  list
    .filter((a) => a?.role === "subjectTeacher" && a?.subject && a?.gradeLevel && a?.section)
    .forEach((a) => {
      const entry = bySubject.get(a.subject) || [];
      entry.push({
        gradeLevel: a.gradeLevel,
        section: a.section,
        terms: Array.isArray(a.terms) && a.terms.length > 0 ? a.terms : null,
      });
      bySubject.set(a.subject, entry);
    });
  return bySubject;
}

// True when a scoped class entry covers the given term (1/2/3). A `terms:
// null` entry (the non-SHS/whole-year default) covers every term.
export function classCoversTerm(classEntry, term) {
  if (term === undefined || term === null) return true;
  return !classEntry.terms || classEntry.terms.includes(term);
}

// Combines adviser + subject scope into one shape consumers can query.
export function buildTeacherScope({ advisorySection, assignments }) {
  const adviser = resolveAdviserScope(advisorySection);
  const subjectMap = resolveSubjectScope(assignments);

  const allowedSectionKeys = new Set();
  if (adviser) allowedSectionKeys.add(sectionKey(adviser.gradeLevel, adviser.section));
  subjectMap.forEach((classes) => {
    classes.forEach((c) => allowedSectionKeys.add(sectionKey(c.gradeLevel, c.section)));
  });

  return {
    adviser,
    subjectMap,
    allowedSectionKeys,
    isAdviser: !!adviser,
    isSubjectTeacher: subjectMap.size > 0,
  };
}

export function isSectionAllowed(scope, gradeLevel, section) {
  if (!scope) return false;
  return scope.allowedSectionKeys.has(sectionKey(gradeLevel, section));
}

// `term` (1/2/3), when given, restricts to subjects that have at least one
// class covering that term -- e.g. a Term-1-only SHS subject disappears
// from the Class Record subject list once the teacher switches to Term 2.
export function subjectsForScope(scope, term) {
  if (!scope) return [];
  const subjects = Array.from(scope.subjectMap.entries())
    .filter(([, classes]) => term === undefined || term === null || classes.some((c) => classCoversTerm(c, term)))
    .map(([subject]) => subject);
  return subjects.sort();
}

export function sectionsForSubject(scope, subject, term) {
  if (!scope) return [];
  const classes = scope.subjectMap.get(subject) || [];
  return classes.filter((c) => classCoversTerm(c, term));
}
