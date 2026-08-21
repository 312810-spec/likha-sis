// src/utils/sf1RecordQuality.js
// Grade-aware "is this SF1 learner record complete enough" checks, shared by
// the Live Register's SF1 Record Check panel, the Needs Sex Assignment list,
// and the learner editor's inline field flags. Kept pure/Firestore-free so
// it can be unit tested without mocking Firebase.
//
// Only fields the official SF1 meaning actually requires are checked here --
// e.g. Mother Tongue is official DepEd requirement for Grades 1-3 only, so it
// is never flagged missing for any other grade level.

const MOTHER_TONGUE_GRADES = new Set(["Grade 1", "Grade 2", "Grade 3"]);

function isBlank(value) {
  return !String(value ?? "").trim();
}

/** True when a learner's Sex (M/F) could not be read. */
export function needsSexAssignment(learner) {
  return isBlank(learner?.sex);
}

/**
 * Field-level issues for one learner, grade-aware. Each issue names the
 * Firestore field so a caller (the "Fix" button) can jump the editor
 * straight to it. "Missing Sex" is intentionally excluded here -- it is
 * surfaced separately via needsSexAssignment()/the Needs Sex Assignment list,
 * since fixing it is a one-click action rather than opening the full editor.
 */
export function getSf1RecordIssues(learner, gradeLevel) {
  const l = learner || {};
  const issues = [];
  if (isBlank(l.lrn)) issues.push({ field: "lrn", label: "Missing LRN" });
  if (isBlank(l.lastName)) issues.push({ field: "lastName", label: "Missing Last Name" });
  if (isBlank(l.firstName)) issues.push({ field: "firstName", label: "Missing First Name" });
  if (isBlank(l.birthDate)) issues.push({ field: "birthDate", label: "Missing Birth Date" });
  if (isBlank(l.contactNumber)) {
    issues.push({ field: "contactNumber", label: "Missing Contact Number" });
  }
  if (MOTHER_TONGUE_GRADES.has(gradeLevel) && isBlank(l.motherTongue)) {
    issues.push({ field: "motherTongue", label: "Missing Mother Tongue" });
  }
  return issues;
}

/**
 * Summarizes a class roster for the Record Check panel.
 * A learner counts as "complete" only when it has no field issues AND its
 * sex is resolved -- a sex-missing learner still shows up in needAttention
 * so the summary count and the detail list agree.
 */
export function sf1RecordSummary(learners, gradeLevel) {
  const list = Array.isArray(learners) ? learners : [];
  const total = list.length;
  const needAttention = [];
  const sexUnresolved = [];

  for (const learner of list) {
    const issues = getSf1RecordIssues(learner, gradeLevel);
    const missingSex = needsSexAssignment(learner);
    if (missingSex) sexUnresolved.push(learner);
    if (issues.length > 0 || missingSex) {
      needAttention.push({ learner, issues });
    }
  }

  return {
    total,
    complete: total - needAttention.length,
    needAttentionCount: needAttention.length,
    needAttention,
    sexUnresolved,
  };
}
