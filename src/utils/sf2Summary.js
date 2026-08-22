// src/utils/sf2Summary.js
// Pure attendance math shared by SF2's Daily Attendance totals, the Monthly
// SF2 official summary (screen + print), and the LARDO auto-flag check.
// Firestore-free so it's directly unit-testable.
//
// Storage semantics (unchanged): records is learnerId -> { "YYYY-MM-DD": "A"
// | "T" }. A date with no entry for a learner means Present. Tardy is NOT
// counted as Absent anywhere in this file -- see CLAUDE.md's grading/
// attendance conventions and DECISIONS.md for why that rule is fixed.

/** Cycles one learner+date mark: "" (Present) -> "A" (Absent) -> "T" (Tardy)
 * -> "" -- the single source of truth for both Daily Attendance's
 * Present/Absent/Tardy buttons and the Monthly SF2 grid's clickable cells. */
export function cycleAttendanceValue(current) {
  if (current === "") return "A";
  if (current === "A") return "T";
  return "";
}

/** One learner's monthly counts: absent/tardy days actually marked, and
 * present = applicable school days - absent days (tardy still counts as
 * present for the day-count formula). */
export function monthlyLearnerCounts(records, learnerId, weekdays) {
  const dateMap = (records && records[learnerId]) || {};
  const absent = Object.values(dateMap).filter((v) => v === "A").length;
  const tardy = Object.values(dateMap).filter((v) => v === "T").length;
  const present = Math.max(weekdays.length - absent, 0);
  return { absent, tardy, present };
}

/** Sums monthlyLearnerCounts across a group of learners (e.g. all Male). */
export function monthlyGroupTotals(learnerIds, records, weekdays) {
  return learnerIds.reduce(
    (totals, id) => {
      const c = monthlyLearnerCounts(records, id, weekdays);
      return {
        absent: totals.absent + c.absent,
        tardy: totals.tardy + c.tardy,
        present: totals.present + c.present,
      };
    },
    { absent: 0, tardy: 0, present: 0 }
  );
}

/** Count of learners in a group whose mark on one date equals `code`
 * ("A" or "T"); a blank/missing mark is Present, so it never matches here. */
export function groupCountOnDate(learnerIds, records, dateString, code) {
  return learnerIds.reduce(
    (sum, id) => sum + ((records && records[id]?.[dateString]) === code ? 1 : 0),
    0
  );
}

/** Present/Absent/Tardy counts for a group on one date -- the Daily
 * Attendance bottom totals table (Male / Female / Combined rows). */
export function groupDailyTotals(learnerIds, records, dateString) {
  const absent = groupCountOnDate(learnerIds, records, dateString, "A");
  const tardy = groupCountOnDate(learnerIds, records, dateString, "T");
  const present = Math.max(learnerIds.length - absent, 0);
  return { present, absent, tardy, total: learnerIds.length };
}

/** Count of learners with 5+ consecutive Absent-marked school days this
 * month -- the official Summary field backing SF2_GUIDELINES_TEXT's
 * intervention note (#5). "Consecutive" means consecutive entries in
 * `weekdays` (actual school days), not consecutive calendar dates, since a
 * weekend or holiday doesn't break a streak. */
export function countAbsentFiveConsecutiveDays(learnerIds, records, weekdays) {
  return learnerIds.reduce((count, id) => {
    const dateMap = (records && records[id]) || {};
    let streak = 0;
    let reachedFive = false;
    for (const w of weekdays) {
      if (dateMap[w.dateString] === "A") {
        streak += 1;
        if (streak >= 5) reachedFive = true;
      } else {
        streak = 0;
      }
    }
    return count + (reachedFive ? 1 : 0);
  }, 0);
}

/** Count of learners whose Remarks this month record a "Dropped Out" status
 * (see dropoutLabel() in sf2Layout.js for the stored string format). */
export function countDroppedOut(learnerIds, remarksData = {}) {
  return learnerIds.reduce(
    (sum, id) =>
      sum + (typeof remarksData[id] === "string" && remarksData[id].startsWith("Dropped Out") ? 1 : 0),
    0
  );
}

/**
 * Auto-calculated Monthly SF2 summary values (CLAUDE.md-aligned: never make
 * a teacher type a number LIKHA-SIS already knows). `enrolmentFirstFriday`
 * is the one remaining MANUAL figure -- see SF2's summaryInputs.
 */
export function computeMonthlySummary({
  maleLearnerIds = [],
  femaleLearnerIds = [],
  weekdays = [],
  records = {},
  remarksData = {},
  enrolmentFirstFriday = 0,
}) {
  const allIds = [...maleLearnerIds, ...femaleLearnerIds];
  const registeredLearners = allIds.length;
  const numberSchoolDays = weekdays.length;

  const totalDailyAttendance = weekdays.reduce((sum, w) => {
    const absentOnDate = groupCountOnDate(allIds, records, w.dateString, "A");
    return sum + Math.max(registeredLearners - absentOnDate, 0);
  }, 0);
  const averageDailyAttendance = numberSchoolDays > 0 ? totalDailyAttendance / numberSchoolDays : 0;

  const enrolment = Number(enrolmentFirstFriday) || 0;
  const pctEnrolment = enrolment > 0 ? (registeredLearners / enrolment) * 100 : null;
  const pctAttendance = registeredLearners > 0 ? (averageDailyAttendance / registeredLearners) * 100 : null;

  const maleTotals = monthlyGroupTotals(maleLearnerIds, records, weekdays);
  const femaleTotals = monthlyGroupTotals(femaleLearnerIds, records, weekdays);
  const monthlyAbsentTotal = maleTotals.absent + femaleTotals.absent;
  const monthlyPresentTotal = maleTotals.present + femaleTotals.present;
  const monthlyTardyTotal = maleTotals.tardy + femaleTotals.tardy;
  const absentFiveConsecutiveDays = countAbsentFiveConsecutiveDays(allIds, records, weekdays);
  const droppedOut = countDroppedOut(allIds, remarksData);

  return {
    registeredLearners,
    numberSchoolDays,
    totalDailyAttendance,
    averageDailyAttendance,
    pctEnrolment,
    pctAttendance,
    monthlyAbsentTotal,
    monthlyPresentTotal,
    monthlyTardyTotal,
    absentFiveConsecutiveDays,
    droppedOut,
  };
}
