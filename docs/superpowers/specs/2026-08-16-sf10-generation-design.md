# SF10 (Learner's Permanent Academic Record) Generation — Design

**Date:** 2026-08-16
**Status:** Approved, ready for implementation planning

## Problem

LIKHA-SIS can *import* a learner's SF10 (School Form 10 / Form 137, the DepEd
Learner's Permanent Academic Record) via `src/importers/sf10/` and
`SF10Importer.jsx`, backfilling history from paper records or a prior
school's export into the `academicRecords` Firestore collection. There is no
corresponding *generation* path: nothing takes a learner's records already
in LIKHA-SIS and produces/prints an SF10 document, the way `ReportCard.jsx`
does for SF9. This spec covers building that generator.

## Decisions

1. **Data source: merge live + imported records.** `classRecords` documents
   carry `schoolYear` and are never purged between years, so any year a
   learner was taught *inside* LIKHA-SIS can be reconstructed live using the
   same `computeLearnerTermGrade()` logic `ReportCard.jsx` already uses for
   SF9 — just looped across every school year found for that learner instead
   of one selected year. The `academicRecords` collection (populated by the
   existing SF10 importer) fills in the remaining years: pre-LIKHA-SIS
   history for transferees, or years imported from paper records. The
   generator merges both, keyed by `schoolYear + gradeLevel`; `classRecords`
   wins for any year it covers, `academicRecords` fills in the rest.

   Rejected alternatives:
   - *Import-only*: require every year, even ones taught live in LIKHA-SIS,
     to be manually re-entered into `academicRecords`. Redundant busywork
     for the common case of a student who has been in LIKHA-SIS since
     Grade 7.
   - *Live-only*: ignore `academicRecords` entirely. Breaks for any
     transferee or pre-adoption history, defeating the point of a
     *permanent* record and ignoring the importer that exists for exactly
     this.

2. **No "finalize year" / archival step.** Because live years are
   reconstructed on demand from `classRecords` rather than requiring a
   snapshot into `academicRecords`, no year-rollover or archival mechanism
   is needed. This keeps the feature read-only with no new Firestore writes.

3. **Layout: aim for the official Form 137 grid, but flag it as unverified.**
   No reference copy of the blank SF10 template was available to build
   against. The header block (learner identity, LRN, school info) and the
   subject-by-year grid (learning areas as rows, school years as columns,
   general average + promotion status/remarks per year) are constructed from
   general knowledge of the DepEd SF10 format, reusing the Grade 4-10 vs.
   SHS subject-row split already established for SF9. Unlike SF9's Annex G
   layout (verified against an authoritative source and explicitly marked
   "byte-identical" in `ReportCard.jsx`), this layout needs a follow-up
   validation pass once a real blank SF10 form is available to compare
   against. Do not treat this generator as Annex-exact until that pass
   happens.

4. **No auto-computed promotion/retention.** For live years, the general
   average is computed and shown, but "Promoted"/"Retained" is left as a
   manually-editable field, defaulting blank. Promotion/retention involves
   DepEd rules this system doesn't model anywhere (e.g. remedial-subject
   allowances), and it's a principal-level academic decision — auto-filling
   it risks silently asserting something false. For imported years, whatever
   `promotionStatus` came in via the SF10 importer is used as-is.

5. **Access: adviser + principal + ictCoordinator.** Matches SF9's
   adviser/principal access, plus ictCoordinator, who already owns SF10
   import and most permanent-record pages in this system.

6. **Batch printing supported.** In addition to single-learner generation
   (matching `ReportCard.jsx`'s pattern), section-batch printing is
   supported (matching `IDGenerator.jsx`'s pattern): pick grade + section,
   fetch `classRecords`/`academicRecords` once, render one SF10 per learner
   in the section back-to-back for printing.

## Architecture

Read-only and computed client-side, like SF9 — no new Firestore writes, no
archival step.

### `src/utils/sf10Records.js` (new, pure logic)

```
buildLearnerAcademicHistory(learnerId, classRecordsList, academicRecordsList, getSubjectWeightsFn)
  -> Array<{ schoolYear, gradeLevel, subjects: {...}, generalAverage, promotionStatus, source: "live" | "imported" }>
```

- Groups `classRecordsList` by `schoolYear + gradeLevel`, and for each group
  where `learnerId` appears in the grade data, computes per-subject term
  grades and a general average via the existing `computeLearnerTermGrade()`
  / weights-resolution logic, tagging the row `source: "live"`.
- For every `schoolYear + gradeLevel` present in `academicRecordsList` for
  that learner's LRN that ISN'T already covered by a live row, adds a row
  built from the imported record's `learningAreas` / `generalAverage` /
  `promotionStatus`, tagging it `source: "imported"`.
- Returns rows sorted chronologically by school year.
- No Firestore imports, no React — fully unit-testable with plain arrays.

### `src/utils/subjectRows.js` (new, extracted from `ReportCard.jsx`)

`LEGACY_SUBJECT_ROWS` and `getSubjectRows(gradeLevel, learner, shsConfig)`
move here unchanged from `ReportCard.jsx`, which switches to importing them.
`SF10Generator.jsx` imports the same functions. This ensures SF9 and SF10
can never drift on which subjects appear for a given grade level — including
the DO 017 SHS elective-cluster logic.

### `src/SF10Generator.jsx` (new component)

Sibling to `ReportCard.jsx` / `IDGenerator.jsx` at `src/`, not under
`pages/`, matching where the other report/document generators live.

Two modes in one component:
- **Single-learner mode**: learner picker (same pattern as
  `ReportCard.jsx`), renders that learner's full multi-year grid via
  `buildLearnerAcademicHistory()`.
- **Section-batch mode**: grade + section picker (same pattern as
  `IDGenerator.jsx`'s batch mode). Fetches `classRecords` and
  `academicRecords` collections once, then renders one SF10 per learner in
  the section back-to-back for printing — avoids re-querying per learner.

Print CSS follows the established `.no-print` / `.sf10-print-area` idiom
(matching `.rc-print-area` in `ReportCard.jsx`, `.id-print-area` in
`IDGenerator.jsx`): pure white `@media print` background, no dark/brand
theme leakage. This file needs a pass from the `print-safety-audit` skill
before being considered done, like the other printable components.

## Data flow

1. User picks a learner (single mode) or grade+section (batch mode).
2. Fetch `learners` (already-established pattern: fetch full collection,
   filter client-side — matches `ReportCard.jsx`/`IDGenerator.jsx`).
3. Fetch full `classRecords` collection once (no per-learner query — a
   `classRecords` doc holds grade data for every learner in that
   section/subject/term, so it must be filtered client-side regardless).
4. Fetch `academicRecords` docs matching the target learner(s)' LRN(s).
5. For each target learner, call `buildLearnerAcademicHistory()` to get
   their merged year-rows.
6. Render the grid per learner; print via the browser (`window.print`),
   consistent with every other printable component in this app.

## Access & security

- New `pageAccess.js` entry: `sf10Generate: ["adviser", "principal", "ictCoordinator"]`.
- `firestore.rules` currently restricts `academicRecords` reads to
  `ictCoordinator` only (`match /academicRecords/{recordId} { allow read,
  write: if hasAnyRole(["ictCoordinator"]); }`). This must widen to let
  adviser/principal **read** (not write) `academicRecords`, since they need
  to see imported history when generating SF10. Writes stay
  `ictCoordinator`-only (only the importer writes this collection).

## Error handling

- Learner with no records in either source: render the grid with a "No
  academic records found" state instead of an empty/broken table (mirrors
  `ReportCard.jsx`'s existing empty-state handling).
- A learner covered by both `classRecords` and `academicRecords` for the
  *same* `schoolYear + gradeLevel`: `classRecords` (live) wins outright;
  the imported row for that year is dropped, not merged field-by-field.
- Firestore fetch failures: same pattern as `ReportCard.jsx` — catch, log,
  show a friendly error message, don't crash the page.

## Testing

TDD on the two new pure modules (no mocks needed — plain arrays in, plain
arrays/objects out):

- `sf10Records.test.js`: live-only years, imported-only years, a learner
  with both, year overlap (live wins), empty history, sorting order.
- `subjectRows.test.js`: Grade 4-10 legacy rows unchanged from current
  `ReportCard.jsx` behavior, SHS core + elective-cluster rows unchanged.

UI wiring itself follows the existing untested pattern of
`ReportCard.jsx`/`IDGenerator.jsx` — no new UI test infrastructure
introduced.

## Out of scope

- Pixel/cell-exact reproduction of the official DepEd SF10 form (see
  Decision 3) — flagged as a follow-up once a reference template exists.
- Auto-computed promotion/retention logic (see Decision 4).
- Any year-rollover, archival, or "finalize this year into academicRecords"
  workflow (see Decision 2) — not needed for this feature, and not
  requested.
- Editing academic records from within the generator — this is a read/print
  view only; corrections go through the existing SF10 importer or direct
  Firestore edits.
