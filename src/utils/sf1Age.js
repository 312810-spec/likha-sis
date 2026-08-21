// src/utils/sf1Age.js
// The official DepEd SF1 age rule: a learner's age "AGE as of 1st Friday
// June" of the school year's starting calendar year -- never "as of today".
// The SF1 bulk importer already trusts the LIS-computed age as printed (see
// importers/sf1/normalizeSF1.js) since DepEd's own export applied this same
// rule; this helper exists so hand-entered/edited learners and the Live
// Register use the identical formula instead of a second, drifting one.

const SCHOOL_YEAR_PATTERN = /^(\d{4})-(\d{4})$/;

/** The starting calendar year of a "YYYY-YYYY" school year label, or null. */
export function schoolYearStartYear(schoolYear) {
  const match = SCHOOL_YEAR_PATTERN.exec(String(schoolYear || "").trim());
  return match ? Number(match[1]) : null;
}

/** The first Friday of June in the given calendar year, as a local Date. */
export function firstFridayOfJune(year) {
  const d = new Date(year, 5, 1); // June 1st
  const offsetToFriday = (5 - d.getDay() + 7) % 7; // Friday === 5
  d.setDate(d.getDate() + offsetToFriday);
  return d;
}

function parseBirthDate(birthDate) {
  if (birthDate instanceof Date) {
    return Number.isNaN(birthDate.getTime()) ? null : birthDate;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate || "").trim());
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Official SF1 age: the learner's age as of the first Friday of June of the
 * given school year's starting calendar year (e.g. "2026-2027" -> June 2026).
 * Returns "" when the birth date or school year can't be resolved, so a
 * blank/partial row never renders a misleading number.
 */
export function calculateSf1Age(birthDate, schoolYear) {
  const birth = parseBirthDate(birthDate);
  const startYear = schoolYearStartYear(schoolYear);
  if (!birth || !startYear) return "";

  const reference = firstFridayOfJune(startYear);
  let age = reference.getFullYear() - birth.getFullYear();
  const hasHadBirthdayByReference =
    reference.getMonth() > birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() && reference.getDate() >= birth.getDate());
  if (!hasHadBirthdayByReference) age--;

  return age >= 0 ? age : "";
}
