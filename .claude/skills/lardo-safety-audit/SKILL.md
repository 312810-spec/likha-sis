---
name: lardo-safety-audit
description: >-
  Audits LIKHA-SIS attendance-risk and LARDO/LRP logic against DepEd DO 006,
  s. 2026 (Safe Environment) and the DO 15 attendance trigger. Use whenever
  src/utils/lardoAutoResolve.js, LardoTracking.jsx, SMEAEnrollment.jsx, or
  firestore.rules access rules for lardo/behavior data change, or when asked
  to review LARDO flags, risk-level classification, or role access to
  behavioral records. Don't use for grading/transmutation (see
  do15-grading-audit).
metadata:
  category: LIKHA-SIS Domain
---

# DO 006, s. 2026 / LARDO Safety Audit

Checks that the LARDO closed-loop tracking system in this codebase still
matches CLAUDE.md Section 3's DO 006 and business-logic-trigger mandates.

## 1. Verify the auto-flag trigger
Per Section 4B.6: attendance < 80% (SF2) must auto-trigger a LARDO risk flag,
and Initial Grade < 70.00 must auto-trigger an academic intervention flag
that also feeds LARDO. Grep for where SF2 attendance percentages and
`computeInitialGrade`/`computeLearnerTermGrade` results are evaluated and
confirm they write a risk factor drawn from
`AUTO_FLAG_RISK_FACTORS` (`src/utils/lardoAutoResolve.js`): `"Academic
difficulty"`, `"Attendance concern"`. Any new auto-trigger source must add
its label to `AUTO_FLAG_RISK_FACTORS`, not invent an ad hoc string.

## 2. Verify the auto-resolve loop
Read `src/utils/lardoAutoResolve.js` and its test
(`src/__tests__/lardoTracking.test.js`,
`src/utils/__tests__/lardoAutoResolve.test.js`). Confirm:
* `AUTO_RESOLVE_WINDOW_DAYS` is still 14, matching CLAUDE.md's "14-day
  post-intervention recovery" mandate.
* `isEligibleForAutoResolveCheck` only returns true for `status ===
  "monitoring"` records whose risk factors are entirely auto-flag-origin
  (`isAutoFlagOrigin`) — a manually added risk factor (e.g. a free-text
  reason) must keep the record out of auto-resolve, requiring human sign-off.
* Callers still separately confirm attendance/grades have actually recovered
  before resolving — eligibility alone must never resolve a record.

## 3. Verify DO 006 3-tier classification
Confirm behavioral incident data (wherever `LardoTracking.jsx` or related
components record incidents) classifies into the three DO 006 tiers and
doesn't collapse them:
* **Level 1** — Minor/Disruptive
* **Level 2** — Serious/Stalking/Slight Injury
* **Level 3** — Severe/Gang/Cheating/Drugs

## 4. Verify role-gated access
Per Section 3: LARDO/LRP access is restricted to `smeaCoordinator`,
`principal`, and `guidance` roles only. Check both:
* UI gating (component-level role checks around LARDO/SMEA views)
* `firestore.rules` — grep for the collection(s) backing LARDO/behavioral
  data and confirm `hasAnyRole([...])` matches exactly this role set, not a
  broader one (e.g. `adviser` or `stakeholder` must NOT have read access).

## 5. Report
List each check as PASS/FAIL with file:line. Propose the minimal fix for any
FAIL — do not restructure the tracking flow beyond the mandate violation. Run
`npm run test` before reporting done.
