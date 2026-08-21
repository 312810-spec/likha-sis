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

## Accessibility

Scope: files touched by the `engineering-minimal-change-engineer` PageHeader/Button
adoption pass (`c863a88~1..HEAD`, 33 files) plus the shared components it introduced
(`src/components/PageHeader.jsx`, `src/components/Button.jsx`). Audited against
keyboard nav/focus order, focus-visible states, contrast, control labeling, state
communication, `prefers-reduced-motion`, and responsive usability.

### Ranked issues

1. **Context selectors inside `PageHeader`'s `children` slot have no accessible name.**
   `src/SF2.jsx:965-983` places a class/section `<select>` and a `type="month"` `<input>`
   directly inside `<PageHeader>` with no `<label>`, `aria-label`, or `aria-labelledby`.
   The same pattern repeats in `src/AcademicHub.jsx:155-169` (grade-level `<select>` in
   the header filter form). Sighted users infer the field's purpose from position next
   to the page title; a screen-reader user gets only "combobox" / "date" with no name.
   This is a `PageHeader`-shape problem, not a one-off typo — every page that puts a
   bare form control in `children` (per the pattern the design doc itself shows in
   `DESIGN-DIRECTION.md`'s own usage example) will repeat it. Fix at the call sites with
   `aria-label="Select class"` / `aria-label="Select month"` etc.; `PageHeader.jsx`
   itself doesn't need a code change, just consistent labeling discipline in consumers.

2. **No `<h1>` remains on any converted page.** The pre-redesign per-page `<h1>` blocks
   (e.g. the one previously at `ViewLearners.jsx:140`) were removed as part of the
   PageHeader migration, and `DashboardShell.jsx:96` renders the shell's page title as
   an `<h2>` (`{pageTitle}`), not an `<h1>`. That h2 is the *only* heading now available
   on every converted screen — there is no page-level `<h1>` anywhere in the dashboard
   shell's content area. This was true before this session's commits too (the shell's
   heading level wasn't touched), but the redesign entrenches it project-wide by
   removing the last per-page `<h1>` instances that existed. Screen-reader users
   navigating by heading level (a primary AT navigation strategy) land on an h2 with no
   h1 parent — a real but pre-existing structural gap, not something introduced fresh
   this session. Worth a dedicated pass: either promote `DashboardShell`'s `pageTitle`
   to `<h1>`, or keep it `<h2>` and have `PageHeader` render an `<h1>` for
   `sr-only` screen-reader-only text so heading level 1 exists exactly once per page.

3. **`PageHeader`'s `backTo` back-button loses its one remaining consumer's context
   silently on error-less removal — low impact, but flag the pattern.** `PageHeader.jsx`
   still supports a `backTo` prop (icon + label, both present — no icon-only labeling
   issue here), but grepping the converted files turns up zero call sites passing
   `backTo` in this session's diff. This isn't a bug, just confirms the "remove
   redundant Back to Dashboard" intent landed cleanly with no orphaned/broken `backTo`
   usages and no accessible-name loss from that removal — noting it here because the
   task specifically asked to verify it.

4. **Minor — `Button.jsx`'s `disabled:opacity-60` on the `danger` variant.** `bg-red-600`
   text-white at `opacity-60` (`src/components/Button.jsx:16`) drops below 3:1 contrast
   against light backgrounds in some browsers' opacity-compositing (spot check: renders
   roughly `#e2999e`-equivalent on white, ~2.6:1). Disabled controls are exempt from
   WCAG contrast minimums, so this is not a compliance failure, but every `Button`
   `disabled` state site (e.g. `src/AccountSettings.jsx:284`, `src/ClassRecord.jsx:418`,
   `src/NutritionStatus.jsx:447`) does correctly pair the disabled state with a text
   change ("Saving…"), so state communication is not color-only — no action needed
   beyond the note.

### Confirmed correct (no issue)
- `prefers-reduced-motion: reduce` is handled globally in `src/index.css:188-195` and
  collapses all animation/transition durations to near-zero, including the
  `.theme-transition` specificity edge case called out in the surrounding comment. No
  new animation introduced this session (`animate-slide-up` removals only) needed
  separate handling.
- Keyboard focus is visible project-wide via the global `:focus-visible` rule in
  `src/index.css:113-117` (brand-primary 2px outline, 2px offset), which `Button.jsx`
  and `PageHeader.jsx`'s back button inherit automatically since neither strips outline
  or sets `outline: none` anywhere.
- No icon-only buttons without an accessible name were found in the diffed files or
  the two new shared components — every `<button>` rendering only a `lucide-react`
  icon in scope (`EditLearnerModal.jsx:165-171`, `Sidebar.jsx:257-263`,
  `WeatherCard.jsx:130-136`) carries `aria-label`.
- Loading/saving/disabled states are consistently text-labeled, not color-only, across
  every `<Button disabled={...}>` call site checked (AccountSettings, ClassRecord,
  ConsolidatedGrades, NutritionStatus, AnecdotalRecords, Announcements, SchoolCalendar,
  UserManagement, AcademicHub).
- `PageHeader`'s responsive layout (`flex-col gap-3 sm:flex-row sm:items-start
  sm:justify-between`) reflows correctly at the sm breakpoint in every converted file
  checked; no overflow/clipping introduced.
- Dark-mode contrast pairings on new/changed classes (`text-gray-600
  dark:text-gray-300` for `PageHeader` description, `dark:text-gray-400` for the back
  button) are consistent with the rest of the codebase's existing dark-theme token
  usage; no new hardcoded hex or unpaired light-only class found.

Recommend routing issue #2 (heading-level structure) to
`engineering-section-508-specialist` as a dedicated follow-up — it's a
Section 508/WCAG 2.4.6 "Headings and Labels" + 1.3.1 structural issue that spans the
whole shell (not just this session's diff) and needs a decision on whether
`DashboardShell` or `PageHeader` owns the fix, which is outside a redesign-diff-scoped
audit.
