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
  // Kept for workbooks whose "(LRN)" suffix survived an older normalization
  // pass; normalizeHeaderKey now strips parenthetical qualifiers up front.
  "learnersreferencenumberlrn": "lrn",
  "learnerreferencenumberlrn": "lrn",
  "schoolid": "schoolId",

  // The official SF1 merges the three name columns under a single
  // "NAME (Last Name, First Name, Middle Name)" heading. When a workbook has no
  // sub-header row to split them, that column arrives as one packed string, so
  // it is mapped to its own field and exploded during normalization.
  "name": "fullName",
  "learnersname": "fullName",
  "nameoflearner": "fullName",
  "fullname": "fullName",

  "lastname": "lastName",
  "familyname": "lastName",
  "surname": "lastName",
  "firstname": "firstName",
  "givenname": "firstName",
  "middlename": "middleName",
  "middleinitial": "middleName",
  "nameextension": "nameExtension",
  "extensions": "nameExtension",
  "extension": "nameExtension",
  "ext": "nameExtension",
  // The SF10 spells it "NAME EXT. (Jr,I,II):" — the qualifier is stripped first.
  "nameext": "nameExtension",

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

  // The official SF1 splits ADDRESS across four sub-header columns rather than
  // one free-text cell, so each part is captured and recomposed later.
  "barangay": "barangay",
  "brgy": "barangay",
  "municipalitycity": "municipalityCity",
  "citymunicipality": "municipalityCity",
  "municipality": "municipalityCity",
  "province": "province",

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
  "relationship": "guardianRelationship",
  "guardianrelationship": "guardianRelationship",

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

/**
 * Reduce a header cell to a comparable key: lower-cased, punctuation-free, and
 * with parenthetical qualifiers removed.
 *
 * DepEd forms routinely qualify a column label in parentheses — "Sex (M/F)",
 * "Birth Date (mm/dd/yyyy)", "Age as of October 31", "IP (Ethnic Group)". Left
 * in place those qualifiers become part of the key ("sexmf", "birthdatemmddyyyy")
 * and no alias ever matches, which is why the official forms previously parsed
 * to nothing. Stripping them first lets one alias cover every qualified spelling.
 */
export function normalizeHeaderKey(text) {
  if (!text) return null;
  return String(text)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop "(m/f)", "(mm/dd/yyyy)", "(lrn)", …
    .replace(/[^a-z0-9]/g, "");
}

// Header labels whose canonical field can be recognized from a prefix when no
// exact alias matches. Ordered most-specific first.
const HEADER_PATTERNS = [
  [/^age/, "age"],
  [/^sex$|^sex[a-z]*$/, "sex"],
  [/^birth(date|day)/, "birthDate"],
  [/^dateofbirth/, "birthDate"],
  [/^lrn/, "lrn"],
  [/^learners?referencenumber/, "lrn"],
  // "House #/ Street/ Sitio/ Purok" — the sub-header wording varies by template.
  [/^house/, "houseStreetSitio"],
  // "Contact Number of Parent or Guardian"
  [/^contactn(o|umber)/, "contactNumber"],
];

/**
 * Map a raw header cell value to a canonical field key, or null if unknown.
 */
export function normalizeHeader(headerCell) {
  if (headerCell === null || headerCell === undefined) return null;
  const key = normalizeHeaderKey(headerCell);
  if (!key) return null;
  if (HEADER_ALIASES[key]) return HEADER_ALIASES[key];
  for (const [pattern, field] of HEADER_PATTERNS) {
    if (pattern.test(key)) return field;
  }
  return null;
}

// DepEd LIS exports write "no value" as a dash rather than leaving the cell
// blank ("CAL,JOHN PAUL, -"), so a lone dash must not become a middle name.
const NAME_PLACEHOLDER = /^[-–—.]+$/;

// Generational suffixes. The LIS packs these into the middle-name segment
// ("CUBERO,NOEL, JR. NARCISO"), so they are lifted back out into nameExtension.
const NAME_EXTENSION = /^(JR|SR|II|III|IV|V|VI)\.?$/i;

const cleanNamePart = (part) => {
  const t = String(part ?? "").trim();
  return NAME_PLACEHOLDER.test(t) ? "" : t;
};

/**
 * Split a packed name column into its parts.
 *
 * Two spellings occur in the wild and they must be told apart:
 *
 *   "Dela Cruz, Juan Santos"          — one comma: surname, then the rest split
 *                                       on whitespace (first word = first name).
 *   "ANTOLIJAO,ROEL ADRIAN, BERDIN"   — two commas, which is what the official
 *                                       LIS SF1 export produces: the segments
 *                                       are LAST, FIRST, MIDDLE and the first
 *                                       name may itself be several words.
 *
 * Splitting the second form on whitespace (as this used to) yields
 * firstName "ROEL" and middleName "ADRIAN, BERDIN", so the comma count decides.
 *
 * @returns {{lastName, firstName, middleName, nameExtension}|null} null when the
 *          value is not a packed name (no comma at all).
 */
export function splitFullName(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s.indexOf(",") === -1) return null;

  const segments = s.split(",");
  const lastName = cleanNamePart(segments[0]);
  if (!lastName) return null;

  let firstName;
  let middleRaw;

  if (segments.length >= 3) {
    // LAST, FIRST, MIDDLE — trailing empty segments are common ("X,Y,Z,").
    firstName = cleanNamePart(segments[1]);
    middleRaw = segments
      .slice(2)
      .map(cleanNamePart)
      .filter(Boolean)
      .join(" ");
  } else {
    const rest = cleanNamePart(segments[1]).split(/\s+/).filter(Boolean);
    firstName = rest[0] || "";
    middleRaw = rest.slice(1).join(" ");
  }

  // A generational suffix leads the middle-name segment when present.
  let nameExtension = "";
  const middleParts = middleRaw.split(/\s+/).filter(Boolean);
  if (middleParts.length > 0 && NAME_EXTENSION.test(middleParts[0])) {
    nameExtension = middleParts.shift();
  }

  return {
    lastName,
    firstName,
    middleName: middleParts.join(" "),
    nameExtension,
  };
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
 * Canonical "Grade N" form used by the `learners` collection.
 *
 * The rest of the app compares a learner's gradeLevel against the configured
 * gradeLevelsOffered (["Grade 7", "Grade 8", …] — see hooks/useSchoolConfig.js
 * and utils/keyStagesConfig.js), so an imported learner stored as a bare "7"
 * would silently drop out of the nutrition/SMEA rollups. The official SF1 header
 * cell is often truncated by the LIS export ("Grade 7 (Year"), which is why the
 * number is extracted and the label rebuilt rather than trusted verbatim.
 *
 * Note this is deliberately NOT applied to SF10: `academicRecords.gradeLevel` is
 * bare digits by contract (utils/sf10Records.js formats it on read, and the
 * document id `${lrn}_${schoolYear}_${gradeLevel}` depends on that form).
 */
export function canonicalGradeLevel(value) {
  const n = normalizeGrade(value);
  if (!n) return String(value ?? "").trim();
  return `Grade ${n}`;
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

