---
name: do15-grading-audit
description: >-
  Audits LIKHA-SIS grading logic against DepEd DO 15, s. 2026 for SY 2026-2027.
  Use whenever src/utils/gradeComputations.js, src/utils/transmutationTable.js,
  or ConsolidatedGrades.jsx change, or when asked to review/verify grading,
  weights, transmutation, or the academic intervention flag. Don't use for
  attendance/LARDO logic (see lardo-safety-audit) or SF9/SF10 export formatting.
metadata:
  category: LIKHA-SIS Domain
---

# DO 15, s. 2026 Grading Audit

Checks that grading computations in this codebase stay correct as they evolve.
CLAUDE.md Section 3 is the source of truth for the mandate; this skill verifies
the code still matches it.

## 1. Locate the current logic
Read `src/utils/gradeComputations.js` and `src/utils/transmutationTable.js`.
Grep for `getSubjectWeightsFn` / subject-type weight tables to find where
WW/PT/EX weights are assigned per subject.

## 2. Verify against the mandate
* **Component weights (WW/PT/EX)** must resolve to:
  * Core subjects: 20/50/30
  * EPP-TLE / MAPEH: 20/60/20
  * Tech-Pro / Immersion: 20/80/0 or 15/65/20
* **EX internal split**: ST1 30%, ST2 30%, TE 40% — confirm in
  `computeExamPS` (or its equivalent) via the `share` arguments passed to
  each sub-score contribution. This split must be **omitted** for Grades 1-3
  transition subjects — confirm callers skip it for those grade levels.
* **Pipeline order**: Raw → Weighted → Initial Grade (IG) →
  SY 2026-2027 Transmutation Table. Confirm `computeInitialGrade` sums the
  three weighted scores and `transmuteGrade` is applied after, not before.
* **Zero-based grading**: must NOT be active for SY 2026-2027 — that begins
  SY 2027-2028. If you find zero-based logic gated on a school year, confirm
  it correctly excludes the current SY.
* **Missing/non-numeric scores** should count as 0 (matches
  `ClassRecord.jsx`'s `computeLearnerGrade`) rather than being skipped or
  nulling the whole computation — a single missing item must not corrupt an
  otherwise valid grade.

## 3. Verify the business-logic trigger
Per CLAUDE.md Section 4B.6: Initial Grade < 70.00 must auto-trigger a DO 15
academic intervention flag. Grep for where `computeInitialGrade` /
`computeLearnerTermGrade` results feed into an intervention/flag write, and
confirm the threshold is `< 70`, not `<= 70` or `< 70.00` typo'd as a string
comparison.

## 4. Report
List each check as PASS/FAIL with the file:line it was verified against. For
any FAIL, propose the minimal fix — do not refactor surrounding code beyond
what's needed to correct the mandate violation. Run `npm run test` after any
fix (see `src/utils/__tests__/gradeComputations.test.js` and
`transmutationTable.test.js`) before reporting done.
