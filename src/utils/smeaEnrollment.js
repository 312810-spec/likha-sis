// src/utils/smeaEnrollment.js
// Business logic and data aggregation for SMEA 3-Term Enrollment Monitoring.
// Derived strictly from Firestore "learners" (SF1 records).

import { normalizeSex, normalizeGrade } from "../importers/shared/normalization.js";
import { getCurrentTermForSchoolYear, academicCalendar } from "../academicCalendar.js";

/**
 * Parses numeric part from grade string or returns 0.
 */
export function parseGradeNumber(grade) {
  const normalized = normalizeGrade(grade);
  return parseInt(normalized || "0", 10);
}

/**
 * Computes enrollment counts, 3-term indicators, and data discrepancy reports from learner records.
 *
 * @param {Array} allLearners - Array of learner records from SF1 / Firestore.
 * @param {string} selectedSY - Selected school year (e.g., "2026-2027").
 * @param {Object} [calendarConfig] - Optional calendar config object or fallback.
 * @param {Date|string} [asOfDate] - Reference date for determining active term context.
 * @returns {Object} Calculated enrollment summary and discrepancies.
 */
export function computeSMEAEnrollment(
  allLearners = [],
  selectedSY = "2026-2027",
  calendarConfig = academicCalendar,
  asOfDate = new Date()
) {
  const inSY = allLearners.filter(
    (l) => String(l.schoolYear || "").trim() === String(selectedSY).trim()
  );

  const missingLrn = [];
  const invalidLrn = [];
  const missingSection = [];
  const missingSex = [];
  const invalidGrade = [];
  const transferredOut = [];

  const lrnCount = {};
  inSY.forEach((l) => {
    const lrn = String(l.lrn || "").trim();
    if (!lrn) {
      missingLrn.push(l);
    } else {
      lrnCount[lrn] = (lrnCount[lrn] || 0) + 1;
      if (!/^\d{12}$/.test(lrn)) {
        invalidLrn.push(l);
      }
    }

    if (l.enrollmentStatus === "transferred-out") {
      transferredOut.push(l);
    }
  });

  const duplicateLrns = Object.keys(lrnCount).filter((k) => lrnCount[k] > 1);

  const validActive = [];
  inSY.forEach((l) => {
    const grade = normalizeGrade(l.gradeLevel);
    const section = String(l.section || "").trim();
    const sex = normalizeSex(l.sex);
    const isTransferredOut = l.enrollmentStatus === "transferred-out";

    if (!section) missingSection.push(l);
    if (!sex) missingSex.push(l);
    if (!grade) invalidGrade.push(l);

    // Active learners with valid grade, section, and recognized sex
    if (grade && section && sex && !isTransferredOut) {
      validActive.push({ ...l, grade, section, sex });
    }
  });

  // Grade x Section matrix
  const matrix = {};
  validActive.forEach((l) => {
    if (!matrix[l.grade]) matrix[l.grade] = {};
    if (!matrix[l.grade][l.section]) matrix[l.grade][l.section] = { male: 0, female: 0 };
    if (l.sex === "Male") matrix[l.grade][l.section].male += 1;
    else if (l.sex === "Female") matrix[l.grade][l.section].female += 1;
  });

  const gradeOrder = Object.keys(matrix).sort(
    (a, b) => parseGradeNumber(a) - parseGradeNumber(b) || a.localeCompare(b)
  );

  let totalMale = 0;
  let totalFemale = 0;

  const gradeRows = gradeOrder.map((g) => {
    const sections = Object.keys(matrix[g]).sort().map((sec) => {
      const c = matrix[g][sec];
      return { section: sec, male: c.male, female: c.female, total: c.male + c.female };
    });
    const male = sections.reduce((s, r) => s + r.male, 0);
    const female = sections.reduce((s, r) => s + r.female, 0);
    totalMale += male;
    totalFemale += female;
    return { grade: g, sections, male, female, total: male + female };
  });

  // Discrepancy reporting issues list
  const discrepancies = [];
  if (duplicateLrns.length > 0) {
    discrepancies.push({
      type: "duplicate_lrn",
      severity: "error",
      count: duplicateLrns.length,
      text: `${duplicateLrns.length} duplicate LRN${duplicateLrns.length === 1 ? "" : "s"} detected across records in SY ${selectedSY}.`,
      items: duplicateLrns,
    });
  }
  if (missingLrn.length > 0) {
    discrepancies.push({
      type: "missing_lrn",
      severity: "error",
      count: missingLrn.length,
      text: `${missingLrn.length} learner record${missingLrn.length === 1 ? "" : "s"} missing 12-digit LRN.`,
    });
  }
  if (invalidLrn.length > 0) {
    discrepancies.push({
      type: "invalid_lrn_format",
      severity: "warning",
      count: invalidLrn.length,
      text: `${invalidLrn.length} learner${invalidLrn.length === 1 ? "" : "s"} with invalid LRN format (must be 12 digits).`,
    });
  }
  if (missingSection.length > 0) {
    discrepancies.push({
      type: "missing_section",
      severity: "warning",
      count: missingSection.length,
      text: `${missingSection.length} learner${missingSection.length === 1 ? "" : "s"} missing section assignment.`,
    });
  }
  if (missingSex.length > 0) {
    discrepancies.push({
      type: "missing_sex",
      severity: "warning",
      count: missingSex.length,
      text: `${missingSex.length} learner${missingSex.length === 1 ? "" : "s"} missing recognized sex (Male/Female).`,
    });
  }
  if (invalidGrade.length > 0) {
    discrepancies.push({
      type: "invalid_grade",
      severity: "warning",
      count: invalidGrade.length,
      text: `${invalidGrade.length} learner${invalidGrade.length === 1 ? "" : "s"} have an invalid or unassigned grade level.`,
    });
  }
  if (transferredOut.length > 0) {
    discrepancies.push({
      type: "transferred_out",
      severity: "info",
      count: transferredOut.length,
      text: `${transferredOut.length} learner${transferredOut.length === 1 ? "" : "s"} marked as transferred-out (excluded from active enrollment counts).`,
    });
  }

  // 3-term academic calendar resolution
  const activeTerm = getCurrentTermForSchoolYear(selectedSY, asOfDate, calendarConfig);
  const termBreakdown = [1, 2, 3].map((termNum) => {
    const termId = `term-${termNum}`;
    const termObj = calendarConfig?.[selectedSY]?.terms?.find((t) => t.id === termId);
    const isCurrent = activeTerm?.id === termId;
    return {
      termNumber: termNum,
      id: termId,
      label: termObj?.label || `Term ${termNum}`,
      startDate: termObj?.startDate || "",
      endDate: termObj?.endDate || "",
      isCurrent,
      totalLearners: totalMale + totalFemale,
      totalMale,
      totalFemale,
    };
  });

  return {
    schoolYear: selectedSY,
    inSYCount: inSY.length,
    validCount: validActive.length,
    totalMale,
    totalFemale,
    totalLearners: totalMale + totalFemale,
    gradeRows,
    discrepancies,
    activeTerm,
    termBreakdown,
  };
}
