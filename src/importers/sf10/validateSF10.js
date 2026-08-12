// src/importers/sf10/validateSF10.js
// SF10-specific validation (academic record focus). Produces errors/warnings/info
// per record using the shared issue model.

import {
  makeIssue,
  ERROR,
  WARNING,
  INFO,
  isValidLrnFormat,
  summarizeIssues,
} from "../shared/validation.js";

/**
 * Validate a single normalized SF10 record.
 * @param {Object} rec - normalized record
 * @param {number} index - 1-based display index
 */
export function validateSF10Record(rec, index = 0) {
  const issues = [];
  const ref = { recordIndex: index };

  if (!rec.lrn) {
    issues.push(makeIssue(ERROR, "missing-lrn", "Missing LRN.", { field: "lrn", ...ref }));
  } else if (!isValidLrnFormat(rec.lrn)) {
    issues.push(
      makeIssue(ERROR, "invalid-lrn", `LRN "${rec.lrn}" is not a valid 12-digit LRN.`, {
        field: "lrn",
        ...ref,
      })
    );
  }

  if (!rec.lastName) {
    issues.push(makeIssue(WARNING, "missing-last-name", "Missing last name.", { field: "lastName", ...ref }));
  }
  if (!rec.firstName) {
    issues.push(makeIssue(WARNING, "missing-first-name", "Missing first name.", { field: "firstName", ...ref }));
  }
  if (!rec.schoolYear) {
    issues.push(
      makeIssue(WARNING, "missing-school-year", "School year could not be read from the workbook.", {
        field: "schoolYear",
        ...ref,
      })
    );
  }
  if (!rec.gradeLevel) {
    issues.push(
      makeIssue(WARNING, "missing-grade", "Grade level could not be read from the workbook.", {
        field: "gradeLevel",
        ...ref,
      })
    );
  }
  if (!rec.schoolId) {
    issues.push(
      makeIssue(WARNING, "missing-school-id", "School ID could not be read from the workbook.", {
        field: "schoolId",
        ...ref,
      })
    );
  }

  if (rec.learningAreas.length === 0) {
    issues.push(
      makeIssue(
        WARNING,
        "no-learning-areas",
        "No learning-area grades could be detected from the workbook.",
        { ...ref }
      )
    );
  } else {
    issues.push(
      makeIssue(INFO, "learning-areas-count", `${rec.learningAreas.length} learning area(s) extracted.`, {
        ...ref,
      })
    );
  }

  return issues;
}

/**
 * Validate a whole set of SF10 records.
 * @param {Array} records - normalized records
 * @returns {{ records: Array, fileIssues: Array }}
 */
export function validateSF10(records) {
  const result = records.map((rec, i) => {
    const issues = validateSF10Record(rec, i + 1);
    const summary = summarizeIssues(issues);
    const severity =
      summary.errors > 0 ? "error" : summary.warnings > 0 ? "warning" : "valid";
    return { learner: rec, issues, summary, severity };
  });
  return { records: result, fileIssues: [] };
}
