// src/importers/sf1/normalizeSF1.js
// Normalizes raw SF1 rows into the internal LIKHA-SIS learner field model,
// attaching the workbook-derived context (grade, section, school year, school).

import {
  normalizeLrn,
  normalizeSex,
  normalizeDate,
  normalizeGrade,
  splitFullName,
  digitsOnly,
} from "../shared/normalization.js";
import { parsePersonName, formatPersonName } from "../shared/nameParser.js";

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
    // Address, broken down the way SF1 records it.
    houseStreetSitio: "",
    barangay: "",
    municipalityCity: "",
    province: "",
    address: "",
    // Parents / guardian
    fathersName: "",
    mothersMaidenName: "",
    guardianName: "",
    guardianRelationship: "",
    contactNumber: "",
    learningModality: "",
    remarks: "",
    // enrollment / context
    schoolId: "",
    schoolName: "",
    region: "",
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

/** Age cells arrive as "12 " or 12; keep a clean integer string, else "". */
function normalizeAge(value) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return "";
  return String(n);
}

/** Join the SF1 address parts into the single-line form the app displays. */
function joinAddress(parts) {
  return parts.map(text).filter(Boolean).join(", ");
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
  // Trust the workbook's printed age (it is "as of the 1st Friday of June",
  // which cannot be recomputed from the birth date alone).
  learner.age = normalizeAge(raw.age);
  learner.motherTongue = text(raw.motherTongue);
  learner.ipEthnicGroup = text(raw.ipEthnicGroup);
  learner.religion = text(raw.religion);

  learner.houseStreetSitio = text(raw.houseStreetSitio);
  learner.barangay = text(raw.barangay);
  learner.municipalityCity = text(raw.municipalityCity);
  learner.province = text(raw.province);
  // Prefer an explicit single "Address" column when the sheet has one.
  learner.address =
    text(raw.address) ||
    joinAddress([
      learner.houseStreetSitio,
      learner.barangay,
      learner.municipalityCity,
      learner.province,
    ]);

  // Parent/guardian names keep their printed form (that is what SF1 shows) but
  // are also parsed so the app can sort or match on the surname.
  learner.fathersName = text(raw.fathersName);
  learner.mothersMaidenName = text(raw.mothersMaidenName) || text(raw.mothersName);
  learner.guardianName = text(raw.guardianName) || text(raw.guardian);
  learner.guardianRelationship = text(raw.guardianRelationship);
  learner.fathersNameParts = parsePersonName(learner.fathersName);
  learner.mothersNameParts = parsePersonName(learner.mothersMaidenName);

  learner.contactNumber = text(raw.contactNumber);
  learner.learningModality = text(raw.learningModality);
  learner.remarks = text(raw.remarks || raw.remark);

  // Context attached from the workbook (source of truth), not the filename.
  learner.schoolId = text(ctx.schoolId);
  learner.schoolName = text(ctx.schoolName);
  learner.region = text(ctx.region);
  learner.division = text(ctx.division);
  learner.district = text(ctx.district);
  learner.schoolYear = text(ctx.schoolYear);
  learner.gradeLevel = text(ctx.gradeLevel);
  learner.section = text(ctx.section);
  // Ensure backward compatibility: if gradeLevel is empty but raw has a grade field
  if (!learner.gradeLevel && raw.gradeLevel) {
    learner.gradeLevel = text(raw.gradeLevel);
  }

  // The name exactly as SF1 prints it, for the register view.
  learner.displayName = formatPersonName(learner);

  learner._rowIndex = raw._rowIndex;
  return learner;
}

/** Normalize all raw rows. Returns { learners }. */
export function normalizeSF1(rawLearners) {
  const learners = rawLearners.map(normalizeLearner);
  return { learners };
}

export { normalizeGrade };
