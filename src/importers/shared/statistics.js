// src/importers/shared/statistics.js
// Computes learner statistics INDEPENDENTLY from the actual parsed records.
// Never trusts SF1 summary rows (TOTAL MALE / TOTAL FEMALE / COMBINED).

/**
 * Compute total / male / female from a set of records.
 * @param {Array} records - objects with a normalized `sex` field ("Male"/"Female"/"")
 */
export function computeStatistics(records) {
  let total = 0;
  let male = 0;
  let female = 0;
  records.forEach((r) => {
    const sex = String(r.sex || "").trim();
    if (!sex) return;
    total++;
    if (sex === "Male") male++;
    else if (sex === "Female") female++;
  });
  return { total, male, female };
}

/**
 * Compare calculated statistics against the workbook's own summary row (if any).
 * @param {{total,male,female}} calculated
 * @param {{male,female}|null} summary - from detectSF1Structure.findSummaryRow()
 * @returns {Array} warning issues describing any mismatch
 */
export function compareWithSummary(calculated, summary) {
  const warnings = [];
  if (!summary) return warnings;

  if (summary.male !== null && summary.male !== calculated.male) {
    warnings.push(
      `Workbook states ${summary.male} male(s) on its summary line, but the parsed records total ${calculated.male}.`
    );
  }
  if (summary.female !== null && summary.female !== calculated.female) {
    warnings.push(
      `Workbook states ${summary.female} female(s) on its summary line, but the parsed records total ${calculated.female}.`
    );
  }
  return warnings;
}
