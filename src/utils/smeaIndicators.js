// src/utils/smeaIndicators.js
// Aggregates already-complete domains (Attendance, Nutrition, LARDO) into
// per-grade indicator rows for the SMEA Enrollment Report, per the "Other
// SMEA indicators" architecture in the project spec (SMEA aggregates
// existing domains rather than duplicating them). Academic performance
// (MPS/passing rate) is intentionally out of scope for this pass.

import { getWeekdays, schoolYearFromMonth } from "./attendanceDates.js";

const BMI_CATEGORIES = {
  "Severely Wasted": "severelyWasted",
  "Wasted": "wasted",
  "Normal": "normal",
  "Overweight": "overweight",
  "Obese": "obese",
};

function sortGrades(grades, gradeLevelsOffered) {
  return [...grades].sort((a, b) => {
    if (gradeLevelsOffered.length === 0) return a.localeCompare(b);
    const ia = gradeLevelsOffered.indexOf(a);
    const ib = gradeLevelsOffered.indexOf(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function attendanceRatesByGrade(attendanceDocs, selectedSY) {
  const ratesByGrade = {};
  attendanceDocs
    .filter((d) => schoolYearFromMonth(d.month) === selectedSY)
    .forEach((d) => {
      const grade = (d.gradeLevel || "").trim();
      if (!grade) return;
      const weekdays = getWeekdays(d.month);
      if (weekdays.length === 0) return;
      // Every enrolled learner in this class doc contributes a rate, whether
      // or not they have any "A"/"T" exceptions recorded. We only know who
      // was enrolled via the `records` keys plus zero-absence learners are
      // invisible in this doc shape, so this rate is per-learner-with-data:
      // learners with zero exceptions simply don't appear in `records` and
      // are not counted here. This under-counts perfect attendance learners,
      // which is a known v1 approximation documented in the SMEA design.
      Object.entries(d.records || {}).forEach(([, dateMap]) => {
        const absentDays = Object.values(dateMap).filter((v) => v === "A").length;
        const rate = ((weekdays.length - absentDays) / weekdays.length) * 100;
        if (!ratesByGrade[grade]) ratesByGrade[grade] = [];
        ratesByGrade[grade].push(rate);
      });
    });
  const result = {};
  Object.entries(ratesByGrade).forEach(([grade, rates]) => {
    result[grade] = rates.reduce((a, b) => a + b, 0) / rates.length;
  });
  return result;
}

function nutritionByGrade(nutritionRecords, selectedSY, nutritionPeriod) {
  const byGrade = {};
  nutritionRecords
    .filter((r) => (r.schoolYear || "") === selectedSY && (r.period || "") === nutritionPeriod)
    .forEach((r) => {
      const grade = (r.gradeLevel || "").trim();
      if (!grade) return;
      if (!byGrade[grade]) byGrade[grade] = { weighedCount: 0, counts: {} };
      byGrade[grade].weighedCount += 1;
      const catKey = BMI_CATEGORIES[r.nutritionalStatus];
      if (catKey) {
        byGrade[grade].counts[catKey] = (byGrade[grade].counts[catKey] || 0) + 1;
      }
    });

  const result = {};
  Object.entries(byGrade).forEach(([grade, { weighedCount, counts }]) => {
    const pct = {};
    Object.values(BMI_CATEGORIES).forEach((key) => {
      pct[`${key}Pct`] = weighedCount > 0 ? ((counts[key] || 0) / weighedCount) * 100 : null;
    });
    result[grade] = { weighedCount, ...pct };
  });
  return result;
}

function lardoMonitoringByGrade(lardoRecords, selectedSY) {
  const counts = {};
  lardoRecords
    .filter((r) => (r.schoolYear || "") === selectedSY && r.status === "monitoring")
    .forEach((r) => {
      const grade = (r.gradeLevel || "").trim();
      if (!grade) return;
      counts[grade] = (counts[grade] || 0) + 1;
    });
  return counts;
}

export default function computeSMEAIndicators({
  attendanceDocs = [],
  nutritionRecords = [],
  lardoRecords = [],
  selectedSY = "",
  gradeLevelsOffered = [],
  nutritionPeriod = "Baseline",
} = {}) {
  const attendance = attendanceRatesByGrade(attendanceDocs, selectedSY);
  const nutrition = nutritionByGrade(nutritionRecords, selectedSY, nutritionPeriod);
  const lardo = lardoMonitoringByGrade(lardoRecords, selectedSY);

  const grades = sortGrades(
    Array.from(new Set([...Object.keys(attendance), ...Object.keys(nutrition), ...Object.keys(lardo)])),
    gradeLevelsOffered
  );

  const rows = grades.map((grade) => ({
    grade,
    attendanceRate: attendance[grade] ?? null,
    nutrition: nutrition[grade] || { weighedCount: 0 },
    lardoMonitoringCount: lardo[grade] || 0,
  }));

  return { rows };
}
