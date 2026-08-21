// src/utils/subjectDirectory.js
// Query helpers over DEPED_SUBJECT_DIRECTORY (src/data/depedSubjectDirectory.js).
// Answers "what subjects exist for this grade level" -- consumed by the
// User Management subject picker. Never answers "what does this teacher
// teach" (that's users/{uid}.assignments, resolved by useTeacherScope).

import { KEY_STAGE_OPTIONS } from "./keyStagesConfig";
import { DEPED_SUBJECT_DIRECTORY, ALL_TERMS } from "../data/depedSubjectDirectory";

// Reverse-lookup over the single KEY_STAGE_OPTIONS source of truth --
// deliberately not a second grade->stage table.
export function getKeyStageForGradeLevel(gradeLevel) {
  const stage = KEY_STAGE_OPTIONS.find((s) => s.gradeLevels.includes(gradeLevel));
  return stage ? stage.key : null;
}

function flattenClusterSubjects(clusters) {
  return (clusters || []).flatMap((cluster) =>
    (cluster.subjects || []).map((name) => ({ id: name, label: name, aliases: [], group: cluster.name }))
  );
}

function withDefaultTerms(entries) {
  return entries.map((e) => (e.terms ? e : { ...e, terms: ALL_TERMS }));
}

// DO 017 Strengthened SHS rollout: Grade 11 has used the Strengthened SHS
// core+cluster curriculum since it took effect. Grade 12 is the transition
// cohort -- SY2026-2027's Grade 12 finishes under the Original/Traditional
// K-12 curriculum they started under (the source document's "Grade 12:
// Original / Traditional SHS Curriculum" section), while from SY2027-2028
// onward, Grade 12 is the same cohort that was Grade 11 the year before
// under Strengthened SHS, so they continue on that curriculum rather than
// switching to a still-unpublished "new Grade 12" set. This is the one
// curriculum-version transition the source document actually evidences;
// no other future version is assumed or fabricated.
const SHS_TRANSITION_SCHOOL_YEAR = "2026-2027";

function schoolYearStartYear(schoolYear) {
  const match = /^(\d{4})/.exec(String(schoolYear ?? "").trim());
  return match ? Number(match[1]) : null;
}

/**
 * "current" (matches the source document's Grade 12 = Original K-12 SHS) or
 * "strengthened" (Grade 12 = Strengthened SHS, same set as Grade 11) for a
 * given school year. Grade 11 is always "strengthened". Unrecognized/blank
 * school years fall back to "current" (the transition-year default) rather
 * than assuming a rollout that isn't confirmed.
 */
export function resolveGrade12Curriculum(schoolYear) {
  const startYear = schoolYearStartYear(schoolYear);
  const transitionStartYear = schoolYearStartYear(SHS_TRANSITION_SCHOOL_YEAR);
  if (startYear === null) return "current";
  return startYear > transitionStartYear ? "strengthened" : "current";
}

/**
 * All subject entries offered for a given grade level (and, for SHS,
 * school year -- see resolveGrade12Curriculum). Grade 11 and Grade 12 are
 * distinct sets (DO 017); Grade 4-10 share the KS2/KS3 learning-area list.
 * Returns [] for an unrecognized/unsupported grade level rather than ever
 * falling back to "everything". `term` (1/2/3), when given, further
 * restricts to subjects whose `terms` array includes it.
 */
export function getSubjectsForGradeLevel(gradeLevel, { schoolYear, term } = {}) {
  const stageKey = getKeyStageForGradeLevel(gradeLevel);
  if (!stageKey) return [];

  let subjects;
  if (stageKey === "ks4") {
    if (gradeLevel === "Grade 11") {
      const { core, clusters } = DEPED_SUBJECT_DIRECTORY.ks4.grade11;
      subjects = withDefaultTerms([...core, ...flattenClusterSubjects(clusters)]);
    } else if (gradeLevel === "Grade 12") {
      subjects =
        resolveGrade12Curriculum(schoolYear) === "strengthened"
          ? getSubjectsForGradeLevel("Grade 11", { schoolYear })
          : (() => {
              const { applied, strands } = DEPED_SUBJECT_DIRECTORY.ks4.grade12;
              return withDefaultTerms([...applied, ...flattenClusterSubjects(strands)]);
            })();
    } else {
      subjects = [];
    }
  } else {
    subjects = withDefaultTerms(DEPED_SUBJECT_DIRECTORY[stageKey]?.subjects || []);
  }

  if (term === undefined || term === null) return subjects;
  return subjects.filter((s) => (s.terms || ALL_TERMS).includes(term));
}

/**
 * Case/whitespace-insensitive substring search over the subjects available
 * for a grade level (+ optional school year/term) -- powers the searchable
 * User Management picker.
 */
export function searchSubjects(query, gradeLevel, options) {
  const subjects = getSubjectsForGradeLevel(gradeLevel, options);
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return subjects;
  return subjects.filter((s) => s.label.toLowerCase().includes(q));
}
