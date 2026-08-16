# Class Program & Teacher's Load Generator — Design

**Date:** 2026-08-17
**Status:** Awaiting review
**Module:** `ClassProgramGenerator`

---

## 1. Purpose

Tingub NHS produces two official scheduling documents each school year:

- **Class Program** — one sheet per section, showing that section's weekly timetable.
- **Teacher's Load** — one sheet per teacher, showing that teacher's weekly timetable plus workload totals, credentials, and designations.

Today both are maintained by hand in Word, which means the same facts are typed
twice and drift apart. This module makes them two renderings of a single stored
dataset, so they cannot disagree.

## 2. Source documents analysed

Both reference documents for SY 2026–2027 were parsed from `public/`:

| Document | Contents |
|---|---|
| `Tingub-NHS-Class-Program-SY-26-27.docx` | 12 sections across Grades 7–10 |
| `Tingub-NHS-Teachers-Load-S.Y.26-27.docx` | 25 teacher sheets |

Findings that shaped this design:

1. **The two documents are two views of one dataset.** A Class Program cell reads
   `Math 7 – Mrs. Camposo`; the corresponding Teacher's Load cell reads
   `MATH 7 / LOVE`. Same fact, transposed.
2. **The school runs two shifts.** Section grids start at either 6:00 (morning,
   ending 12:30) or 12:30 (afternoon, ending 6:00).
3. **Teacher grids are not uniform.** Teachers who teach across both shifts have
   irregular row boundaries (`7:00-7:30`, `11:30-12:30`, `3:30-4:15`, `4:15-5:00`)
   produced by the two shift grids overlapping. A single school-wide row template
   cannot express this.
4. **Non-teaching slots are populated, not blank.** Gaps carry a rotating cycle of
   *IMs Preparation*, *Lesson Planning*, *Checking & Monitoring of Outputs*, plus
   fixed duties such as *Advisory Functions*, *Grade Leader Function*, and
   *Khan Acad. Focal Function*.
5. **Fixed blocks vary by weekday.** *Aral Program* runs Monday–Thursday and is
   replaced by *HGP* on Friday.
6. **Placeholder teachers exist.** Several slots read `Teacher A`, meaning the
   subject is scheduled but unstaffed.

## 3. Reuse of existing data

`users[].assignments` already stores `{ role, subject, gradeLevel, section }` —
that is, *who teaches what to which section*. This module supplies only the
missing dimension: **when**. It does not rebuild teacher–subject assignment.

No `sections`, `subjects`, or `schedules` collection exists yet. Existing
collections are `learners`, `users`, `classRecords`, `academicRecords`,
`attendance`, `lardoRecords`, `disciplinaryRecords`, `transfers`, `importBatches`.

## 4. Firestore schema

A new collection, scoped by school year so a prior year's grid survives a change
in bell schedule:

```
schedules/{schoolYear}
    shifts[]            shift definitions (see §5)
    dutyCatalog[]       ancillary duty labels available for tagging
    signatories         prepared-by role, recommending, approving
    updatedAt, updatedByEmail

schedules/{schoolYear}/sections/{sectionId}
    gradeLevel, name, shiftId, adviserRef
    subjects[]          { subject, teacherRef, sessionsPerWeek }
    cells               { [periodId]: { mon: {...}, tue: {...}, ... } }

schedules/{schoolYear}/teachers/{teacherId}
    source              "user" | "adhoc"
    userId?             set when source === "user"
    displayName
    handles[]           subjects this teacher is qualified for (§7)
    bio                 { position, course, ma, eligibility,
                          firstDayOfService, yearsInDepEd }
    designations[]      e.g. "Grade 7 Adviser", "Khan Academy Focal"
    dutySlots           per-period/day overrides for non-teaching cells
```

Splitting sections and teachers into subcollections keeps every document small
(12 + 25 + 1 docs) and avoids a single grid document approaching Firestore's 1 MB
ceiling.

**The Teacher's Load grid is never stored.** It is derived on read from the
section cells (§10). Only teacher-specific extras — bio, designations, duty
overrides — persist. This is what structurally prevents the two documents from
drifting apart.

### Security rules

Per the Data-Safety Loop (CLAUDE.md §4B.4), `firestore.rules` gains a matching
block before this ships:

- **read** — any authenticated staff user.
- **write** — `ictCoordinator`, `principal`.

Advisers view and print but do not edit. Schedules contain no learner PII, so the
read rule is deliberately broader than the learner-record rules.

## 5. Shift and period configuration

Period rows are **generated** from four inputs rather than typed in, so changing
the period length re-flows every section grid and every teacher's load at once.

```
Number of shifts:  1–3   (Tingub NHS: 2)

Per shift:
    startTime         "6:00"
    periodDuration    40      minutes — the subject duration
    periodsPerDay     8
    fixedBlocks[]     { afterPeriod, label, labelByDay?, duration }
```

`afterPeriod` is the number of teaching periods that precede the block, so
`afterPeriod: 0` places it before period 1 (Flag Ceremony) and `afterPeriod: 4`
places it between periods 4 and 5 (Health Break).

Walking that sequence reproduces the reference document exactly:

```
6:00 Flag Ceremony (10m)
6:10 6:50 7:30 8:10          periods 1–4
8:50 Health Break (10m)
9:00 9:40 10:20 11:00 11:40  periods 5–8
12:20 Environmental Sanitation (10m)
12:30 end
```

`labelByDay` expresses weekday variation — *Aral Program* Monday–Thursday, *HGP*
on Friday. Shift start times are validated for overlap when more than one shift
is configured.

## 6. Sessions per week

Each subject in a section carries `sessionsPerWeek` rather than being assumed
daily. The builder derives **minutes per week per learning area**
(`sessionsPerWeek × periodDuration`) and displays it alongside each subject.

An optional `expectedMinutesPerWeek` may be set per subject, and the builder warns
when the derived figure differs. LIKHA-SIS does not hardcode a DepEd minutes
table — consistent with how `schoolConfig.shs` treats subject and cluster
catalogues as school-edited rather than assumed — so this target is entered by the
school, not shipped with the app.

Default placement auto-spreads sessions across the week — 5 → daily,
4 → M/T/Th/F, 3 → M/W/F, 2 → T/Th — and every placement is editable.

## 7. Teacher roster and subject filtering

The roster merges two sources:

- **Account-backed teachers** — resolved from `users`, pre-filled with the
  subjects and sections already in `users[].assignments`.
- **Ad-hoc entries** — free-text names for staff without a LIKHA-SIS account, and
  for placeholders such as `Teacher A`. Stored on the schedule's teacher
  subcollection, never written back to `users`.

Each teacher carries a `handles[]` list of subjects they are qualified to teach,
seeded from their existing assignments and editable. This drives **bidirectional
filtering**:

- Select a teacher → the subject palette narrows to their `handles[]`.
- Select a subject → the teacher picker narrows to staff whose `handles[]`
  contains it.

Filtering is a default, not a hard constraint: assigning outside `handles[]`
warns rather than blocks, since real timetables occasionally require it.

## 8. Builder UI

One palette and one cell model, with three ways to drive it. All three operate on
the same underlying state, so they are gestures rather than separate modes.

- **Seed (C)** — sessions/week auto-spreads subjects into the grid, filling most
  of a fresh year in one action.
- **Paint (B) — primary gesture.** Tap a subject to arm it, then click or swipe
  across cells to fill them; one gesture fills a five-day row. Touch-friendly and
  the fastest path for the common case.
- **Drag (A) — secondary affordance.** Drag a chip from the palette into a single
  cell, for precise one-off adjustments.

The page is organised as tabs: **Setup · Builder · Class Program · Teacher's Load**.

## 9. Conflict detection

Evaluated live against `(periodId, day)` across all sections in the school year:

| Conflict | Rule |
|---|---|
| Teacher double-booked | Same teacher in two sections at the same period and day |
| Section double-booked | Two subjects in one section's cell |
| Unstaffed slot | Subject placed with no teacher assigned |
| Session count mismatch | Placed sessions ≠ `sessionsPerWeek` |
| Out-of-qualification | Teacher assigned a subject outside `handles[]` (warning) |

Conflicting cells render red in the builder and are listed in a summary panel.
Conflicts do not block saving — a partially built schedule is a legitimate
intermediate state — but they are surfaced before printing.

## 10. Teacher's Load derivation

For a given teacher:

1. **Collect teaching slots** — scan every section's cells for that teacher.
2. **Build the row set** — union the shift templates of every shift they touch,
   merging and boundary-splitting overlapping rows. This is what reproduces the
   irregular boundaries seen in the reference document.
3. **Place tagged duties** — `designations[]` and `dutySlots` overrides.
4. **Fill remaining gaps** — rotate *IMs Preparation* → *Checking & Monitoring of
   Outputs* → *Lesson Planning*, cycling by weekday. Deterministic, so the same
   input always renders the same sheet.
5. **Compute totals** — see below.

Every derived cell remains click-to-override; overrides persist to `dutySlots`.

### Totals

**Total preparations** — count of distinct `subject + gradeLevel` combinations
taught. Verified against the reference document: Mrs. Camposo teaches only
Math 7 and her sheet reads `1`.

**Total hours per week** — see Open Question 14.1. Computed from an explicit
counted-slot rule and displayed with a line-by-line breakdown so the figure can be
checked before printing.

## 11. Printable output

Two printable components, both landscape:

- `ClassProgramSheet` — per section: header, `SECTION: 7 - LOVE`, the weekly grid,
  and the three-signatory block (Adviser / School Principal / PSDS).
- `TeacherLoadSheet` — per teacher: the weekly grid, totals, advisory section,
  credentials block (course, M.A., eligibility, first day of service, years in
  DepEd), designations, and signatories.

Batch print renders all 12 sections or all 25 teachers in one pass, reusing the
per-item positioning isolation established for SF10 batch mode (commit `1548afa`).

Both components hold a pure white background under `@media print` with no dark or
brand theme leakage, per the print-safety mandate in CLAUDE.md §2.

## 12. Module structure

Pure logic in `utils/`, React kept thin — following the `subjectRows.js`
extraction pattern.

| File | Responsibility |
|---|---|
| `src/utils/scheduleModel.js` | Shift definitions, period row generation, cell helpers |
| `src/utils/scheduleConflicts.js` | All conflict rules in §9 |
| `src/utils/teacherLoadDerivation.js` | Grid derivation, duty rotation, totals |
| `src/ClassProgramGenerator.jsx` | Page shell and tab routing |
| `src/components/schedule/ScheduleGrid.jsx` | Shared editable grid (paint + drag) |
| `src/components/schedule/SubjectPalette.jsx` | Filtered palette (§7) |
| `src/components/schedule/ClassProgramSheet.jsx` | Printable section sheet |
| `src/components/schedule/TeacherLoadSheet.jsx` | Printable teacher sheet |

## 13. Access control

New `pageAccess.js` key `classProgram`:

```js
classProgram: ["ictCoordinator", "principal", "adviser", "masterTeacher"]
```

Edit capability is gated separately inside the page to `ictCoordinator` and
`principal`, matching the Firestore write rule. Advisers and master teachers get
read and print.

Routing follows the existing single-page `currentPage` string state in `App.jsx`.
React Router is not used, per CLAUDE.md §2.

## 14. Open questions

### 14.1 Total hours per week formula

Mrs. Camposo's reference sheet reads **21h 40m** = 1300 min = 260 min/day. Her
grid spans 6:00–3:00. Neither the full span, the span minus breaks, teaching slots
alone, nor teaching plus tagged duties reproduces 260 min/day.

Rather than hardcode a formula that would silently print an incorrect figure on an
official document, the total is computed from an explicit counted-slot rule —
default: teaching slots plus tagged ancillary duties, excluding breaks and
preparation blocks — and rendered with a visible breakdown.

**Needs confirmation:** the DepEd rule behind 21h 40m. Once known, it will be
encoded directly and the breakdown kept as verification.

## 15. Out of scope

- Automatic timetable solving. Placement is user-driven with conflict guarding.
- Editing teacher–subject assignment, which remains in User Management.
- Substitution, leave, or day-specific schedule overrides.
- Room or facility allocation.

## 16. Testing

Vitest, following the existing `src/utils/__tests__` convention. TDD per the
project workflow.

- **`scheduleModel`** — row generation across durations and start times; fixed
  block insertion; per-weekday label variation; overlap validation.
- **`scheduleConflicts`** — each rule in §9, including the non-daily case where a
  free day is not a conflict.
- **`teacherLoadDerivation`** — single-shift and straddling-shift row sets;
  boundary splitting; rotation determinism; preparation count verified against the
  reference document; totals breakdown.

Verification gate: `npm run lint && npm run test` must pass (CLAUDE.md §4B.2–3).
