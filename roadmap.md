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

Ranked highest priority first. Ranking weighs cost-to-fix against active harm — a one-line change that unblocks the automation outranks a feature that is blocked on an external artifact anyway.

### P1 — Fix the broken compliance signal

- [x] ~~**ESLint traverses `.claude/worktrees/`.**~~ Fixed in `a2a17e6` — added `.claude/worktrees` to `globalIgnores` in `eslint.config.js`. `npm run lint` exits 0 and the `.claude/CRON.md` chain now reaches the test suite (603 passed / 18 skipped), so the weekly audit sweep runs again.

- [ ] **Fill the four gaps in `LIKHA-SIS — Living Project Specification.md`.** *Corrected:* an earlier version of this roadmap called the spec an Aug-11, SF1-only, pre-role-system document and proposed archiving it. That was wrong — it is 1,443 lines across 92 sections, was reconciled as recently as `f3799b4`, and already covers SF10, LARDO, Nutrition, School Settings, Firebase Auth and the Parent Portal. It should be refreshed, not archived. Actual missing coverage, verified by search: **Anecdotal Records**, **Class Program / Teacher's Load**, **offline-first Firestore persistence**, and the **role-system vocabulary** (`ictCoordinator` and the other role names appear nowhere in it). Its line 1383 still tells sessions to paste the whole file in as current status, which is what makes those gaps worth closing.

### P2 — The one real feature decision

- [ ] **Academic hub (Grades / Attendance).** The only remaining entry under the sidebar's "Future" section (`src/components/Sidebar.jsx`, `const future`); both children render disabled with a "(Soon)" badge, so users see dead navigation. **Blocked on a scope call, not on effort:** a rollup view over existing `classRecords`/`attendance` data needs no new Firestore collection and is modest work; a genuinely new surface needs a collection, rules, and its own data model. Make that call before any code, since the two paths share almost nothing.

### P3 — Low urgency, low cost

- [ ] **`README.md` is still the default Vite template** — never customized to describe LIKHA-SIS, its stack, or setup steps. Nothing depends on it; it just looks unfinished to anyone opening the repo.

### P4 — Blocked on external artifacts

Named in the spec's reference list but not covered by any current skill, page, or `CLAUDE.md` domain mandate. Per the project's authenticity rule these cannot start until the official DepEd template is on file — don't invent fields. They rank last because the blocker is outside the codebase.

- [ ] **DO 016, s. 2026 (Lesson Planning)** — no feature, no reference template yet. Note that the "Lesson Planning" string in `src/utils/teacherLoadDerivation.js` is an ancillary-duty label for load computation, unrelated to this mandate.
- [ ] **DO 014, s. 2026 (Flexible Learning Programs)** — no feature, no reference template yet.

---

## Notes for future updates

- Update this file's checkboxes and "Last updated" date as items ship — treat it as a living tracker, not a one-time snapshot. Verify claims against the source before editing; this file went badly stale once already.
- Re-rank when priorities shift. The ranking above is a judgment call, not a fixed order — P1 is what it is because those items are cheap and actively harmful right now.
- New Firestore collections still go through `firestore-schema-sync` regardless of what's listed here.
- Grading/LARDO/print changes still get audited by their respective skills before being considered done, per `CLAUDE.md` §7A.
