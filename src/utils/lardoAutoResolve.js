// src/utils/lardoAutoResolve.js
// Pure eligibility rules for the DO 15/LARDO closed-loop auto-resolve check:
// a "monitoring" record becomes eligible for auto-resolution 14 days after
// its most recent intervention, but only if every one of its risk factors
// came from the automated attendance/grade triggers -- a manually-added risk
// factor (e.g. "Family problems") means a human judgment call is involved,
// so it's left for staff to resolve themselves.

export const AUTO_FLAG_RISK_FACTORS = ["Academic difficulty", "Attendance concern"];
export const AUTO_RESOLVE_WINDOW_DAYS = 14;

export function isAutoFlagOrigin(riskFactors) {
  if (!Array.isArray(riskFactors) || riskFactors.length === 0) return false;
  return riskFactors.every((rf) => AUTO_FLAG_RISK_FACTORS.includes(rf));
}

// Days elapsed since the most recent intervention log entry, or null if
// there are no dated entries to measure from.
export function daysSinceLastIntervention(interventions, now = new Date()) {
  if (!Array.isArray(interventions) || interventions.length === 0) return null;
  const times = interventions
    .map((entry) => (entry?.date ? new Date(entry.date).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  if (times.length === 0) return null;
  const latest = Math.max(...times);
  return (now.getTime() - latest) / (1000 * 60 * 60 * 24);
}

// Whether a record is even worth re-checking against current attendance/
// grade data. Does NOT itself decide resolution -- the caller still needs to
// confirm attendance/grades have actually recovered before resolving.
export function isEligibleForAutoResolveCheck(record, now = new Date()) {
  if (!record || record.status !== "monitoring") return false;
  if (!isAutoFlagOrigin(record.riskFactors)) return false;
  const days = daysSinceLastIntervention(record.interventions, now);
  return days !== null && days >= AUTO_RESOLVE_WINDOW_DAYS;
}

export default isEligibleForAutoResolveCheck;
