// src/utils/teacherScope.js
// Pure, Firestore-free scoping logic shared by useTeacherScope and every
// adviser/subject-teacher-facing form. Kept pure so scoping decisions are
// testable without mocking Firestore.
//
// Authoritative source for "what does this teacher teach": users/{uid}.assignments[]
// (role/subject/gradeLevel/section), NOT the schedules/{sy}/sections timetable.

import { canonicalGradeLevel, normalizeGrade } from "../importers/shared/normalization.js";

export function sectionKey(gradeLevel, section) {
  return `${String(gradeLevel ?? "").trim()}|${String(section ?? "").trim()}`;
}

// assignments: users/{uid}.assignments[] entries. Exactly one `role: "adviser"`
// entry is the only valid state (enforced at write time by UserManagement.jsx);
// zero or more than one both fail closed to `null` rather than guess which
// section is authoritative. gradeLevel is normalized ("7" and "Grade 7" both
// resolve to "Grade 7") since assignments store the bare digit while
// learners/attendance/classRecords all key on the canonical "Grade N" form.
export function resolveAdviserScope(assignments) {
  const list = Array.isArray(assignments) ? assignments : [];
  const adviserAssignments = list.filter((a) => a?.role === "adviser" && a?.gradeLevel && a?.section);
  if (adviserAssignments.length !== 1) return null;
  const a = adviserAssignments[0];
  return { gradeLevel: canonicalGradeLevel(a.gradeLevel), section: String(a.section).trim() };
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

// Flat, canonical, deduped list of {gradeLevel, subject, section, terms}
// this teacher may open a Class Record for. Built once from raw
// users/{uid}.assignments[] and shared by the Class Record sidebar
// hierarchy (groupClassRecordAssignments) and the ClassRecord page's own
// authorization check (findClassRecordAssignment), so both always agree on
// exactly what "assigned" means: an explicit role: "subjectTeacher" entry.
// A role: "adviser" entry never contributes a combo here -- an adviser may
// open a Class Record only when they also hold the matching subjectTeacher
// assignment, even for their own advisory section.
export function resolveClassRecordCombos(assignments) {
  const list = Array.isArray(assignments) ? assignments : [];
  const seen = new Map();
  list
    .filter((a) => a?.role === "subjectTeacher" && a?.subject && a?.gradeLevel && a?.section)
    .forEach((a) => {
      const gradeLevel = canonicalGradeLevel(a.gradeLevel);
      const subject = String(a.subject).trim();
      const section = String(a.section).trim();
      const key = `${gradeLevel}|${subject}|${section}`;
      if (!seen.has(key)) {
        seen.set(key, {
          gradeLevel,
          subject,
          section,
          terms: Array.isArray(a.terms) && a.terms.length > 0 ? a.terms : null,
        });
      }
    });
  return Array.from(seen.values());
}

function compareGradeLevels(a, b) {
  return (Number(normalizeGrade(a)) || 0) - (Number(normalizeGrade(b)) || 0);
}

// Groups a flat classRecordCombos list (see resolveClassRecordCombos) into
// the Grade Level -> Subject -> Section[] hierarchy the Sidebar's Class
// Record nav renders: { "Grade 7": { "Mathematics 7": [{ section, terms }] } }.
// Grade levels sort numerically; subjects and sections sort alphabetically
// within their parent.
export function groupClassRecordAssignments(combos) {
  const list = Array.isArray(combos) ? combos : [];
  const gradeLevels = Array.from(new Set(list.map((c) => c.gradeLevel))).sort(compareGradeLevels);

  const result = {};
  gradeLevels.forEach((gradeLevel) => {
    const forGrade = list.filter((c) => c.gradeLevel === gradeLevel);
    const subjects = Array.from(new Set(forGrade.map((c) => c.subject))).sort((a, b) => a.localeCompare(b));
    const subjectResult = {};
    subjects.forEach((subject) => {
      subjectResult[subject] = forGrade
        .filter((c) => c.subject === subject)
        .map((c) => ({ section: c.section, terms: c.terms }))
        .sort((a, b) => a.section.localeCompare(b.section));
    });
    result[gradeLevel] = subjectResult;
  });
  return result;
}

// Validates a candidate Class Record selection (a Sidebar leaf click, or a
// caller-supplied initialSelection that could have been tampered with)
// against the teacher's own canonical classRecordCombos. Only the
// candidate's fields are normalized -- combos are already canonical -- so a
// payload spelling the grade level differently ("7" vs "Grade 7") can't
// slip past the check. Returns the matching combo (with its `terms`, for
// the SHS term restriction) or null when unauthorized.
export function findClassRecordAssignment(combos, candidate) {
  const list = Array.isArray(combos) ? combos : [];
  const targetGrade = canonicalGradeLevel(candidate?.gradeLevel);
  const targetSubject = String(candidate?.subject ?? "").trim();
  const targetSection = String(candidate?.section ?? "").trim();
  if (!targetGrade || !targetSubject || !targetSection) return null;
  return (
    list.find(
      (c) => c.gradeLevel === targetGrade && c.subject === targetSubject && c.section === targetSection
    ) || null
  );
}

// Combines adviser + subject scope into one shape consumers can query.
export function buildTeacherScope({ assignments }) {
  const adviser = resolveAdviserScope(assignments);
  const subjectMap = resolveSubjectScope(assignments);
  const classRecordCombos = resolveClassRecordCombos(assignments);
  const classRecordHierarchy = groupClassRecordAssignments(classRecordCombos);

  const allowedSectionKeys = new Set();
  if (adviser) allowedSectionKeys.add(sectionKey(adviser.gradeLevel, adviser.section));
  subjectMap.forEach((classes) => {
    classes.forEach((c) => allowedSectionKeys.add(sectionKey(c.gradeLevel, c.section)));
  });

  return {
    adviser,
    subjectMap,
    classRecordCombos,
    classRecordHierarchy,
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
