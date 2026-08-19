# LIKHA-SIS Roadmap

**Last updated:** August 19, 2026
**Baseline at time of writing:** `npm run test` 627 passed / 18 skipped (55 files); `npm run lint` clean.

This file tracks what's actually pending in the codebase, derived from the sidebar's own stubs (now none — see P2 below) and gaps against `CLAUDE.md`'s architecture mandates. `LIKHA-SIS — Living Project Specification.md` is actively maintained and no longer needs archiving; both docs are kept current going forward.

DO 016 (Lesson Planning) and DO 014 (Flexible Learning Programs) are intentionally not tracked here — both are blocked on an official DepEd reference template that isn't on file, and per the project's authenticity rule (`CLAUDE.md` §26 / spec §25) no field or page work can start without one. Revisit once a template is obtained; there is nothing actionable in the codebase until then.

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
- **Academic Hub:** combined Grades + Attendance rollup per section (`src/AcademicHub.jsx`), reusing `computeLearnerTermGrade` and `buildAttendanceYearOverview` over existing `classRecords`/`learners`/`attendance` data — no new collection

---

## Pending

Ranked highest priority first. Ranking weighs cost-to-fix against active harm — a one-line change that unblocks the automation outranks a feature that is blocked on an external artifact anyway.

### P1 — Fix the broken compliance signal

- [x] ~~**ESLint traverses `.claude/worktrees/`.**~~ Fixed in `a2a17e6` — added `.claude/worktrees` to `globalIgnores` in `eslint.config.js`. `npm run lint` exits 0 and the `.claude/CRON.md` chain now reaches the test suite, so the weekly audit sweep runs again.

- [x] ~~**Fill the four gaps in `LIKHA-SIS — Living Project Specification.md`.**~~ Fixed in `ca2b250` — added actual-implementation status to Anecdotal Records (§19), Attendance (§22) plus a new Class Program & Teacher's Load section (§22a), offline-first Firestore persistence (§28), and a new §2.4 documenting the real role-system vocabulary (`ictCoordinator`, `smeaCoordinator`, etc.). Also corrected an overclaim in §47/§50: "Attendance dedicated domain complete" referred only to SF2's Year Overview tab, not the (then still-unbuilt) combined Grades+Attendance rollup — now resolved by P2 below.

### P2 — The one real feature decision

- [x] ~~**Academic hub (Grades / Attendance).**~~ Fixed in `61ec335` — built as a read-only rollup view (`src/AcademicHub.jsx`) over existing `classRecords`/`learners`/`attendance` data, no new Firestore collection. Reuses `computeLearnerTermGrade` and SF2's `buildAttendanceYearOverview` rather than reimplementing either. Wired into `pageAccess.js`, `App.jsx`, and `Sidebar.jsx`; the sidebar's "Future" section (disabled "(Soon)" stubs) is now empty and was removed entirely, along with its now-dead icon-map entries.

### P3 — Low urgency, low cost

- [x] ~~**`README.md` is still the default Vite template.**~~ Fixed — replaced with a real project README covering the stack, DepEd compliance scope, getting-started commands, and pointers to `CLAUDE.md`/the Living Spec/this roadmap.

---

All tracked pending items are resolved as of this update. DO 016/DO 014 remain intentionally untracked (see note above) until an official reference template is on file.

---

## Notes for future updates

- Update this file's checkboxes and "Last updated" date as items ship — treat it as a living tracker, not a one-time snapshot. Verify claims against the source before editing; this file went badly stale once already.
- Re-rank when priorities shift. The ranking above is a judgment call, not a fixed order — P1 is what it is because those items are cheap and actively harmful right now.
- New Firestore collections still go through `firestore-schema-sync` regardless of what's listed here.
- Grading/LARDO/print changes still get audited by their respective skills before being considered done, per `CLAUDE.md` §7A.
