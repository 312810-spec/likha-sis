// src/utils/autoFlagTriggers.js
// Utility to determine whether a learner should be auto-flagged for LARDO monitoring

export function checkAutoFlagTriggers({ generalAverage = null, subjectFinalGrades = null, initialGrade = null, nutritionStatus = null, attendanceRate = null }) {
  const riskFactors = [];
  const reasons = [];

  // Academic: general average
  if (typeof generalAverage === "number" && !isNaN(generalAverage) && generalAverage < 75) {
    riskFactors.push("Academic difficulty");
    reasons.push(`General Average ${generalAverage} below passing mark`);
  }

  // Academic: Initial Grade (Class Record, pre-transmutation) below the DO 15
  // s.2026 intervention threshold -- catches risk earlier than the
  // consolidated general-average check above.
  if (typeof initialGrade === "number" && !isNaN(initialGrade) && initialGrade < 70) {
    if (!riskFactors.includes("Academic difficulty")) riskFactors.push("Academic difficulty");
    reasons.push(`Initial Grade ${initialGrade.toFixed(2)} below the 70 intervention threshold`);
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

  // Attendance: chronic absence (LARDO Feedback Loop trigger threshold)
  if (typeof attendanceRate === "number" && !isNaN(attendanceRate) && attendanceRate < 80) {
    riskFactors.push("Attendance concern");
    reasons.push(`Attendance rate of ${attendanceRate} percent, below the 80 percent threshold`);
  }

  if (riskFactors.length === 0) return null;

  return {
    riskFactors,
    reasons,
    suggestedNote: reasons.join('. '),
  };
}

export default checkAutoFlagTriggers;
