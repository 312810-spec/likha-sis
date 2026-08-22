// Pure school-wide rollup of learners + nutritionRecords into the DepEd
// Nutritional Status Report grid (Enrolment / Pupils Weighed / BMI / HFA
// category counts, per section, split Male/Female/Total).

import { normalizeSex } from "./nutritionComputations.js";

const BMI_CATEGORIES = {
  "Severely Wasted": "severelyWasted",
  "Wasted": "wasted",
  "Normal": "normal",
  "Overweight": "overweight",
  "Obese": "obese",
};

const HFA_CATEGORIES = {
  "Severely Stunted": "severelyStunted",
  "Stunted": "stunted",
  "Normal": "normal",
  "Tall": "tall",
};

function zeroCount() {
  return { M: 0, F: 0, T: 0 };
}

function zeroCategoryBlock(categoryMap) {
  const block = {};
  for (const key of Object.values(categoryMap)) {
    block[key] = zeroCount();
  }
  return block;
}

function emptyRow(gradeLevel) {
  return {
    gradeLevel,
    enrolment: zeroCount(),
    weighed: zeroCount(),
    bmi: zeroCategoryBlock(BMI_CATEGORIES),
    hfa: zeroCategoryBlock(HFA_CATEGORIES),
  };
}

function increment(countObj, sexKey) {
  if (sexKey === "M" || sexKey === "F") {
    countObj[sexKey] += 1;
  }
  countObj.T += 1;
}

/**
 * Aggregates learners + nutritionRecords into per-GRADE-LEVEL DepEd
 * Nutritional Status Report rows for one schoolYear + period -- school-wide
 * by grade, not broken out per section, matching the real workbook's own
 * rollup granularity (verified against public/TingubNHS-BASELINE-NS-CONSO-
 * 2026-2027.xlsx: its "GRADE LEVEL" column has no per-section breakdown).
 *
 * @param {Array<object>} learners - full learners collection
 * @param {Array<object>} nutritionRecords - full nutritionRecords collection
 * @param {{schoolYear: string, period: "Baseline"|"Endline", gradeLevelsOffered: string[]}} options
 * @returns {{gradeLevels: object[], grandTotal: object}}
 */
export function consolidateByGradeLevel(learners, nutritionRecords, { schoolYear, period, gradeLevelsOffered = [] }) {
  const rowsByGrade = new Map();

  function rowFor(gradeLevel) {
    if (!rowsByGrade.has(gradeLevel)) {
      rowsByGrade.set(gradeLevel, emptyRow(gradeLevel));
    }
    return rowsByGrade.get(gradeLevel);
  }

  for (const learner of learners) {
    if ((learner.schoolYear || "") !== schoolYear) continue;
    // Trim before grouping: learner docs are not guaranteed to be trimmed,
    // while nutritionRecords always are (NutritionStatus.jsx trims on save).
    const gradeLevel = (learner.gradeLevel || "").trim();
    if (!gradeLevel) continue;
    const row = rowFor(gradeLevel);
    increment(row.enrolment, normalizeSex(learner.sex));
  }

  for (const record of nutritionRecords) {
    if ((record.schoolYear || "") !== schoolYear) continue;
    if ((record.period || "") !== period) continue;
    // Defensive trim for parity with the learner loop above, even though
    // records are already trimmed at write time.
    const gradeLevel = (record.gradeLevel || "").trim();
    if (!gradeLevel) continue;
    const row = rowFor(gradeLevel);
    const sexKey = normalizeSex(record.sex);

    increment(row.weighed, sexKey);

    const bmiKey = BMI_CATEGORIES[record.nutritionalStatus];
    if (bmiKey) increment(row.bmi[bmiKey], sexKey);

    const hfaKey = HFA_CATEGORIES[record.heightForAgeStatus];
    if (hfaKey) increment(row.hfa[hfaKey], sexKey);
  }

  const gradeLevels = Array.from(rowsByGrade.values()).sort((a, b) => {
    const diff = gradeLevelsOffered.indexOf(a.gradeLevel) - gradeLevelsOffered.indexOf(b.gradeLevel);
    // Unknown grades (not in gradeLevelsOffered, indexOf = -1) sort last.
    if (gradeLevelsOffered.indexOf(a.gradeLevel) === -1) return 1;
    if (gradeLevelsOffered.indexOf(b.gradeLevel) === -1) return -1;
    return diff;
  });

  const grandTotal = emptyRow("GRAND TOTAL");
  for (const row of gradeLevels) {
    for (const key of ["M", "F", "T"]) {
      grandTotal.enrolment[key] += row.enrolment[key];
      grandTotal.weighed[key] += row.weighed[key];
    }
    for (const cat of Object.values(BMI_CATEGORIES)) {
      for (const key of ["M", "F", "T"]) {
        grandTotal.bmi[cat][key] += row.bmi[cat][key];
      }
    }
    for (const cat of Object.values(HFA_CATEGORIES)) {
      for (const key of ["M", "F", "T"]) {
        grandTotal.hfa[cat][key] += row.hfa[cat][key];
      }
    }
  }

  return { gradeLevels, grandTotal };
}

/**
 * Derives the official form's percentage columns from a row's already-
 * correct counts -- pure math, no new counting logic. Per the real
 * workbook's own formulas (verified against public/TingubNHS-BASELINE-NS-
 * CONSO-2026-2027.xlsx): Pupils Weighed % = weighed / enrolment (coverage),
 * and every BMI/HFA category % = category count / weighed (not enrolment).
 * Returns null for a percentage whose denominator is 0, matching the
 * null-on-divide-by-zero convention used elsewhere (see sf2Summary.js's
 * pctEnrolment/pctAttendance) -- never NaN or a fabricated 0%.
 */
export function withPercentages(row) {
  function pct(count, denom) {
    return denom > 0 ? (count / denom) * 100 : null;
  }
  function pctBlock(categoryBlock, denomBlock) {
    const out = {};
    for (const [cat, counts] of Object.entries(categoryBlock)) {
      out[cat] = {
        M: pct(counts.M, denomBlock.M),
        F: pct(counts.F, denomBlock.F),
        T: pct(counts.T, denomBlock.T),
      };
    }
    return out;
  }
  return {
    ...row,
    pct: {
      weighed: {
        M: pct(row.weighed.M, row.enrolment.M),
        F: pct(row.weighed.F, row.enrolment.F),
        T: pct(row.weighed.T, row.enrolment.T),
      },
      bmi: pctBlock(row.bmi, row.weighed),
      hfa: pctBlock(row.hfa, row.weighed),
    },
  };
}
