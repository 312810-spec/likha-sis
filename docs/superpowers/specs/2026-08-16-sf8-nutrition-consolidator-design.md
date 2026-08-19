# SF8 Height-for-Age + Baseline/Endline Nutrition Consolidator — Design

**Date:** 2026-08-16
**Status:** Approved, ready for implementation planning

## Problem

`NutritionStatus.jsx` already implements per-section SF8 entry, save, and print,
classifying BMI-for-age only (`nutritionComputations.js` /
`bmiForAgeTable.js`). Two DepEd requirements aren't covered:

1. **Height-for-Age (HFA) / stunting classification doesn't exist anywhere in
   the codebase.** The DepEd SF8 form and the school-wide nutrition report
   both require it (Severely Stunted / Stunted / Normal / Tall) alongside
   BMI-for-age.
2. **There is no school-wide rollup report.** `public/TingubNHS-BASELINE-NS-CONSO-2026-2027.xlsx`
   (a real DepEd Nutritional Status Baseline Report already used at Tingub
   NHS) aggregates every section's counts — Enrolment, Pupils Weighed, and
   both BMI and HFA category counts, split Male/Female/Total — into one
   printable, signed document. Nothing in LIKHA-SIS currently produces that
   from the per-learner data already being saved.
3. **`nutritionRecords` has no baseline-vs-endline dimension.** DepEd's own
   program (confirmed by "Pretest"/"Posttest" naming inside the SF8
   workbook's hidden helper sheet) measures every learner twice a year: once
   at the start of the school year (Baseline/Pretest) and once near the end
   (Endline/Posttest). The current doc id (`learnerId_schoolYear`) can only
   hold one measurement per learner per year — a second save overwrites the
   first via `merge: true`.

## Source data findings

`public/School Form 8 SF8 Learner Basic Health and Nutrition Report.xlsx`
contains a `veryHidden` sheet named "Sir Wedz Helper Tables"
(`xl/worksheets/sheet1.xml` in the unzipped `.xlsx`) with a WHO
Height-for-Age reference table at columns `BV:CJ`, rows 5–173 — the exact
same 169-row age range (60–228 months) as the existing
`BMI_FOR_AGE_TABLE`. Confirmed from the sheet's own `VLOOKUP($age,
$BV$5:$CJ$173, ...)` formulas:

- `BV` = age in months (lookup key)
- `BX` = boys' Severely-Stunted-max height (m); `BZ` = boys' Stunted-max;
  `CB` = boys' Normal-max (above this = Tall). (`BY`/`CA`/`CC` are Excel's
  paired "just-above" boundary values for its own VLOOKUP mechanics — not
  additional data; only `BX`/`BZ`/`CB` are needed.)
- `CE`/`CG`/`CI` = the same three cutoffs for girls.

Values are raw height in meters, the same unit already captured in
`nutritionRecords.heightM` — no z-score math needed, same shape as
`BMI_FOR_AGE_TABLE`'s "N cutoffs → N+1 categories" convention.

## Decisions

1. **Extend `nutritionRecords`, don't create a new collection.** Add a
   `period` field (`"Baseline" | "Endline"`) and change the doc id to
   `${learnerId}_${schoolYear}_${period}`. Existing records saved this year
   without a period are a known one-time migration gap — not backfilled;
   they simply stop being reachable by the new id scheme and re-entry is
   expected (measurement data, not something to script-migrate blind).
   Rejected: a second collection (`nutritionEndlineRecords` etc.) — pure
   duplication of schema, rules, and query logic for what is structurally
   the same record with one more field.

2. **HFA classification lives next to BMI classification**, not as a
   separate flow. `classifyHeightForAge(heightM, ageInMonths, sex)` in
   `nutritionComputations.js`, mirroring `classifyNutritionalStatus()`
   exactly (same age-fallback-to-nearest-row behavior, same sex
   normalization). Table lives in `src/utils/hfaForAgeTable.js`, structured
   like `bmiForAgeTable.js`: `[ageInMonths, boysSeverelyStuntedMax,
   boysStuntedMax, boysNormalMax, girlsSeverelyStuntedMax, girlsStuntedMax,
   girlsNormalMax]`. Classification: `height <= severelyStuntedMax` →
   Severely Stunted; `<= stuntedMax` → Stunted; `<= normalMax` → Normal;
   else → Tall.

3. **`nutritionRecords` payload gains `heightForAgeStatus`** alongside the
   existing `nutritionalStatus`, computed and saved the same place
   (`NutritionStatus.jsx`'s `handleSave`).

4. **New `src/utils/nutritionConsolidation.js` (pure, new)** —
   `consolidateBySection(learners, nutritionRecords, { schoolYear, period })`
   → array of `{ gradeLevel, section, enrolment: {M,F,T}, weighed: {M,F,T},
   bmi: { severelyWasted: {M,F,T}, wasted: {...}, normal: {...},
   overweight: {...}, obese: {...} }, hfa: { severelyStunted: {...},
   stunted: {...}, normal: {...}, tall: {...} } }`, plus a `grandTotal` row
   with the same shape. Groups by `gradeLevel + section` from the full
   `learners` collection (so Enrolment counts every learner, weighed or
   not — matching the template, which distinguishes Enrolment from Pupils
   Weighed).

5. **New `src/NutritionConsolidator.jsx`** (sibling to
   `ConsolidatedGrades.jsx`, `NutritionStatus.jsx`). Picks School Year +
   Period (Baseline/Endline), fetches the full `learners` and
   `nutritionRecords` collections once (same fetch-all-filter-client-side
   pattern as every other rollup in this app), calls
   `consolidateBySection()`, and renders the DepEd-format grid: one row per
   section (ordered by `gradeLevelsOffered`, sections within a grade in
   whatever order `useAvailableSections` already returns), a Grand Total
   row, and a signature block (Prepared by: Clinic Teacher / Submitted by:
   Principal). Print CSS follows the established `.no-print` /
   `.nc-print-area` idiom, pure white `@media print` background — needs a
   `print-safety-audit` pass before being considered done, like every other
   printable component here.

6. **`NutritionStatus.jsx` gains a Period selector** (Baseline/Endline) in
   its existing filter bar, next to Grade Level / Section / School Year /
   Measurement Date. Everything else (load, save, print) is unchanged
   except the doc id and the two computed statuses. The printable SF8
   block gains an HFA column next to the existing BMI Category column.

7. **`schoolConfig` gains `clinicTeacherName`**, alongside the existing
   `principalName`/`principalPosition` pattern, editable in
   `SchoolSettings.jsx` the same way. `NutritionConsolidator.jsx`'s
   "Prepared by" line uses it; "Submitted by" reuses `principalName`.

8. **Access: `adviser`, `smeaCoordinator`, `principal`.** Matches
   `nutritionStatus`'s existing `["adviser", "smeaCoordinator"]`, plus
   `principal` — the consolidator is the document principals sign
   ("Submitted by"), so they need to view/print it, not just receive a
   paper copy. `firestore.rules`' current `nutritionRecords` rule
   (`allow read, write: if hasAnyRole(["adviser", "smeaCoordinator"])`)
   doesn't include `principal` at all, so this requires a rule change (see
   Architecture) — splitting into a wider `read` and an unchanged `write`,
   the same read/write split the SF10 spec used for `academicRecords`:
   principals read the consolidated view but don't record measurements.

## Architecture

Read/write pattern for `NutritionStatus.jsx` is unchanged (still the only
writer of `nutritionRecords`). `NutritionConsolidator.jsx` is read-only, like
`ConsolidatedGrades.jsx` and `SF10Generator.jsx` — no new Firestore writes.

```
src/utils/hfaForAgeTable.js          (new, pure data)
src/utils/nutritionComputations.js   (+classifyHeightForAge)
src/utils/nutritionConsolidation.js  (new, pure logic)
src/NutritionStatus.jsx              (+period selector, +HFA column/save)
src/NutritionConsolidator.jsx        (new component)
src/schoolConfig.js                  (+clinicTeacherName)
src/SchoolSettings.jsx               (+Clinic Teacher Name field)
src/pageAccess.js                    (+nutritionConsolidator entry)
firestore.rules                      (nutritionRecords rule splits into
                                       `allow read: if hasAnyRole(["adviser",
                                       "smeaCoordinator", "principal"])` and
                                       `allow write: if hasAnyRole(["adviser",
                                       "smeaCoordinator"])`, so principal
                                       gains read for the Consolidator
                                       without gaining write)
```

## Data flow (Consolidator)

1. User picks School Year + Period (Baseline/Endline).
2. Fetch full `learners` collection once; fetch full `nutritionRecords`
   collection once, filtered client-side to matching `schoolYear` + `period`.
3. `consolidateBySection()` groups by grade+section, counts Enrolment (every
   learner) vs. Pupils Weighed (learners with a valid record for that
   period), and tallies BMI/HFA category counts by sex.
4. Render one table row per section in `gradeLevelsOffered` order, a Grand
   Total row, and the signature block.
5. Print via `window.print()`, consistent with every other printable
   component.

## Error handling

- No `nutritionRecords` for the selected period yet: render the grid with
  zeros (Enrolment still populates from `learners`; Pupils Weighed and all
  category counts show 0) rather than an empty/broken state — mirrors how
  the template itself looks before any data entry.
- A learner with a record whose `heightM`/`weightKg` didn't pass validation
  at save time never got a status in the first place (existing
  `NutritionStatus.jsx` behavior); such learners count toward Enrolment but
  not Pupils Weighed.
- Firestore fetch failures: catch, log, friendly error message — same
  pattern as every other component in this app.

## Testing

TDD on the three new/changed pure modules (no mocks — plain arrays/objects
in, plain objects out):

- `hfaForAgeTable.test.js` or folded into `nutritionComputations.test.js`:
  `classifyHeightForAge()` boundary cases per sex, age-fallback-to-nearest
  behavior (mirrors existing `classifyNutritionalStatus` tests), out-of-range
  ages.
- `nutritionConsolidation.test.js`: single section, multiple sections,
  multiple grades, a learner with no record (counts toward Enrolment only),
  a learner with an invalid/unweighed record, Grand Total arithmetic,
  Baseline vs. Endline period filtering isolation (an Endline record must
  never appear in a Baseline consolidation and vice versa).

UI wiring (`NutritionConsolidator.jsx`, the `NutritionStatus.jsx` period
selector) follows the existing untested pattern of every other
report/generator component in this app.

## Out of scope

- Backfilling/migrating existing `nutritionRecords` docs saved before the
  `period` field existed — re-entry is expected, not scripted.
- Any measurement period beyond Baseline/Endline (e.g. a mid-year check) —
  not part of DepEd's actual protocol, not requested.
- Editing nutrition records from within the Consolidator — read/print only,
  same boundary `SF10Generator.jsx`'s design draws for academic records.
- Auto-flag / LARDO triggering changes — `checkAutoFlagTriggers` already
  fires off `nutritionalStatus` in `NutritionStatus.jsx`'s save path; HFA
  status is not wired into that trigger (DO 006/DO 15 mandates don't
  reference stunting), and this spec doesn't add it.
