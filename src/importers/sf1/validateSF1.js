// src/importers/sf1/validateSF1.js
// SF1-specific validation. Produces errors/warnings/info per learner record,
// plus file-level issues (missing school info, etc.).

import {
  makeIssue,
  ERROR,
  WARNING,
  isValidLrnFormat,
  summarizeIssues,
} from "../shared/validation.js";
import { identityFingerprint } from "../shared/validation.js";

/**
 * Validate a single normalized SF1 learner record.
 * @param {Object} learner - normalized learner
 * @param {number} index - display index (1-based)
 * @returns {Array} issues
 */
export function validateLearner(learner, index = 0) {
  const issues = [];
  const ref = { recordIndex: index };

  // --- LRN ---------------------------------------------------------------
  if (!learner.lrn) {
    issues.push(makeIssue(ERROR, "missing-lrn", "Missing LRN.", { field: "lrn", ...ref }));
  } else if (!isValidLrnFormat(learner.lrn)) {
    issues.push(
      makeIssue(ERROR, "invalid-lrn", `LRN "${learner.lrn}" is not a valid 12-digit LRN.`, {
        field: "lrn",
        ...ref,
      })
    );
  }

  // --- Name --------------------------------------------------------------
  if (!learner.lastName) {
    issues.push(makeIssue(ERROR, "missing-last-name", "Missing last name.", { field: "lastName", ...ref }));
  }
  if (!learner.firstName) {
    issues.push(makeIssue(ERROR, "missing-first-name", "Missing first name.", { field: "firstName", ...ref }));
  }

  // --- Sex ---------------------------------------------------------------
  if (!learner.sex) {
    issues.push(
      makeIssue(WARNING, "unrecognized-sex", "Sex is missing or not recognized as Male/Female.", {
        field: "sex",
        ...ref,
      })
    );
  }

  // --- Birth date --------------------------------------------------------
  if (!learner.birthDate) {
    issues.push(
      makeIssue(WARNING, "missing-birth-date", "Birth date missing or could not be parsed.", {
        field: "birthDate",
        ...ref,
      })
    );
  }

  // --- School / enrollment context --------------------------------------
  // Blocking: a learner with no school year/grade/section is written with
  // those fields blank and then can never be found by any grade+section
  // filter in SF1, SF2, ClassRecord, etc. — effectively orphaned data.
  if (!learner.schoolYear) {
    issues.push(
      makeIssue(ERROR, "missing-school-year", "School year could not be read from the workbook.", {
        field: "schoolYear",
        ...ref,
      })
    );
  }
  if (!learner.gradeLevel) {
    issues.push(
      makeIssue(ERROR, "missing-grade", "Grade level could not be read from the workbook.", {
        field: "gradeLevel",
        ...ref,
      })
    );
  }
  if (!learner.section) {
    issues.push(
      makeIssue(ERROR, "missing-section", "Section could not be read from the workbook.", {
        field: "section",
        ...ref,
      })
    );
  }
  if (!learner.schoolId) {
    issues.push(
      makeIssue(WARNING, "missing-school-id", "School ID could not be read from the workbook.", {
        field: "schoolId",
        ...ref,
      })
    );
  }

  return issues;
}

/**
 * Validate a whole set of learners for one file.
 * @param {Array} learners - normalized learners
 * @returns {{ records: Array<{learner,issues,severity}>, fileIssues: Array }}
 */
export function validateSF1(learners) {
  const records = learners.map((learner, i) => {
    const issues = validateLearner(learner, i + 1);
    const summary = summarizeIssues(issues);
    const severity = summary.errors > 0 ? "error" : summary.warnings > 0 ? "warning" : "valid";
    return { learner, issues, summary, severity };
  });

  const fileIssues = [];
  return { records, fileIssues };
}

export { identityFingerprint };
