// src/utils/attendanceYearOverview.js
// Aggregates a class's per-month attendance docs (as saved by SF2) into a
// year-long trend: each learner's monthly attendance rate, their year
// average, and the class-wide average per month. Pure function -- SF2.jsx
// fetches the Firestore docs, this just does the math.

import { getWeekdays } from "./attendanceDates.js";

function learnerName(learner) {
  const last = learner.lastName || "";
  const first = learner.firstName || "";
  return [last, first].filter(Boolean).join(", ");
}

function monthlyRate(records, learnerId, weekdays) {
  if (weekdays.length === 0) return null;
  const dateMap = records?.[learnerId] || {};
  const absentDays = Object.values(dateMap).filter((v) => v === "A").length;
  const presentDays = weekdays.length - absentDays;
  return (presentDays / weekdays.length) * 100;
}

export default function buildAttendanceYearOverview({ monthDocs = [], learners = [] } = {}) {
  const sortedDocs = [...monthDocs].sort((a, b) => a.month.localeCompare(b.month));
  const months = sortedDocs.map((d) => d.month);

  const perLearner = learners.map((learner) => {
    const monthlyRates = {};
    sortedDocs.forEach((docData) => {
      const weekdays = getWeekdays(docData.month);
      monthlyRates[docData.month] = monthlyRate(docData.records, learner.id, weekdays);
    });
    const rateValues = Object.values(monthlyRates).filter((r) => r !== null);
    const yearAverage =
      rateValues.length > 0 ? rateValues.reduce((a, b) => a + b, 0) / rateValues.length : null;
    return {
      learnerId: learner.id,
      name: learnerName(learner),
      monthlyRates,
      yearAverage,
    };
  });

  const classAverage = {};
  months.forEach((month) => {
    const rates = perLearner
      .map((l) => l.monthlyRates[month])
      .filter((r) => r !== null && r !== undefined);
    classAverage[month] =
      rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  });

  return { months, perLearner, classAverage };
}
