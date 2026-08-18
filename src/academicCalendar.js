// src/academicCalendar.js
// Centralized academic calendar configuration.
//
// The object below is the BUILT-IN FALLBACK only. Schools edit their real
// calendar from School Settings > Academic Calendar, which persists to
// settings/schoolConfig.academicCalendar; `mergeAcademicCalendar` layers that
// stored calendar over this default, and `useAcademicCalendar()` is what
// components should read. Keeping the fallback here means a school that has
// never opened the tab (or a Firestore read that fails) still gets a usable
// SY 2026-2027.
//
// DO 15, s. 2026 mandates a 3-Term system (Term 1 / Term 2 / Term 3). Legacy
// Q1-Q4 quarters are obsolete, so every helper here assumes exactly 3 terms.

export const TERM_LABELS = ["Term 1", "Term 2", "Term 3"];
export const TERM_IDS = ["term-1", "term-2", "term-3"];
const SCHOOL_YEAR_PATTERN = /^\d{4}-\d{4}$/;

export const academicCalendar = {
  "2026-2027": {
    schoolYearLabel: "2026-2027",
    terms: [
      {
        id: "term-1",
        label: "Term 1",
        startDate: "2026-06-08",
        endDate: "2026-09-15"
      },
      {
        id: "term-2",
        label: "Term 2",
        startDate: "2026-09-16",
        endDate: "2026-12-18"
      },
      {
        id: "term-3",
        label: "Term 3",
        startDate: "2027-01-04",
        endDate: "2027-04-08"
      }
    ]
  }
};

// Helper: parse a YYYY-MM-DD string into a Date at local midnight
function parseISODate(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isFilledDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** A blank 3-term school year for the school to fill in. */
export function makeEmptySchoolYear(schoolYearLabel) {
  return {
    schoolYearLabel,
    terms: TERM_IDS.map((id, i) => ({
      id,
      label: TERM_LABELS[i],
      startDate: "",
      endDate: "",
    })),
  };
}

function isUsableSchoolYear(entry) {
  return Boolean(entry) && Array.isArray(entry.terms) && entry.terms.length > 0;
}

/**
 * Layers a stored calendar ({ schoolYears: { "2026-2027": {...} } }) over the
 * built-in fallback. Malformed stored entries are skipped rather than thrown,
 * so a half-written Firestore doc can't break SF4 or SMEA Enrollment.
 */
export function mergeAcademicCalendar(stored, fallback = academicCalendar) {
  const merged = JSON.parse(JSON.stringify(fallback));
  const storedYears = stored?.schoolYears;
  if (!storedYears || typeof storedYears !== "object") return merged;

  for (const [label, entry] of Object.entries(storedYears)) {
    if (!isUsableSchoolYear(entry)) continue;
    merged[label] = {
      schoolYearLabel: entry.schoolYearLabel || label,
      terms: entry.terms.map((term, i) => ({
        id: term.id || TERM_IDS[i] || `term-${i + 1}`,
        label: term.label || TERM_LABELS[i] || `Term ${i + 1}`,
        startDate: term.startDate || "",
        endDate: term.endDate || "",
      })),
    };
  }
  return merged;
}

/** School year labels, newest first. */
export function listSchoolYears(calendar) {
  if (!calendar || typeof calendar !== "object") return [];
  return Object.keys(calendar).sort((a, b) => b.localeCompare(a));
}

/**
 * Validates a whole calendar before it is saved.
 * Returns "" when valid, or a user-facing error message naming the offender.
 */
export function validateAcademicCalendar(calendar) {
  const labels = listSchoolYears(calendar);
  if (labels.length === 0) return "Add at least one school year.";

  for (const label of labels) {
    if (!SCHOOL_YEAR_PATTERN.test(label)) {
      return `"${label}" is not a valid school year. Use the YYYY-YYYY format, e.g. 2026-2027.`;
    }

    const terms = calendar[label]?.terms;
    if (!Array.isArray(terms) || terms.length !== TERM_LABELS.length) {
      return `School year ${label} must have exactly three terms (DO 15, s. 2026).`;
    }

    for (let i = 0; i < terms.length; i += 1) {
      const term = terms[i];
      const name = term.label || TERM_LABELS[i];
      if (!isFilledDate(term.startDate) || !isFilledDate(term.endDate)) {
        return `${label} — ${name} needs both a start and an end date.`;
      }
      if (parseISODate(term.startDate) > parseISODate(term.endDate)) {
        return `${label} — ${name} ends before it starts.`;
      }
      if (i > 0) {
        const previous = terms[i - 1];
        if (isFilledDate(previous.endDate) && parseISODate(term.startDate) <= parseISODate(previous.endDate)) {
          return `${label} — ${name} starts on or before ${previous.label || TERM_LABELS[i - 1]} ends.`;
        }
      }
    }
  }
  return "";
}

/**
 * Returns the term object for the given schoolYear (e.g. "2026-2027") that contains
 * the provided date (Date or date-string). Returns null when no matching term is found.
 *
 * Pass `calendar` to resolve against a school-edited calendar (see
 * useAcademicCalendar); it defaults to the built-in fallback.
 *
 * Example return value:
 * { id: "term-1", label: "Term 1", startDate: "2026-06-08", endDate: "2026-09-15" }
 */
export function getCurrentTermForSchoolYear(schoolYear, date = new Date(), calendar = academicCalendar) {
  const cal = calendar?.[schoolYear];
  if (!cal || !Array.isArray(cal.terms)) return null;

  const targetDate = (date instanceof Date) ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : parseISODate(String(date));

  for (const term of cal.terms) {
    if (!isFilledDate(term.startDate) || !isFilledDate(term.endDate)) continue;
    const start = parseISODate(term.startDate);
    const end = parseISODate(term.endDate);
    if (targetDate >= start && targetDate <= end) return term;
  }
  return null;
}

export default academicCalendar;
