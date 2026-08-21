// scripts/external-calendar/lib/schoolYear.mjs
// Standalone school-year computation for the sync scripts. These run outside
// the app (GitHub Actions, no Firestore-backed academicCalendar available
// until after they've authenticated), so this mirrors the DepEd convention
// used by src/academicCalendar.js -- school year opens in June -- without
// importing frontend code into a Node-only tool.

/** "2026-2027" for any date from June of a year through May of the next. */
export function activeSchoolYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  return month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}
