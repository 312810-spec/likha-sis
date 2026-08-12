// src/importers/shared/validation.js
// Reusable validation primitives + issue model used by SF1 and SF10.
// Issues are categorized into errors (block import), warnings (require review),
// and informational messages.

/** Create an issue object. */
export function makeIssue(severity, code, message, opts = {}) {
  return { severity, code, message, ...opts };
}

export const ERROR = "error";
export const WARNING = "warning";
export const INFO = "info";

/** LRN format rule used across the app: exactly 12 digits. */
export function isValidLrnFormat(lrn) {
  return /^\d{12}$/.test(String(lrn || ""));
}

/**
 * Build a per-record validation summary with error/warning/info counts.
 * @param {Array} issues
 */
export function summarizeIssues(issues = []) {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  issues.forEach((i) => {
    if (i.severity === ERROR) errors++;
    else if (i.severity === WARNING) warnings++;
    else if (i.severity === INFO) infos++;
  });
  return { errors, warnings, infos, total: issues.length };
}

/** Filter issues down to blocking errors. */
export function hasBlockingErrors(issues = []) {
  return issues.some((i) => i.severity === ERROR);
}

/** Normalize a learner identity into a comparable fingerprint (for conflict checks). */
export function identityFingerprint(learner) {
  const parts = [
    String(learner?.lastName || "").trim().toLowerCase(),
    String(learner?.firstName || "").trim().toLowerCase(),
    String(learner?.sex || "").trim().toLowerCase(),
    String(learner?.birthDate || "").trim(),
  ];
  return parts.join("|");
}
