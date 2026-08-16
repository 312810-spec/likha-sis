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
Weights are resolved from **two** places, not one — check both before
concluding anything is missing:
* `src/utils/subjectWeights.js` — the static Grade 4-10 name-to-weight map
  (`SUBJECT_WEIGHTS`, `getSubjectWeights`).
* `src/utils/shsSubjectWeights.js` — Grade 11-12 SHS weights, resolved by
  `weightProfile` tag (`core`/`techPro`/`immersion`) rather than a static
  name map, since SHS subject names are school-configured. Composed with
  the Grade 4-10 map via `makeSubjectWeightsResolver(shsSubjects,
  fallbackGetSubjectWeights)`. Confirm the caller (e.g. `ClassRecord.jsx`)
  actually builds and uses this composed resolver (grep for
  `makeSubjectWeightsResolver`) rather than calling `getSubjectWeights`
  alone when SHS grade levels are in play.

## 2. Verify against the mandate
* **Component weights (WW/PT/EX)** must resolve to:
  * Core subjects: 20/50/30 — `subjectWeights.js` / `WEIGHT_PROFILES.core`
  * EPP-TLE / MAPEH: 20/60/20 — `subjectWeights.js`
  * Tech-Pro: 20/80/0 — `shsSubjectWeights.js`'s `WEIGHT_PROFILES.techPro`
  * Immersion: 15/65/20 — `shsSubjectWeights.js`'s `WEIGHT_PROFILES.immersion`
  Do not flag Tech-Pro/Immersion as "missing" just because they're absent
  from `subjectWeights.js` — check `shsSubjectWeights.js` first.
* **EX internal split**: ST1 30%, ST2 30%, TE 40% — confirm in
  `computeExamPS` (or its equivalent) via the `share` arguments passed to
  each sub-score contribution. This split must be **omitted** for Grades 1-3
  transition subjects — but first check `src/utils/keyStagesConfig.js`'s
  `KEY_STAGE_OPTIONS`: if Key Stage 1 (Kindergarten-Grade 3) has
  `disabled: true` and an empty `gradeLevels` array, the app doesn't offer
  those grade levels for grading at all yet, so there is no split to omit —
  do not flag this as a violation, note it as "not applicable, K-3 not yet
  supported" instead. Only flag a real violation if Grade 1-3 levels ARE
  selectable (`gradeLevelsOffered` can contain them) and the split still
  isn't omitted for them.
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
