// src/importers/sf10/normalizeSF10.js
// Normalizes a raw SF10 record into the internal academic-record model.

import {
  normalizeLrn,
  normalizeSex,
  normalizeDate,
  normalizeGrade,
  normalizeSchoolYear,
} from "../shared/normalization.js";

function text(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/** Canonical SF10 record shape. */
export function emptyRecord() {
  return {
    lrn: "",
    lastName: "",
    firstName: "",
    middleName: "",
    nameExtension: "",
    sex: "",
    birthDate: "",
    schoolId: "",
    schoolName: "",
    division: "",
    district: "",
    schoolYear: "",
    gradeLevel: "",
    section: "",
    learningAreas: [],
    generalAverage: "",
    promotionStatus: "",
    remarks: "",
  };
}

/**
 * Normalize a single raw SF10 record.
 * @param {Object} raw - output of parseSF10
 */
export function normalizeSF10Record(raw) {
  const rec = emptyRecord();
  rec.lrn = normalizeLrn(raw.lrn);
  rec.lastName = text(raw.lastName);
  rec.firstName = text(raw.firstName);
  rec.middleName = text(raw.middleName);
  rec.nameExtension = text(raw.nameExtension);
  rec.sex = normalizeSex(raw.sex);
  rec.birthDate = normalizeDate(raw.birthDate);

  rec.schoolId = text(raw.schoolId);
  rec.schoolName = text(raw.schoolName);
  rec.division = text(raw.division);
  rec.district = text(raw.district);
  rec.schoolYear = normalizeSchoolYear(raw.schoolYear);
  rec.gradeLevel = normalizeGrade(raw.gradeLevel);
  rec.section = text(raw.section);

  rec.learningAreas = Array.isArray(raw._learningAreas) ? raw._learningAreas : [];
  rec.generalAverage = text(raw._generalAverage);
  return rec;
}

/** Normalize all raw SF10 records. */
export function normalizeSF10(rawRecords) {
  return rawRecords.map(normalizeSF10Record);
}
