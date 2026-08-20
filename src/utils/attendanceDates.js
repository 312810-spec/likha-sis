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

// Derives the DepEd school year (June-May) that contains the given "YYYY-MM" month.
export function schoolYearFromMonth(monthValue) {
  if (!monthValue) return "";
  const year = Number(monthValue.slice(0, 4));
  const month = Number(monthValue.slice(5, 7));
  return month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}
