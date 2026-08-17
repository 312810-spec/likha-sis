# LIKHA-SIS Roadmap

**Last updated:** August 18, 2026
**Baseline at time of writing:** `npm run lint` clean, `npm run test` 240/240 passing (26 files).

This file tracks what's actually pending in the codebase, derived from the sidebar's own "Coming Soon" stubs, gaps against `CLAUDE.md`'s architecture mandates, and features referenced in the (now stale) `LIKHA-SIS — Living Project Specification.md` that were never built. It supersedes that spec doc as the pending-work tracker — the spec still describes SF1-only, pre-Firebase-role-system LIKHA-SIS and should be treated as historical context, not current status.

---

## Shipped

For reference, so the pending list below isn't mistaken for the whole picture. Already implemented and covered by tests/audits:

- **Learner records & forms:** SF1 (entry + bulk import), SF2, SF4, ID Generator, Certificate Generator, Transfers Log
- **Grading (DO 15, s. 2026):** Class Record, Consolidated Grades, transmutation table, ST1/ST2/TE exam split, Initial Grade < 70.00 intervention trigger — audited by `do15-grading-audit`
- **Safe Environment / LRP (DO 006, s. 2026):** LARDO Tracking with 3-tier classification, 14-day auto-resolve, role-restricted discipline records — audited by `lardo-safety-audit`
- **Strengthened SHS (DO 017, s. 2026):** Academic/Tech-Pro track support
- **Nutrition:** Nutrition Status (BMI/HFA), school-wide Nutrition Consolidator
- **SMEA:** Enrollment reporting
- **SF10 Generator:** single-learner and section-batch print modes, cross-era MATATAG subject matching
- **Import Center:** SF1 bulk import, SF10 import
- **Admin:** User Management (roles, reset, deactivate), School Settings, Branding Settings, Account Settings
- **Print safety:** pure-white `@media print` boundary — audited by `print-safety-audit`
- **Security:** role-gated `firestore.rules` per collection — kept in sync by `firestore-schema-sync`
- **Automation:** weekly cloud compliance sweep (lint + test + all four audit skills) — see `.claude/CRON.md`

---

## Pending

### Tier 1 — Stubbed in the UI, not yet built

These already have disabled "(Soon)" entries in `Sidebar.jsx`, so the product intent is committed even though no page/data model exists yet.

- [ ] **Anecdotal Records** (SMEA, DO 006-adjacent) — needs an official DepEd anecdotal-record template confirmed before building the data model per the project's "official forms first" rule. No Firestore collection, page, or route exists yet.
- [ ] **Academic hub (Grades / Attendance)** — the sidebar reserves a consolidated "Academic" section separate from the existing Class Record / SF2 flows. Scope needs clarifying: whether this is a new rollup view over existing `classRecords`/`attendance` data, or a genuinely new surface.

### Tier 2 — Architecture commitments in `CLAUDE.md`/spec that were never started

- [ ] **PWA packaging** — no `manifest.json`, service worker, or app icon in the repo despite the project being architected as a PWA (`CLAUDE.md` §2, spec §7/§29). `index.html`/`vite.config.js` have no PWA plugin wired in.
- [ ] **Offline-first Firestore persistence** — `src/firebase.js` doesn't enable IndexedDB/offline persistence. Spec §28 calls this out explicitly as a requirement for real school-network conditions; it's currently unaddressed.

### Tier 3 — Later phase, explicitly deferred

- [ ] **Parent Portal** (Phase 7) — no parent role, no verified parent-learner relationship model, no parent-facing views. Intentionally sequenced last; only start after Tier 1/2 are stable.

### Tier 4 — Referenced DepEd mandates with no scoping yet

Named in the spec's reference list (§43) but not covered by any current skill, page, or `CLAUDE.md` domain mandate. Before touching these, get the official DepEd template per the project's authenticity rule — don't invent fields.

- [ ] **DO 016, s. 2026 (Lesson Planning)** — no feature, no reference template on file yet.
- [ ] **DO 014, s. 2026 (Flexible Learning Programs)** — no feature, no reference template on file yet.

### Tier 5 — Housekeeping

- [ ] `LIKHA-SIS — Living Project Specification.md` is stale (dated Aug 11, describes a pre-role-system, SF1-only app). Either archive it or refresh it — right now it contradicts the actual shipped feature set above and could mislead a future session that pastes it in per its own §49 instructions.
- [ ] `README.md` is still the default Vite template — never customized to describe LIKHA-SIS, its stack, or setup steps.

---

## Notes for future updates

- Update this file's checkboxes and "Last updated" date as items ship — treat it as a living tracker, not a one-time snapshot.
- New Firestore collections still go through `firestore-schema-sync` regardless of what's listed here.
- Grading/LARDO/print changes still get audited by their respective skills before being considered done, per `CLAUDE.md` §7A.
