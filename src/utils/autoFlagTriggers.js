// src/utils/autoFlagTriggers.js
// Utility to determine whether a learner should be auto-flagged for LARDO monitoring

export function checkAutoFlagTriggers({ generalAverage = null, subjectFinalGrades = null, nutritionStatus = null }) {
  const riskFactors = [];
  const reasons = [];

  // Academic: general average
  if (typeof generalAverage === "number" && !isNaN(generalAverage) && generalAverage < 75) {
    riskFactors.push("Academic difficulty");
    reasons.push(`General Average ${generalAverage} below passing mark`);
  }

  // Academic: any subject final grade below passing
  if (Array.isArray(subjectFinalGrades)) {
    const anyFail = subjectFinalGrades.some((g) => typeof g === "number" && !isNaN(g) && g < 75);
    if (anyFail) {
      if (!riskFactors.includes("Academic difficulty")) riskFactors.push("Academic difficulty");
      reasons.push("Final Grade below passing mark");
    }
  }

  // Health: nutrition status
  const concerning = ["Severely Wasted", "Wasted", "Obese"];
  if (typeof nutritionStatus === "string" && concerning.includes(nutritionStatus)) {
    riskFactors.push("Health condition");
    reasons.push(`Nutrition status: ${nutritionStatus}`);
  }

  if (riskFactors.length === 0) return null;

  return {
    riskFactors,
    reasons,
    suggestedNote: reasons.join('. '),
  };
}

export default checkAutoFlagTriggers;
