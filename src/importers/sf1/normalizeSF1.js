// src/importers/sf1/normalizeSF1.js
// Normalizes raw SF1 rows into the internal LIKHA-SIS learner field model,
// attaching the workbook-derived context (grade, section, school year, school).

import {
  normalizeLrn,
  normalizeSex,
  normalizeDate,
  normalizeGrade,
  splitFullName,
} from "../shared/normalization.js";

/** The canonical learner field shape the rest of the app understands. */
export function emptyLearner() {
  return {
    lrn: "",
    lastName: "",
    firstName: "",
    middleName: "",
    nameExtension: "",
    sex: "",
    birthDate: "",
    age: "",
    religion: "",
    address: "",
    fathersName: "",
    mothersName: "",
    guardian: "",
    contactNumber: "",
    learningModality: "",
    remarks: "",
    // enrollment / context
    schoolId: "",
    schoolName: "",
    division: "",
    district: "",
    schoolYear: "",
    gradeLevel: "",
    section: "",
  };
}

function text(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/**
 * Normalize a single raw learner row into the internal model.
 * Raw rows may be missing columns entirely (raw[field] === undefined).
 * @param {Object} raw
 */
export function normalizeLearner(raw) {
  const ctx = raw._context || {};
  const learner = emptyLearner();

  learner.lrn = normalizeLrn(raw.lrn);
  learner.lastName = text(raw.lastName);
  learner.firstName = text(raw.firstName);
  learner.middleName = text(raw.middleName);

  // Forms that merge the name into a single "NAME (Last Name, First Name,
  // Middle Name)" column deliver it packed as "Dela Cruz, Juan Santos".
  if (!learner.lastName) {
    const parts = splitFullName(raw.fullName);
    if (parts) {
      learner.lastName = parts.lastName;
      learner.firstName = learner.firstName || parts.firstName;
      learner.middleName = learner.middleName || parts.middleName;
    }
  }

  learner.nameExtension = text(raw.nameExtension);
  learner.sex = normalizeSex(raw.sex);
  learner.birthDate = normalizeDate(raw.birthDate);
  learner.age = text(raw.age);
  learner.religion = text(raw.religion);
  learner.address = text(raw.address);
  learner.fathersName = text(raw.fathersName);
  learner.mothersName = text(raw.mothersName);
  learner.guardian = text(raw.guardian);
  learner.contactNumber = text(raw.contactNumber);
  learner.learningModality = text(raw.learningModality);
  learner.remarks = text(raw.remarks);

  // Context attached from the workbook (source of truth), not the filename.
  learner.schoolId = text(ctx.schoolId);
  learner.schoolName = text(ctx.schoolName);
  learner.division = text(ctx.division);
  learner.district = text(ctx.district);
  learner.schoolYear = text(ctx.schoolYear);
  learner.gradeLevel = text(ctx.gradeLevel);
  learner.section = text(ctx.section);

  learner._rowIndex = raw._rowIndex;
  return learner;
}

/** Normalize all raw rows. Returns { learners, dropped }. */
export function normalizeSF1(rawLearners) {
  const learners = rawLearners.map(normalizeLearner);
  return { learners };
}

export { normalizeGrade };
