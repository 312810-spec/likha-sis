# LIKHA-SIS — AI Project Memory

Stable knowledge future Claude Code sessions need but that doesn't belong
in the short top-level `CLAUDE.md`. This file is not a repository dump —
add to it only when something here would have saved a future session real
rework.

---

## Reusable utilities & hooks

- `src/utils/gradeComputations.js` — DO 15 s.2026 raw → weighted → Initial
  Grade computation. Any grading feature should call into this, not
  reimplement the weight math.
- `src/utils/transmutationTable.js` — the SY 2026-2027 transmutation table
  (Initial Grade → transmuted grade). Zero-based grading table applies
  starting SY 2027-2028 — do not merge tables across school years.
- `src/utils/lardoAutoResolve.js` — 14-day auto-resolve window for LARDO
  risk flags (attendance and grade-triggered). Attendance/grading features
  that create or clear a LARDO flag should call this, not duplicate the
  window logic.
- `src/academicCalendar.js` + `useAcademicCalendar()` hook — built-in SY
  2026-2027 fallback, layered under `settings/schoolConfig.academicCalendar`
  via `mergeAcademicCalendar()`. Consumers (`SF4.jsx`, `SMEAEnrollment.jsx`)
  read the calendar through the hook, never by importing the fallback
  directly.
- `useSchoolConfig()` — the read path for `settings/schoolConfig`; keeps
  Firestore reads centralized instead of ad hoc `getDoc` calls scattered
  through components.
- `src/utils/settingsLock.js` — PBKDF2-SHA256 (150k iterations, 16-byte
  salt) verification for the School Settings key, built on the Web Crypto
  API with no npm dependency. Any future "sensitive settings" gate should
  reuse this, not add a second hashing scheme.
- `scripts/external-calendar/` — the free, GitHub Actions-run sync for
  `depedCalendarEvents` and `weatherAdvisories` (see
  `docs/ai/DECISIONS.md`). A standalone Node package (own
  `package.json`/`vitest.config.js`), never imported from `src/` or
  `functions/`. `depedSourceDiscovery.mjs` ranks live-discovered DepEd
  Order/Memorandum posts instead of a hard-coded URL;
  `depedCalendarParser.mjs` parses an HTML table, DepEd's "Annex B"
  calendar-matrix format (`parseDepedAnnexCalendarText` -- month headers
  followed by day/day-range rows with one or more bulleted activities), and
  a generic single-line PDF format; `lib/ocrPdf.mjs` OCRs a DepEd PDF with
  no text layer via Poppler + Tesseract (free, local, never an AI API --
  see `docs/ai/DECISIONS.md`) so `parseDepedAnnexCalendarText` still has
  text to work with; `pagasaParser.mjs` parses the official Tropical
  Cyclone Bulletin
  (HTML first, a linked PDF only as a fallback, scoped to the page's
  current-status section and never its "Archive" section),
  Weather Advisory, and PRSD regional rainfall/thunderstorm pages;
  `lib/schoolLocation.mjs` maps a school's DepEd region to one of PAGASA's
  5 real PRSD slugs (`ncrprsd`/`nlprsd`/`slprsd`/`visprsd`/`minprsd`);
  `lib/firestoreWriter.mjs` has the idempotent-upsert and
  keep-last-known-good-on-failure logic both sync scripts share. Run
  `npm test` inside `scripts/external-calendar/` for its own suite — it is
  not part of the root `npm run test`.

## Important data relationships

- `settings/schoolConfig` is the root of the config graph: it drives
  `academicCalendar.js`, which drives `App.jsx` routing guards and
  `Sidebar.jsx` role/page guards.
- Updates to core schemas (`Learner`, `Class Record`) must traverse to
  `Consolidated Grades`, `SF9`, `SMEA Rollups`, and `LARDO` — these are
  derived views, not independent copies. A schema change that doesn't
  update all four is incomplete.
- `settings/security` (the School Settings key hash) is written *before*
  `settings/schoolConfig` during first-run setup, because `firestore.rules`
  needs the `!isSetupComplete()` bootstrap branch on both documents in that
  order.

## Security constraints worth remembering

- `firestore.rules` is additive: a narrow `match` block on a specific
  document does not hide it from a broader parent `match` block. The
  pattern used for `settings/security` (a `document != 'security'` guard on
  the parent's broad rule) is the correct way to carve out an exception —
  reuse that pattern, don't assume a narrower nested rule wins.
- DO 006 (Safe Environment/LRP) data is restricted to `smeaCoordinator`,
  `principal`, and `guidance` roles, enforced in both `pageAccess.js` (UI)
  and `firestore.rules` (server). Both layers must be updated together.
- The School Settings key threat model is explicit and honest: it guards
  against accidental edits and a borrowed workstation, not a determined
  `ictCoordinator` (who can already read `settings/security`). Don't
  over-promise its security properties in UI copy or docs.

## UI / design-system conventions

- Design tokens and visual language live in `DESIGN.md` and
  `.impeccable/config.json` — institutional primary/accent/leaf colors,
  paper surfaces, ink colors, Fraunces (display) + Public Sans (body) +
  IBM Plex Mono (aligned numerals). Don't introduce a competing token set;
  extend the existing one.
- Screen chrome theming (dark/light/brand) uses `useDarkMode()` and
  `useBrandTheme()`. Printable components are the one place these hooks
  must NOT apply — see print conventions below.
- Restrained animation only; no gradients, glassmorphism, or decorative
  hero sections that slow down a teacher's workflow.

## Print / document conventions

- `ReportCard`, `CertificateGenerator`, `IDGenerator`, `SF1`, `SF2`, `SF4`,
  `NutritionStatus`, `NutritionConsolidator`, `ClassProgramGenerator`, and
  `components/SF1PrintView.jsx` must render a pure white background under
  `@media print` regardless of the active screen theme. The
  `print-safety-audit` skill checks this — run it after touching any of
  these files.
- Official DepEd form layouts (SF1/SF2/SF4/SF8/SF9/SF10) are structurally
  fixed; changing their layout is a compliance risk, not a styling choice.

## Testing conventions

- Vitest + Testing Library only — no other test framework.
- Tests live in `__tests__/<name>.test.js(x)` next to the file under test;
  the Claude Code `PostToolUse` hook looks for exactly that path when
  deciding whether to run a targeted test after an edit.
- Run targeted tests (`npx vitest run <path>`) during development; the full
  suite runs automatically via the `Stop` hook once a change touches more
  than 3 files or a design-system file.
- `src/importers/realSamples.test.js` has 2 known pre-existing failures
  unrelated to typical feature work (missing real DepEd sample workbooks,
  which are gitignored for PII reasons) — don't treat these as a regression
  you introduced.

## Known implementation boundaries

- No React Router — routing is single-page `currentPage` string state in
  `App.jsx`. This is a hard architectural constraint, not a style
  preference.
- No new Firestore collection without an explicit `firestore.rules` block
  (the `firestore-schema-sync` skill / `schema-guardian` agent implement
  this loop) and without architectural sign-off.
- DO 016 (Lesson Planning) and DO 014 (Flexible Learning Programs) are
  intentionally not implemented — both are blocked on an official DepEd
  reference template not yet on file. No field or page work should start
  on these without one, per the project's authenticity rule.

## Important workflows

- The UI/UX redesign workflow is a fixed seven-phase agent chain: UX
  Architect → UI Designer → Implementation Engineer → UI Finish Gate →
  Accessibility Audit → Performance Audit → Reality Check. Don't skip
  phases or reorder them for UI-affecting work.
- The weekly Autopilot routine (`.claude/CRON.md`) runs the four audit
  skills read-only against the GitHub repo; it never commits or pushes. If
  it reports a finding, address it in a normal local session — it doesn't
  self-heal.
