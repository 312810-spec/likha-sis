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

Verifies code matches CLAUDE.md Section 3's DO 006 and trigger mandates.

## Check
- Auto-flag: SF2 attendance < 80% and Initial Grade < 70.00 write a factor from `lardoAutoResolve.js#AUTO_FLAG_RISK_FACTORS` — new sources add a label there, never an ad hoc string
- `#isEligibleForAutoResolveCheck` — only `status: "monitoring"` records where every factor is `#isAutoFlagOrigin`; manual factors block auto-resolve
- `#AUTO_RESOLVE_WINDOW_DAYS` must equal 14
- Callers confirm actual recovery before resolving, not eligibility alone
- `LardoTracking.jsx` incidents classify into exactly 3 tiers: L1 Minor/Disruptive, L2 Serious/Stalking/Slight Injury, L3 Severe/Gang/Cheating/Drugs
- Role gate — UI and `firestore.rules#hasAnyRole([...])` — exactly `smeaCoordinator`, `principal`, `guidance`, no broader role

## Report
PASS/FAIL per check, file:line. Minimal fix only. Then
`npx vitest run src/__tests__/lardoTracking.test.js src/utils/__tests__/lardoAutoResolve.test.js`.
