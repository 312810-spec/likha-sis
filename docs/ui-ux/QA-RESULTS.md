# QA Results

## Finish Gate

Reviewed against `docs/ui-ux/DESIGN-DIRECTION.md`. Verdict below is per shipped code, not the plan.

### Verdicts by scope area

| Area | Verdict | Notes |
|---|---|---|
| Visual consistency / hierarchy / spacing | **FAIL** | Split codebase: 10 files got the full PageHeader/token treatment, 5 named in-scope files did not get it at all. |
| Navigation clarity / teacher usability | **FAIL** | Redundant "Back to Dashboard" + duplicate title/email block still shipped on the app's two highest-traffic teacher screens (ViewLearners, SF2). |
| Responsive behavior | **PASS** | No regressions found in the files that were actually converted; `PageHeader`'s flex-col→sm:flex-row pattern is responsive as designed. |
| Dark mode | **PASS** | Every class list checked pairs a `dark:` variant correctly; no light-mode-only regressions found. |
| Visual noise / animation | **FAIL** | `animate-slide-up` on page roots — the exact "flicker on every nav" pattern the design doc calls out to remove — is still present in Dashboard.jsx, SF2.jsx, LardoTracking.jsx, TransfersLog.jsx, ViewLearners.jsx, NutritionStatus.jsx, SF10Generator.jsx. |

### Ranked punch list (highest value first)

1. **Five in-scope files never got the PageHeader/header-dedup pass at all** — `src/Dashboard.jsx`, `src/ViewLearners.jsx`, `src/SF2.jsx`, `src/LardoTracking.jsx`, `src/TransfersLog.jsx`. These were explicitly named in the task scope and are the ones the design doc calls "highest visual-noise fix," but they still have the pre-redesign pattern: separate `<h1>` + icon + "Logged in as {email}" block, a standalone "Back to Dashboard" button (spec says remove globally except genuinely nested detail views — these are all top-level pages), no `PageHeader` import at all (verified: `PageHeader` is only imported by 10 files — AccountSettings, SchoolCalendar, Announcements, SF10Generator, AnecdotalRecords, ClassRecord, ConsolidatedGrades, NutritionStatus, AcademicHub, SchoolSettings). Concretely:
   - `src/ViewLearners.jsx:113-135` — duplicate loading-state header block, plus a second near-identical header block at the main return; both still say "Back to Dashboard" and repeat "Logged in as {email}."
   - `src/SF2.jsx:960-975` — same pattern, own bordered card (`shadow-sm`, not `shadow-card`).
   - `src/LardoTracking.jsx:757`, `src/TransfersLog.jsx:272` — same "Back to Dashboard" button still present.
   - This is a regression risk in reverse: nothing was removed that shouldn't have been, but the promised simplification simply didn't land on these screens, so teachers get an inconsistent app — some screens calm and deduplicated, others still busy — which is worse for a "finished" pass than leaving all screens as-is.

2. **Dashboard duplication (design doc §5) not fixed** — `src/Dashboard.jsx` still ships two competing action lists: "Quick access" inline at line 288 (inside the "School Management Overview" `SectionCard`) and a separate "Quick Actions" `SectionCard` at line 360. The design doc explicitly flags this as a "reads as the same feature to a user" problem to merge; it's unmerged.

3. **Container-width and animation tokens not applied on the untouched files** — same five files (`Dashboard.jsx`, `ViewLearners.jsx`, `SF2.jsx`, `LardoTracking.jsx`, `TransfersLog.jsx`) plus `NutritionStatus.jsx` and `SF10Generator.jsx` still carry `max-w-6xl`/`max-w-7xl` and `animate-slide-up` on the page-root div, both explicitly called out for removal in §2/§11 (the "replays on every in-app navigation" flicker). `NutritionStatus.jsx:395` in particular uses `max-w-7xl` for a page-wide table view when the token table calls for `max-w-none w-full`.

4. **Minor: `Button.jsx` component shipped but not adopted anywhere.** No file in the repo renders `<Button`. All button call sites (including the newly-touched AccountSettings.jsx save buttons at lines 286/334) still hand-roll the class string inline. Low priority per the design doc's own ordering (§7 was meant to run last / low-risk), but worth a follow-up pass before calling the button-consistency item done — right now the new component is dead code.

5. **Minor: card elevation token drift on newly-converted files.** `AccountSettings.jsx:179,296` and `SchoolSettings.jsx` inner cards use `shadow-sm` where the design doc's §9 rule is `shadow-card` for every content card. Small, but it's the exact "delete `shadow-sm` siblings" instruction the doc calls out, in files that were otherwise correctly converted.

### What's confirmed correct
- `PageHeader.jsx` and `Button.jsx` match the spec's recipe exactly (props, class strings, backTo pattern, dark-mode pairing).
- The 10 correctly-converted files (AccountSettings, SchoolCalendar, Announcements, SF10Generator's header line, AnecdotalRecords, ClassRecord, ConsolidatedGrades, NutritionStatus's PageHeader usage, AcademicHub, SchoolSettings) use the right width token, `space-y-6` rhythm, and `PageHeader` correctly — no duplicate headers, no stray "Back to Dashboard" on top-level pages.
- No evidence of a functional regression — no action/content was dropped from any converted screen; the remaining "Back to Dashboard" buttons on the unconverted screens are old code left in place, not something newly broken.
- Print-safety boundary respected: `ReportCard.jsx`, `CertificateGenerator.jsx`, `IDGenerator.jsx` print output untouched; only on-screen chrome was touched on the latter two, per scope.
