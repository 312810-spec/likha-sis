// src/importers/shared/normalization.js
// Shared normalization helpers used by both the SF1 and SF10 importers.
// These map the many ways DepEd spreadsheets spell the same thing onto the
// internal LIKHA-SIS field names, so downstream code never sees raw variants.

// ---------------------------------------------------------------------------
// Header normalization
// ---------------------------------------------------------------------------
const HEADER_ALIASES = {
  lrn: "lrn",
  "learnerreference": "lrn",
  "learnerreferencenumber": "lrn",
  "learnersreferencenumber": "lrn",
  "learner'sreferencenumber": "lrn",
  "learnersreference": "lrn",
  "learningreference": "lrn",
  "lrnnumber": "lrn",
  "lrnno": "lrn",
  // The official header reads "Learner's Reference Number (LRN)" — the "(LRN)"
  // suffix (stripped to "lrn") is appended to the key, so cover those variants.
  "learnersreferencenumberlrn": "lrn",
  "learnerreferencenumberlrn": "lrn",
  "schoolid": "schoolId",

  "lastname": "lastName",
  "familyname": "lastName",
  "surname": "lastName",
  "firstname": "firstName",
  "givenname": "firstName",
  "middlename": "middleName",
  "middleinitial": "middleName",
  "nameextension": "nameExtension",
  "extensions": "nameExtension",
  "ext": "nameExtension",

  "sex": "sex",
  "gender": "sex",

  "birthdate": "birthDate",
  "dateofbirth": "birthDate",
  "birthday": "birthDate",
  "dob": "birthDate",
  "age": "age",

  "religion": "religion",
  "address": "address",
  "homeaddress": "address",
  "residentialaddress": "address",
  "householdaddress": "address",

  "fathersname": "fathersName",
  "fathername": "fathersName",
  "nameoffather": "fathersName",
  "mothersmaidenname": "mothersName",
  "mothersname": "mothersName",
  "mothername": "mothersName",
  "nameofmother": "mothersName",
  "guardian": "guardian",
  "guardianname": "guardian",
  "nameofguardian": "guardian",

  "contactnumber": "contactNumber",
  "contactno": "contactNumber",
  "contact": "contactNumber",
  "mobilenumber": "contactNumber",
  "phonenumber": "contactNumber",
  "telephone": "contactNumber",
  "celno": "contactNumber",

  "learningmodality": "learningModality",
  "modality": "learningModality",
  "modalityoflearning": "learningModality",
  "remarks": "remarks",
  "remark": "remarks",
};

export function normalizeHeaderKey(text) {
  if (!text) return null;
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
}
/**
 * Map a raw header cell value to a canonical field key, or null if unknown.
 */
export function normalizeHeader(headerCell) {
  if (headerCell === null || headerCell === undefined) return null;
  const key = normalizeHeaderKey(headerCell);
  if (!key) return null;
  return HEADER_ALIASES[key] || null;
}

// ---------------------------------------------------------------------------
// Value normalization
// ---------------------------------------------------------------------------

/** Keep only the digits of a string. Used for LRN and contact numbers. */
export function digitsOnly(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\D/g, "");
}

/**
 * Normalize an LRN to a plain digit string. Returns "" when empty.
 * Does NOT enforce a fixed length here — validation decides what is valid.
 */
export function normalizeLrn(value) {
  if (value === null || value === undefined) return "";
  return digitsOnly(value);
}

/** Normalize sex to "Male" | "Female" | "" (mirrors SMEA logic). */
export function normalizeSex(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (/^m/i.test(s)) return "Male";
  if (/^f/i.test(s)) return "Female";
  return "";
}

/** Extract the numeric grade level ("Grade 10" -> "10"). Returns "" when none. */
export function normalizeGrade(value) {
  if (value === null || value === undefined) return "";
  const g = String(value).trim();
  const m = g.match(/\d+/);
  return m ? m[0] : "";
}

/**
 * Normalize a birth date into YYYY-MM-DD.
 * Handles Date objects, Excel serial numbers, and common string formats.
 * Returns "" when it cannot be confidently parsed.
 */
export function normalizeDate(value) {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return toISO(value);
  }

  // Excel serial number.
  if (typeof value === "number" && Number.isFinite(value)) {
    const whole = Math.floor(value);
    if (whole < 1 || whole > 80000) return "";
    const date = excelSerialToDate(whole);
    if (!date) return "";
    return toISO(date);
  }

  const s = String(value).trim();
  if (!s) return "";

  // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (validYMD(y, mo, d)) return pad(y, mo, d);
    return "";
  }

  // Named month: "Jan 5, 2010" or "January 5, 2010"
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})/);
  if (m) {
    const mo = monthNameToNumber(m[1]);
    const d = +m[2], y = +m[3];
    if (mo && validYMD(y, mo, d)) return pad(y, mo, d);
    return "";
  }

  // MM/DD/YYYY or DD/MM/YYYY (best guess, month-first).
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3];
    if (y < 100) y += y > 40 ? 1900 : 2000;
    if (validYMD(y, a, b)) return pad(y, a, b);
    if (validYMD(y, b, a)) return pad(y, b, a);
    return "";
  }

  return "";
}

// Date utility internals -----------------------------------------------------

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
  october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function monthNameToNumber(name) {
  const low = String(name).toLowerCase();
  return MONTHS[low.slice(0, 3)] || MONTHS[low] || null;
}

function excelSerialToDate(serial) {
  // Excel epoch day 0 = 1899-12-30 (the corrected origin).
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function validYMD(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function pad(y, mo, d) {
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Normalize a school year string like "SY 2026-2027" -> "2026-2027". */
export function normalizeSchoolYear(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  const m = s.match(/(\d{4})\s*[-–/]\s*(\d{2,4})/);
  if (m) {
    const end = m[2].length === 2 ? `20${m[2]}` : m[2];
    return `${m[1]}-${end}`;
  }
  const m2 = s.match(/(\d{4})/);
  return m2 ? m2[1] : "";
}

