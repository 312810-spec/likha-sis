// src/utils/sf4Computations.js
// Pure helpers for School Form 4 (SF4) — Monthly Learner Movement Report.
// All computing here is side-effect free so it can be unit tested in isolation.

// Returns true when a remark string indicates a learner dropped out.
// DepEd remarks such as "Dropped Out - b3: Death" or simply "Dropped Out"
// count, as long as the string starts with "Dropped Out".
export function isDropoutRemark(remarkString) {
  if (typeof remarkString !== "string") return false;
  return remarkString.trimStart().startsWith("Dropped Out");
}

/**
 * Computes one SF4 row per section plus a final totals row.
 *
 * @param {Object} params
 * @param {string[]} params.sections - section names for the grade level
 * @param {Object<string, Array>} params.learnersBySection - section -> learner
 *   objects, each with a `sex` field ("Male"/"Female") and `enrollmentStatus`.
 * @param {Array} params.transfersInMonth - transfer records already filtered to
 *   the target month, each { section, transferType: "in" | "out" }.
 * @param {Array} params.dropoutsInMonth - learners marked dropped out that month,
 *   each { section }.
 * @returns {Array} one row object per section plus a TOTAL row at the end.
 */
export function computeSF4Rows({
  sections,
  learnersBySection,
  transfersInMonth,
  dropoutsInMonth,
}) {
  const rows = (sections || []).map((section) => {
    const learners = learnersBySection?.[section] || [];
    const active = learners.filter((l) => l.enrollmentStatus === "active");

    // End of month counts come straight from the active learners roster.
    const endOfMonthMale = active.filter((l) => l.sex === "Male").length;
    const endOfMonthFemale = active.filter((l) => l.sex === "Female").length;
    const endOfMonthTotal = active.length;

    // Movement counts for this section during the month.
    const transfers = (transfersInMonth || []).filter((t) => t.section === section);
    const transferredIn = transfers.filter((t) => t.transferType === "in").length;
    const transferredOut = transfers.filter((t) => t.transferType === "out").length;
    const droppedOut = (dropoutsInMonth || []).filter(
      (d) => d.section === section
    ).length;

    // Reconstruct the enrollment count before this month's changes:
    //   beginning = end - (transferred in) + (transferred out) + (dropped out)
    const beginningOfMonthTotal =
      endOfMonthTotal - transferredIn + transferredOut + droppedOut;

    return {
      section,
      // The beginning-of-month breakdown by sex cannot be reliably derived from
      // the available inputs, so only the reconstructed total is populated.
      beginningOfMonthMale: null,
      beginningOfMonthFemale: null,
      beginningOfMonthTotal,
      // Not derivable from the provided inputs; kept as a constant 0 column so
      // the SF4 table stays complete.
      lateEnrollment: 0,
      transferredIn,
      transferredOut,
      droppedOut,
      endOfMonthMale,
      endOfMonthFemale,
      endOfMonthTotal,
    };
  });

  // Totals row summing every section across all numeric fields.
  const sum = (key) =>
    rows.reduce((acc, r) => acc + (typeof r[key] === "number" ? r[key] : 0), 0);

  const totals = {
    section: "TOTAL",
    beginningOfMonthMale: null,
    beginningOfMonthFemale: null,
    beginningOfMonthTotal: sum("beginningOfMonthTotal"),
    lateEnrollment: sum("lateEnrollment"),
    transferredIn: sum("transferredIn"),
    transferredOut: sum("transferredOut"),
    droppedOut: sum("droppedOut"),
    endOfMonthMale: sum("endOfMonthMale"),
    endOfMonthFemale: sum("endOfMonthFemale"),
    endOfMonthTotal: sum("endOfMonthTotal"),
  };

  return [...rows, totals];
}
