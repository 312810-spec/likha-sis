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
    motherTongue: "",
    ipEthnicGroup: "",
    religion: "",
    address: "",
    // The official SF1 splits the address into four sub-header columns; they are
    // kept individually (the learner document has matching legacy fields) and
    // also recomposed into `address`.
    houseStreetSitio: "",
    barangay: "",
    municipalityCity: "",
    province: "",
    fathersName: "",
    mothersName: "",
    guardian: "",
    guardianRelationship: "",
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

  learner.nameExtension = text(raw.nameExtension);

  // Forms that merge the name into a single "NAME (Last Name, First Name,
  // Middle Name)" column deliver it packed — "Dela Cruz, Juan Santos" on older
  // templates, "ANTOLIJAO,ROEL ADRIAN, BERDIN" on the official LIS export.
  if (!learner.lastName) {
    const parts = splitFullName(raw.fullName);
    if (parts) {
      learner.lastName = parts.lastName;
      learner.firstName = learner.firstName || parts.firstName;
      learner.middleName = learner.middleName || parts.middleName;
      learner.nameExtension = learner.nameExtension || parts.nameExtension;
    }
  }

  learner.sex = normalizeSex(raw.sex);
  learner.birthDate = normalizeDate(raw.birthDate);
  learner.age = text(raw.age);
  learner.motherTongue = text(raw.motherTongue);
  learner.ipEthnicGroup = text(raw.ipEthnicGroup);
  learner.religion = text(raw.religion);

  learner.houseStreetSitio = text(raw.houseStreetSitio);
  learner.barangay = text(raw.barangay);
  learner.municipalityCity = text(raw.municipalityCity);
  learner.province = text(raw.province);
  // A single free-text ADDRESS column wins when the form has one; otherwise the
  // address is rebuilt from the split columns so the learner still has one.
  learner.address =
    text(raw.address) ||
    [
      learner.houseStreetSitio,
      learner.barangay,
      learner.municipalityCity,
      learner.province,
    ]
      .filter(Boolean)
      .join(", ");

  learner.fathersName = text(raw.fathersName || raw.fatherName);
  learner.mothersName = text(raw.mothersName || raw.mothersMaidenName || raw.motherName);
  learner.guardian = text(raw.guardian || raw.guardianName);
  learner.guardianRelationship = text(raw.guardianRelationship);
  learner.contactNumber = text(raw.contactNumber || raw.contactNo || raw.contact);
  learner.learningModality = text(raw.learningModality);
  learner.remarks = text(raw.remarks || raw.remark);

  // Context attached from the workbook (source of truth), not the filename.
  learner.schoolId = text(ctx.schoolId);
  learner.schoolName = text(ctx.schoolName);
  learner.division = text(ctx.division);
  learner.district = text(ctx.district);
  learner.schoolYear = text(ctx.schoolYear);
  learner.gradeLevel = text(ctx.gradeLevel);
  learner.section = text(ctx.section);
  // Ensure backward compatibility: if gradeLevel is empty but raw has a grade field
  if (!learner.gradeLevel && raw.gradeLevel) {
    learner.gradeLevel = text(raw.gradeLevel);
  }

  learner._rowIndex = raw._rowIndex;
  return learner;
}

/** Normalize all raw rows. Returns { learners, dropped }. */
export function normalizeSF1(rawLearners) {
  const learners = rawLearners.map(normalizeLearner);
  return { learners };
}

export { normalizeGrade };
