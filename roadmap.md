# LIKHA-SIS Roadmap

**Last updated:** August 19, 2026
**Baseline at time of writing:** `npm run test` 603 passed / 18 skipped (54 files); `npm run lint` clean across `src/` (see Tier 4 for the worktree-traversal caveat).

This file tracks what's actually pending in the codebase, derived from the sidebar's own "Future" stubs, gaps against `CLAUDE.md`'s architecture mandates, and DepEd mandates referenced but never scoped. It supersedes `LIKHA-SIS — Living Project Specification.md` as the pending-work tracker — that spec still describes SF1-only, pre-Firebase-role-system LIKHA-SIS and should be treated as historical context, not current status.

---

## Shipped

For reference, so the pending list below isn't mistaken for the whole picture. Already implemented and covered by tests/audits:

- **Learner records & forms:** SF1 (entry + bulk import + LIS-exact register print), SF2, SF4, ID Generator, Certificate Generator, Transfers Log
- **Grading (DO 15, s. 2026):** Class Record, Consolidated Grades, transmutation table, ST1/ST2/TE exam split, Initial Grade < 70.00 intervention trigger — audited by `do15-grading-audit`
- **Safe Environment / LRP (DO 006, s. 2026):** LARDO Tracking with 3-tier classification, 14-day auto-resolve, role-restricted discipline records — audited by `lardo-safety-audit`
- **Anecdotal Records:** built against the official DepEd template (`AnecdotalRecords.jsx`, `anecdotalConstants.js`)
- **Strengthened SHS (DO 017, s. 2026):** Academic/Tech-Pro track support
- **Class Program & Teacher's Load:** section timetables with derived per-teacher load grids, conflict detection, paintable schedule grid
- **Alerts, Calendar & Announcements:** NDRRMC/weather advisory bell separating posted advisories from automated readings, School Calendar with 3-term boundaries and holidays, role-gated Announcements, dashboard weather card
- **Nutrition:** Nutrition Status (BMI/HFA), school-wide Nutrition Consolidator
- **SMEA:** Enrollment reporting
- **SF10 Generator:** single-learner and section-batch print modes, cross-era MATATAG subject matching
- **Import Center:** SF1 bulk import, SF10 import, DepEd onboarding CSV teacher account importer
- **Parent Portal:** `parent` role, parent login and parent-facing views, gated in `pageAccess.js` and `firestore.rules`
- **Admin:** User Management (roles, reset, deactivate), School Settings, Branding Settings, Account Settings
- **PWA packaging:** `vite-plugin-pwa` wired into `vite.config.js` with generated manifest and 192/512 icons
- **Offline-first Firestore:** `initializeFirestore` with `persistentLocalCache` + `persistentMultipleTabManager` for IndexedDB persistence across tabs
- **Print safety:** pure-white `@media print` boundary — audited by `print-safety-audit`
- **Security:** role-gated `firestore.rules` per collection — kept in sync by `firestore-schema-sync`
- **Automation:** weekly cloud compliance sweep (lint + test + all four audit skills) — see `.claude/CRON.md`

---

## Pending

### Tier 1 — Stubbed in the UI, not yet built

- [ ] **Academic hub (Grades / Attendance)** — the only remaining entry under the sidebar's "Future" section (`src/components/Sidebar.jsx`, `const future`). Both children render disabled with a "(Soon)" badge. Scope still needs clarifying: whether this is a new rollup view over existing `classRecords`/`attendance` data, or a genuinely new surface. Decide that before building, since a rollup needs no new Firestore collection and a new surface does.

### Tier 2 — Referenced DepEd mandates with no scoping yet

Named in the spec's reference list but not covered by any current skill, page, or `CLAUDE.md` domain mandate. Before touching these, get the official DepEd template per the project's authenticity rule — don't invent fields.

- [ ] **DO 016, s. 2026 (Lesson Planning)** — no feature, no reference template on file yet. Note that the "Lesson Planning" string already in `src/utils/teacherLoadDerivation.js` is an ancillary-duty label for load computation, unrelated to this mandate.
- [ ] **DO 014, s. 2026 (Flexible Learning Programs)** — no feature, no reference template on file yet.

### Tier 3 — Documentation housekeeping

- [ ] `LIKHA-SIS — Living Project Specification.md` is stale (dated Aug 11, describes a pre-role-system, SF1-only app). Either archive it or refresh it — right now it contradicts the actual shipped feature set above and could mislead a future session that pastes it in per its own instructions.
- [ ] `README.md` is still the default Vite template — never customized to describe LIKHA-SIS, its stack, or setup steps.

### Tier 4 — Tooling

- [ ] **ESLint traverses `.claude/worktrees/`.** The flat config's `ignores` doesn't exclude the nested worktree checkouts, so every active worktree's copy of the source gets linted as part of master. This currently surfaces 34 errors that belong to other branches, and the count grows with each new worktree. `src/` itself is clean.

---

## Notes for future updates

- Update this file's checkboxes and "Last updated" date as items ship — treat it as a living tracker, not a one-time snapshot. Verify claims against the source before editing; this file went badly stale once already.
- New Firestore collections still go through `firestore-schema-sync` regardless of what's listed here.
- Grading/LARDO/print changes still get audited by their respective skills before being considered done, per `CLAUDE.md` §7A.
