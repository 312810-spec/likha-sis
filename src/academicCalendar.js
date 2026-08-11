// src/academicCalendar.js
// Centralized academic calendar configuration (extendable per school year)

const academicCalendar = {
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

/**
 * Returns the term object for the given schoolYear (e.g. "2026-2027") that contains
 * the provided date (Date or date-string). Returns null when no matching term is found.
 *
 * Example return value:
 * { id: "term-1", label: "Term 1", startDate: "2026-06-08", endDate: "2026-09-15" }
 */
export function getCurrentTermForSchoolYear(schoolYear, date = new Date()) {
  const cal = academicCalendar[schoolYear];
  if (!cal || !Array.isArray(cal.terms)) return null;

  const targetDate = (date instanceof Date) ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : parseISODate(String(date));

  for (const term of cal.terms) {
    const start = parseISODate(term.startDate);
    const end = parseISODate(term.endDate);
    if (targetDate >= start && targetDate <= end) return term;
  }
  return null;
}

export default academicCalendar;
