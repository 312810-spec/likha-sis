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

function emptyRow(gradeLevel, section) {
  return {
    gradeLevel,
    section,
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
 * Aggregates learners + nutritionRecords into per-section DepEd Nutritional
 * Status Report rows for one schoolYear + period.
 *
 * @param {Array<object>} learners - full learners collection
 * @param {Array<object>} nutritionRecords - full nutritionRecords collection
 * @param {{schoolYear: string, period: "Baseline"|"Endline", gradeLevelsOffered: string[]}} options
 * @returns {{sections: object[], grandTotal: object}}
 */
export function consolidateBySection(learners, nutritionRecords, { schoolYear, period, gradeLevelsOffered = [] }) {
  const rowsByKey = new Map();

  function rowFor(gradeLevel, section) {
    const key = `${gradeLevel}|${section}`;
    if (!rowsByKey.has(key)) {
      rowsByKey.set(key, emptyRow(gradeLevel, section));
    }
    return rowsByKey.get(key);
  }

  for (const learner of learners) {
    if ((learner.schoolYear || "") !== schoolYear) continue;
    // Trim before grouping: learner docs are not guaranteed to be trimmed,
    // while nutritionRecords always are (NutritionStatus.jsx trims on save).
    // Without this, "Love " and "Love" would split one section into two rows —
    // one with enrolment but no weighed, one with weighed but no enrolment.
    const gradeLevel = (learner.gradeLevel || "").trim();
    const section = (learner.section || "").trim();
    if (!gradeLevel || !section) continue;
    const row = rowFor(gradeLevel, section);
    increment(row.enrolment, normalizeSex(learner.sex));
  }

  for (const record of nutritionRecords) {
    if ((record.schoolYear || "") !== schoolYear) continue;
    if ((record.period || "") !== period) continue;
    // Defensive trim for parity with the learner loop above, even though
    // records are already trimmed at write time.
    const gradeLevel = (record.gradeLevel || "").trim();
    const section = (record.section || "").trim();
    if (!gradeLevel || !section) continue;
    const row = rowFor(gradeLevel, section);
    const sexKey = normalizeSex(record.sex);

    increment(row.weighed, sexKey);

    const bmiKey = BMI_CATEGORIES[record.nutritionalStatus];
    if (bmiKey) increment(row.bmi[bmiKey], sexKey);

    const hfaKey = HFA_CATEGORIES[record.heightForAgeStatus];
    if (hfaKey) increment(row.hfa[hfaKey], sexKey);
  }

  const sections = Array.from(rowsByKey.values()).sort((a, b) => {
    const gradeDiff = gradeLevelsOffered.indexOf(a.gradeLevel) - gradeLevelsOffered.indexOf(b.gradeLevel);
    if (gradeDiff !== 0) {
      // Unknown grades (not in gradeLevelsOffered, indexOf = -1) sort last.
      if (gradeLevelsOffered.indexOf(a.gradeLevel) === -1) return 1;
      if (gradeLevelsOffered.indexOf(b.gradeLevel) === -1) return -1;
      return gradeDiff;
    }
    return a.section.localeCompare(b.section);
  });

  const grandTotal = emptyRow("", "GRAND TOTAL");
  for (const row of sections) {
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

  return { sections, grandTotal };
}
