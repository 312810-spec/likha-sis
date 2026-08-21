// src/utils/attendanceDates.js
// Shared by SF2 (attendance sheet entry) and the LARDO auto-resolve check,
// which both need to know a month's weekdays and the attendance document id
// for a given class + month.

export function getWeekdays(monthValue) {
  if (!monthValue) return [];
  const year = Number(monthValue.slice(0, 4));
  const month = Number(monthValue.slice(5, 7));
  const daysInMonth = new Date(year, month, 0).getDate();
  const labels = ["M", "T", "W", "TH", "F"]; // index by getDay()-1 (Mon=1..Fri=5)
  const result = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // weekend
    result.push({
      day,
      label: labels[dow - 1],
      dateString: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  return result;
}

// Builds the Firestore document id for an attendance sheet, e.g. classValue
// "Grade 10 - Kindness" + monthValue "2026-08" → "Grade_10_Kindness_2026-08".
// Spaces in grade level / section are replaced with underscores.
export function makeAttendanceDocId(classValue, monthValue) {
  if (!classValue) return "";
  const [gradeLevel = "", section = ""] = classValue.split(" - ");
  return `${gradeLevel.replace(/ /g, "_")}_${section.replace(/ /g, "_")}_${monthValue}`;
}

/** Today's date as a "YYYY-MM-DD" string, in local time. */
export function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function toDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Steps a "YYYY-MM-DD" date one school day forward (direction=1) or
 * backward (direction=-1), skipping Saturdays/Sundays -- so SF2's Daily
 * Attendance Previous/Next Day controls never land on a weekend, matching
 * getWeekdays()'s existing weekend exclusion.
 */
export function shiftSchoolDay(dateString, direction) {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  do {
    date.setDate(date.getDate() + direction);
  } while (date.getDay() === 0 || date.getDay() === 6);
  return toDateString(date);
}

// Derives the DepEd school year (June-May) that contains the given "YYYY-MM" month.
export function schoolYearFromMonth(monthValue) {
  if (!monthValue) return "";
  const year = Number(monthValue.slice(0, 4));
  const month = Number(monthValue.slice(5, 7));
  return month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// Tallies present/absent/tardy for one date from an attendance doc's
// `records` map (learnerId -> { "YYYY-MM-DD": "A" | "T" }, blank/missing =
// present -- see SF2.jsx). Shared by the Dashboard's adviser/principal/SMEA
// attendance widgets so "today's attendance" is computed the same way
// everywhere, and by SF2's Daily Attendance totals.
export function summarizeAttendanceForDate(records, dateString) {
  const ids = Object.keys(records || {});
  const total = ids.length;
  const absent = ids.filter((id) => records[id]?.[dateString] === "A").length;
  const tardy = ids.filter((id) => records[id]?.[dateString] === "T").length;
  return { total, absent, tardy, present: Math.max(total - absent, 0) };
}
