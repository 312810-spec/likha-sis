// src/utils/sf4Computations.js
// Pure helpers for School Form 4 (SF4) — Monthly Learner Movement and
// Attendance Report. All computing here is side-effect free so it can be unit
// tested in isolation.

// Returns true when a remark string indicates a learner dropped out / is no
// longer participating in learning activities (NLPA). DepEd remarks such as
// "Dropped Out - b3: Death" or simply "Dropped Out" count, as long as the
// string starts with "Dropped Out".
export function isDropoutRemark(remarkString) {
  if (typeof remarkString !== "string") return false;
  return remarkString.trimStart().startsWith("Dropped Out");
}

// Zero { male, female } pair used as the default previous-month cumulative.
const ZERO_SEX = { male: 0, female: 0 };

// Adds a Total to a { male, female } sex pair.
function withTotal({ male = 0, female = 0 }) {
  return { male, female, total: male + female };
}

// Counts how many movement records carry the given sex ("Male" | "Female").
// Records with an unknown/blank sex never match and are simply skipped.
function countBySex(items, sex) {
  return (items || []).filter((item) => (item.sex || "") === sex).length;
}

// Resolves the "(A) cumulative as of the previous month" value for one metric
// and one section. The metric value stored in `previousMonthCumulative` may be
// either a flat { male, female } shared by every section, or keyed per
// section: { "Rizal": { male, female }, "Bonifacio": { male, female } }.
function previousCumulative(previousMonthCumulative, metricKey, section) {
  const metric = previousMonthCumulative?.[metricKey];
  if (!metric) return { ...ZERO_SEX };
  if (typeof metric.male === "number" || typeof metric.female === "number") {
    return { male: metric.male || 0, female: metric.female || 0 };
  }
  const forSection = metric[section] || ZERO_SEX;
  return { male: forSection.male || 0, female: forSection.female || 0 };
}

/**
 * Computes the attendance summary for one section + month, using the same math
 * as SF2: average daily attendance = total present learner-days / number of
 * school days; percentage = average daily attendance / registered learners *
 * 100. Tardy ("T") does NOT count as absent; only "A" records do.
 *
 * @param {Object} params
 * @param {Object} [params.records] - SF2 records shape:
 *   learnerId -> { "YYYY-MM-DD": "A" | "T" }.
 * @param {Object} [params.learnerIds] - registered learners split by sex:
 *   { male: string[], female: string[] }.
 * @param {number} [params.weekdaysCount] - number of school days (Mon-Fri) in
 *   the month.
 * @returns {Object} { dailyAverageMale, dailyAverageFemale, dailyAverageTotal,
 *   percentageMale, percentageFemale, percentageTotal }.
 */
export function computeSectionAttendance({
  records = {},
  learnerIds = {},
  weekdaysCount = 0,
}) {
  const maleIds = Array.isArray(learnerIds.male) ? learnerIds.male : [];
  const femaleIds = Array.isArray(learnerIds.female) ? learnerIds.female : [];
  const days = Number(weekdaysCount) || 0;

  // Number of "A" (absent) records for one learner across the month.
  const absentCount = (learnerId) => {
    const map = records[learnerId] || {};
    return Object.values(map).filter((value) => value === "A").length;
  };

  // Average daily attendance for a group: total present learner-days / days.
  const dailyAverage = (ids) => {
    if (days <= 0 || ids.length === 0) return 0;
    const presentLearnerDays = ids.reduce((sum, id) => {
      return sum + Math.max(0, days - absentCount(id));
    }, 0);
    return presentLearnerDays / days;
  };

  const dailyAverageMale = dailyAverage(maleIds);
  const dailyAverageFemale = dailyAverage(femaleIds);
  const dailyAverageTotal = dailyAverageMale + dailyAverageFemale;

  const registeredMale = maleIds.length;
  const registeredFemale = femaleIds.length;
  const registeredTotal = registeredMale + registeredFemale;

  const percentageMale =
    registeredMale > 0 ? (dailyAverageMale / registeredMale) * 100 : null;
  const percentageFemale =
    registeredFemale > 0 ? (dailyAverageFemale / registeredFemale) * 100 : null;
  const percentageTotal =
    registeredTotal > 0 ? (dailyAverageTotal / registeredTotal) * 100 : null;

  return {
    dailyAverageMale,
    dailyAverageFemale,
    dailyAverageTotal,
    percentageMale,
    percentageFemale,
    percentageTotal,
  };
}

/**
 * Computes one SF4 row per section plus a final totals row, following the
 * official DepEd SF4 column structure.
 *
 * @param {Object} params
 * @param {string[]} params.sections - section names for the grade level.
 * @param {Object<string, Array>} params.learnersBySection - section -> learner
 *   objects, each with a `sex` field ("Male"/"Female"/"") and
 *   `enrollmentStatus`.
 * @param {Array} [params.transfersInMonth] - transfer records already filtered
 *   to the target month, each { section, transferType: "in" | "out", sex }.
 * @param {Array} [params.nlpaInMonth] - learners marked NLPA (previously
 *   "Dropped Out") during the month, each { section, sex }.
 * @param {Object} [params.previousMonthCumulative] - optional cumulative counts
 *   as of the previous month: { nlpa, transferredOut, transferredIn }, each
 *   either a flat { male, female } or keyed per section. Defaults to zeros.
 * @param {Object} [params.attendanceBySection] - section ->
 *   computeSectionAttendance() result to attach to each row.
 * @param {Object} [params.advisersBySection] - section -> class adviser name.
 * @returns {Array} one row object per section plus a TOTAL row at the end.
 */
export function computeSF4Rows({
  sections,
  learnersBySection,
  transfersInMonth,
  nlpaInMonth,
  previousMonthCumulative,
  attendanceBySection,
  advisersBySection,
}) {
  const rows = (sections || []).map((section) => {
    const learners = learnersBySection?.[section] || [];
    // Registered learners as of the end of the month = currently active roster.
    const active = learners.filter((l) => l.enrollmentStatus === "active");

    const endOfMonthMale = active.filter((l) => l.sex === "Male").length;
    const endOfMonthFemale = active.filter((l) => l.sex === "Female").length;
    const endOfMonthTotal = active.length;

    // (B) movement during the month, split by sex.
    const sectionTransfers = (transfersInMonth || []).filter(
      (t) => t.section === section
    );
    const transferredInOfMonth = sectionTransfers.filter(
      (t) => t.transferType === "in"
    );
    const transferredOutOfMonth = sectionTransfers.filter(
      (t) => t.transferType === "out"
    );
    const nlpaOfMonth = (nlpaInMonth || []).filter(
      (d) => d.section === section
    );

    const transferredInForMonth = withTotal({
      male: countBySex(transferredInOfMonth, "Male"),
      female: countBySex(transferredInOfMonth, "Female"),
    });
    const transferredOutForMonth = withTotal({
      male: countBySex(transferredOutOfMonth, "Male"),
      female: countBySex(transferredOutOfMonth, "Female"),
    });
    const nlpaForMonth = withTotal({
      male: countBySex(nlpaOfMonth, "Male"),
      female: countBySex(nlpaOfMonth, "Female"),
    });

    // (A) cumulative as of the previous month (manual/historical input).
    const nlpaPrev = withTotal(
      previousCumulative(previousMonthCumulative, "nlpa", section)
    );
    const transferredOutPrev = withTotal(
      previousCumulative(previousMonthCumulative, "transferredOut", section)
    );
    const transferredInPrev = withTotal(
      previousCumulative(previousMonthCumulative, "transferredIn", section)
    );

    // (A+B) cumulative as of the end of the month.
    const nlpaCumulative = withTotal({
      male: nlpaPrev.male + nlpaForMonth.male,
      female: nlpaPrev.female + nlpaForMonth.female,
    });
    const transferredOutCumulative = withTotal({
      male: transferredOutPrev.male + transferredOutForMonth.male,
      female: transferredOutPrev.female + transferredOutForMonth.female,
    });
    const transferredInCumulative = withTotal({
      male: transferredInPrev.male + transferredInForMonth.male,
      female: transferredInPrev.female + transferredInForMonth.female,
    });

    return {
      section,
      adviserName: advisersBySection?.[section] || "",
      endOfMonthMale,
      endOfMonthFemale,
      endOfMonthTotal,
      attendance: attendanceBySection?.[section] || null,
      nlpaPrev,
      nlpaForMonth,
      nlpaCumulative,
      transferredOutPrev,
      transferredOutForMonth,
      transferredOutCumulative,
      transferredInPrev,
      transferredInForMonth,
      transferredInCumulative,
    };
  });

  // Totals row: every numeric field is summed across the section rows.
  const sum = (key) =>
    rows.reduce((acc, r) => acc + (typeof r[key] === "number" ? r[key] : 0), 0);

  const sumPair = (key) =>
    rows.reduce(
      (acc, r) => ({ male: acc.male + r[key].male, female: acc.female + r[key].female }),
      { male: 0, female: 0 }
    );

  const sumAttendance = (subkey) =>
    rows.reduce(
      (acc, r) =>
        acc +
        (r.attendance && typeof r.attendance[subkey] === "number"
          ? r.attendance[subkey]
          : 0),
      0
    );

  const endOfMonthMale = sum("endOfMonthMale");
  const endOfMonthFemale = sum("endOfMonthFemale");
  const endOfMonthTotal = sum("endOfMonthTotal");

  // Percentages on the totals row are re-derived from the aggregated daily
  // averages and the aggregated registered counts (never summed per section).
  const anyAttendance = rows.some((r) => r.attendance);
  const attendance = anyAttendance
    ? {
        dailyAverageMale: sumAttendance("dailyAverageMale"),
        dailyAverageFemale: sumAttendance("dailyAverageFemale"),
        dailyAverageTotal: sumAttendance("dailyAverageTotal"),
        percentageMale:
          endOfMonthMale > 0
            ? (sumAttendance("dailyAverageMale") / endOfMonthMale) * 100
            : null,
        percentageFemale:
          endOfMonthFemale > 0
            ? (sumAttendance("dailyAverageFemale") / endOfMonthFemale) * 100
            : null,
        percentageTotal:
          endOfMonthTotal > 0
            ? (sumAttendance("dailyAverageTotal") / endOfMonthTotal) * 100
            : null,
      }
    : null;

  const totals = {
    section: "TOTAL",
    adviserName: "",
    endOfMonthMale,
    endOfMonthFemale,
    endOfMonthTotal,
    attendance,
    nlpaPrev: withTotal(sumPair("nlpaPrev")),
    nlpaForMonth: withTotal(sumPair("nlpaForMonth")),
    nlpaCumulative: withTotal(sumPair("nlpaCumulative")),
    transferredOutPrev: withTotal(sumPair("transferredOutPrev")),
    transferredOutForMonth: withTotal(sumPair("transferredOutForMonth")),
    transferredOutCumulative: withTotal(sumPair("transferredOutCumulative")),
    transferredInPrev: withTotal(sumPair("transferredInPrev")),
    transferredInForMonth: withTotal(sumPair("transferredInForMonth")),
    transferredInCumulative: withTotal(sumPair("transferredInCumulative")),
  };

  return [...rows, totals];
}
