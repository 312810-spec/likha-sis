# LIKHA-SIS UX Audit

Findings only — no code changes in this phase. Feeds `DESIGN-DIRECTION.md` and the implementation order in `CLAUDE.md` §43.

## 1. Information Architecture

- **Flat sidebar, weak grouping.** ~16 top-level items plus 2 labeled sub-groups (`School Forms`, `SMEA`, `Imports`). The clear grading workflow — Class Record → Consolidated Grades → Report Card → SF10 Generator — isn't grouped, forcing teachers to hunt across an undifferentiated list.
- **Dead UI always visible.** A disabled "Future" section (Anecdotal Records, Grades, Attendance, all "(Soon)") renders for every role, every session, consuming permanent scroll space for nothing.
- **Icon map keyed by label string**, not page key — a label rename silently drops an icon. Fragile, should key by page id.
- **File placement has no rule.** 3 files in `src/components/`, 4 in `src/pages/`, ~20 page components flat in `src/` root. Not a blocking UX issue but worth a note — out of scope for this pass (would touch imports app-wide with no user-visible benefit); documented, not fixed.
- **Double-gated access.** `App.jsx` and `Sidebar.jsx` both call `canAccessPage` independently (fine, single source of truth in `pageAccess.js`), but the `App.jsx` denial screen uses raw inline hex styling instead of the shared token system — inconsistent, low-effort fix.

**Priority: HIGH** — sidebar regrouping is the single highest-leverage IA change.

## 2. Shell

- Header recomputes a live clock every second, re-rendering the full sticky header tree continuously — no user value, real (if small) performance cost. **Priority: MEDIUM**, folds into the motion/performance pass.
- Notification bell is permanently non-functional scaffolding ("You're all caught up," no data source). Leave as designed placeholder but redesign to look intentionally minimal rather than broken-looking real feature. **Priority: LOW.**
- Two independent, well-separated theming systems (`useBrandTheme` CSS vars, `useDarkMode` class + localStorage) layer correctly — **keep architecture as-is**, only touch surface tokens consumed from them.
- Back-button affordance differs between pages (pill button vs. bare text link) for the identical action. **Priority: MEDIUM**, fixed by one shared header/back-link primitive.

## 3. Design Tokens

- No spacing, radius, or shadow scale — `rounded-lg/xl/2xl` and `shadow-sm/md/xl` used ad hoc per file with no rule for which surface gets which.
- The "card" pattern (`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm`) is copy-pasted as an inline literal in nearly every file instead of a shared class/component — any visual tweak today requires N file edits.
- `inputClass`/`labelClass`/`thClass`/`tdClass` string constants are redeclared locally in multiple files (`EditLearnerModal`, `SchoolSettings`, `AccountSettings`, `ViewLearners`) — same values, no shared source.
- No shared Toast/Alert — every settings page reimplements its own colored message div for success/error state.
- `App.css` is unused Vite-starter boilerplate (`.hero`, `#next-steps`, `.ticks`) referencing CSS vars that don't exist. Dead weight in the bundle — safe to delete.
- Neutral gray scale (default Tailwind `gray-*`) is, notably, the **most consistent** part of the current system — keep it as the neutral base rather than inventing a new one.

**Priority: HIGH** — this is the multiplier. A shared token layer + a handful of shared primitives (Card, Button, Input, Table shell, Alert, PageHeader) fixes the majority of downstream inconsistency without touching business logic.

## 4. Page Patterns

- **Header composition** varies: LardoTracking/ClassRecord use a polished bordered header bar (icon badge + title + subtitle + primary action); ViewLearners/SchoolSettings/AccountSettings don't, so visual weight is inconsistent page to page. Target: one `PageHeader` primitive, adopted everywhere.
- **No shared Table primitive** despite 4+ pages (ViewLearners, ClassRecord, ConsolidatedGrades, LardoTracking) needing one — each redefines its own `thClass`/`tdClass` or bespoke grid styling.
- **No shared Tabs** — LardoTracking's Dropout Risk / Behavioral Incidents tabs are a bespoke one-off; fine to keep bespoke since it's the only current tab usage, but if a second page needs tabs, extract then.
- **Config-then-grid pattern** (setup panel → Load → dense scoring/matrix table) repeats across ClassRecord, ConsolidatedGrades, LardoTracking — this is a good, teacher-familiar pattern; the redesign should reinforce it with consistent header/toolbar treatment, not replace it.
- **SMEAEnrollment** deviates from the header convention entirely (no header bar/back-link in sampled region) — flagged for direct correction during the page pass.

**Priority: HIGH for shared primitives, MEDIUM for individual page polish.**

## 5. Print-Safety Pattern (constraint, not a defect)

Confirmed working, must be preserved exactly:
```css
@media print {
  .no-print { display: none !important; }
  body * { visibility: hidden; }
  .rc-print-area, .rc-print-area * { visibility: visible; }
  .rc-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-sizing: border-box; }
}
```
- `ReportCard.jsx`/`IDGenerator.jsx`/SF-forms hide everything, then re-reveal and absolutely-position only the print-area subtree — this is how sidebar/theme chrome gets excluded without a separate print route. **Do not touch this mechanism.**
- `IDGenerator` deliberately inherits brand primary color into the printed ID (via `rgb(var(--color-primary)/alpha)`) so IDs auto-match each school's branding — this is an intentional exception to "pure white print," confirmed as by-design, not a bug. Screen-theme redesign must not add further leakage beyond this existing, deliberate exception; `ReportCard`/SF-forms remain pure white/black as mandated.

## Priority Summary (drives implementation order)

1. Global design tokens + shared primitives (Card, Button, Input, PageHeader, Alert, Table shell) — highest leverage, unblocks everything else.
2. Sidebar IA regroup + remove dead "Future" section + fix icon keying.
3. Shell polish (shared back-link, denial-screen tokens, clock re-render fix folded into motion pass).
4. Dashboard reorganization around "what matters today / what's next."
5. Page-level adoption of shared primitives across data/table pages, then forms, then remaining settings/report pages.
6. Responsive, dark-mode, accessibility, motion passes.
7. Print-safety re-verification (regression check only — mechanism is not touched).
