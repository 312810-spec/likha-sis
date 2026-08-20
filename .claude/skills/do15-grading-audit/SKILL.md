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

Verifies code matches CLAUDE.md Section 3's grading mandate.

## Check
- `subjectWeights.js#getSubjectWeights` — Grade 4-10: Core 20/50/30, EPP-TLE/MAPEH 20/60/20
- `shsSubjectWeights.js#WEIGHT_PROFILES` (Tech-Pro 20/80/0, Immersion 15/65/20) and `#makeSubjectWeightsResolver` — confirm SHS callers (e.g. `ClassRecord.jsx`) compose it, not `getSubjectWeights` alone
- `gradeComputations.js#computeExamPS` — ST1/ST2/TE 30/30/40; omitted only for Grade 1-3 (cross-check `keyStagesConfig.js#KEY_STAGE_OPTIONS` — K-3 `disabled: true` means N/A, not a violation)
- `#computeInitialGrade` → `transmutationTable.js#transmuteGrade` order; zero-based grading inactive for SY 2026-2027
- `ClassRecord.jsx#computeLearnerGrade` — missing/non-numeric scores count as 0
- Intervention trigger on `computeInitialGrade`/`computeLearnerTermGrade` output: threshold is numeric `< 70`

## Report
PASS/FAIL per check, file:line. Minimal fix only. Then
`npx vitest run src/utils/__tests__/gradeComputations.test.js src/utils/__tests__/transmutationTable.test.js`.
