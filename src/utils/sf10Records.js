// Merges a learner's live LIKHA-SIS classRecords (any school year they were
// taught inside this system) with their imported academicRecords (SF10
// importer -- pre-adoption history or transferee records) into one
// chronological academic history for the SF10 Generator. classRecords wins
// for any school year + grade level it covers; academicRecords fills in the
// rest. Pure and Firestore-free -- callers fetch the collections and pass
// arrays in.

import { computeLearnerTermGrade } from "./gradeComputations.js";

const TERMS = ["Term 1", "Term 2", "Term 3"];

// "7" -> "Grade 7". Already-formatted values ("Grade 7") pass through
// unchanged. academicRecords.gradeLevel is bare digits (see
// src/importers/shared/normalization.js normalizeGrade()); classRecords
// docs already store "Grade N", so both sides must agree on this format to
// dedupe correctly and to render consistently in the SF10 grid.
function formatGradeLevel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^grade\s/i.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `Grade ${raw}`;
  return raw;
}

function yearGradeKey(schoolYear, gradeLevel) {
  return `${String(schoolYear ?? "").trim()}|${formatGradeLevel(gradeLevel)}`;
}

function average(numbers) {
  if (numbers.length === 0) return "—";
  return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
}

// Groups classRecords docs that mention this learner by school year + grade
// level, then computes each subject's final grade the same way
// ReportCard.jsx does: average of whichever Term 1/2/3 grades exist for
// that subject, rounded. Returns a Map<key, row>.
function buildLiveRows(learnerId, classRecordsList, getSubjectWeightsFn) {
  const mine = classRecordsList.filter((record) => record?.scores?.[learnerId]);

  const byYearGrade = new Map();
  mine.forEach((record) => {
    const key = yearGradeKey(record.schoolYear, record.gradeLevel);
    if (!byYearGrade.has(key)) {
      byYearGrade.set(key, {
        schoolYear: String(record.schoolYear ?? "").trim(),
        gradeLevel: formatGradeLevel(record.gradeLevel),
        bySubject: new Map(), // SUBJECT_KEY -> { "Term 1": record, ... }
      });
    }
    const entry = byYearGrade.get(key);
    const subjectKey = String(record.subject ?? "").trim().toUpperCase();
    if (!subjectKey) return;
    if (!entry.bySubject.has(subjectKey)) entry.bySubject.set(subjectKey, {});
    const termKey = String(record.term ?? "").trim();
    if (TERMS.includes(termKey)) {
      entry.bySubject.get(subjectKey)[termKey] = record;
    }
  });

  const rows = new Map();
  byYearGrade.forEach((entry, key) => {
    const subjects = {};
    const finals = [];
    entry.bySubject.forEach((termRecords, subjectKey) => {
      const termGrades = TERMS.map((term) =>
        termRecords[term]
          ? computeLearnerTermGrade(termRecords[term], learnerId, getSubjectWeightsFn)
          : null
      ).filter((g) => typeof g === "number" && !Number.isNaN(g));
      if (termGrades.length === 0) {
        subjects[subjectKey] = "—";
        return;
      }
      const final = average(termGrades);
      subjects[subjectKey] = final;
      finals.push(final);
    });

    rows.set(key, {
      schoolYear: entry.schoolYear,
      gradeLevel: entry.gradeLevel,
      subjects,
      generalAverage: average(finals),
      promotionStatus: "",
      source: "live",
    });
  });
  return rows;
}

// Builds one row per academicRecords doc matching this learner's LRN. Each
// learningAreas entry's LAST grade is treated as that subject's grade for
// the year (SF10 exports list one or more numeric columns per subject row;
// the rightmost is the subject's final/general-average grade for that year).
function buildImportedRows(lrn, academicRecordsList) {
  const mine = academicRecordsList.filter(
    (doc) => String(doc?.lrn ?? "").trim() === String(lrn ?? "").trim() && lrn
  );

  const rows = new Map();
  mine.forEach((doc) => {
    const key = yearGradeKey(doc.schoolYear, doc.gradeLevel);
    const subjects = {};
    (Array.isArray(doc.learningAreas) ? doc.learningAreas : []).forEach((area) => {
      const name = String(area?.name ?? "").trim().toUpperCase();
      const grades = Array.isArray(area?.grades) ? area.grades : [];
      if (!name || grades.length === 0) return;
      subjects[name] = grades[grades.length - 1];
    });
    const parsedAverage = Number(doc.generalAverage);
    rows.set(key, {
      schoolYear: String(doc.schoolYear ?? "").trim(),
      gradeLevel: formatGradeLevel(doc.gradeLevel),
      subjects,
      generalAverage: Number.isFinite(parsedAverage) ? parsedAverage : "—",
      promotionStatus: String(doc.promotionStatus ?? ""),
      source: "imported",
    });
  });
  return rows;
}

/**
 * Builds one learner's full multi-year academic history by merging live
 * classRecords (wins) with imported academicRecords (fills gaps).
 * @param {{learnerId: string, lrn: string}} learner
 * @param {Array} classRecordsList - full classRecords collection (or any superset)
 * @param {Array} academicRecordsList - full academicRecords collection (or any superset)
 * @param {(subjectName: string) => {ww:number,pt:number,ex:number}|null} getSubjectWeightsFn
 * @returns {Array} rows sorted ascending by schoolYear
 */
export function buildLearnerAcademicHistory(learner, classRecordsList, academicRecordsList, getSubjectWeightsFn) {
  const { learnerId, lrn } = learner || {};
  const liveRows = buildLiveRows(learnerId, classRecordsList || [], getSubjectWeightsFn);
  const importedRows = buildImportedRows(lrn, academicRecordsList || []);

  const merged = new Map(liveRows);
  importedRows.forEach((row, key) => {
    if (!merged.has(key)) merged.set(key, row);
  });

  return Array.from(merged.values()).sort((a, b) => a.schoolYear.localeCompare(b.schoolYear));
}
