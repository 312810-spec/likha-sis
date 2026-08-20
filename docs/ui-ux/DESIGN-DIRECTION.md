# LIKHA-SIS Design Direction

Implementation-oriented. Consumes `UX-AUDIT.md`. Extends the existing token system (`src/index.css` + `tailwind.config.js`) — does not replace it. Neutral gray scale stays default Tailwind `gray-*` (already the most consistent part of the app).

## Principles
Calm, professional, teacher-first. Clarity → order → trust → efficiency. No glassmorphism, no gradient-heavy surfaces, no bouncy motion, no oversized cards. Brand color (`primary`/`accent`/`leaf`) marks meaning (primary action, active nav, selected state, status accent) — it does not paint surfaces.

## Surface Hierarchy (new)
Four levels, each a token, so every page pulls from the same ladder instead of picking `rounded-xl`/`shadow-sm` ad hoc:

| Level | Use | Light | Dark |
|---|---|---|---|
| App background | page canvas | `bg-gray-50` | `dark:bg-gray-950` |
| Content surface | page body wrapper | `bg-gray-50` (no card) | `dark:bg-gray-950` |
| Panel/card | grouped content | `bg-white border border-gray-200 rounded-lg` | `dark:bg-gray-900 dark:border-gray-800` |
| Interactive/control | inputs, table header, toolbar | `bg-gray-50 border border-gray-200 rounded-md` | `dark:bg-gray-800/60 dark:border-gray-700` |

Rules: **one `rounded-lg` for panels, one `rounded-md` for controls, no `rounded-xl`/`rounded-2xl`** anywhere new (existing call sites migrate opportunistically, not in a forced sweep). Shadows: panels get `shadow-sm` only; nothing gets `shadow-md`/`shadow-xl` except open modals/dropdowns (`shadow-lg`) — shadow communicates "floating above the page," not "this is a card."

## Typography
No font-family change. Formalize the scale that's already informally in use:

| Role | Class |
|---|---|
| Page title | `text-xl font-semibold text-gray-900 dark:text-gray-50` |
| Page description | `text-sm text-gray-500 dark:text-gray-400` |
| Section title | `text-sm font-semibold text-gray-900 dark:text-gray-100` |
| Card title | `text-sm font-medium text-gray-900 dark:text-gray-100` |
| Field label | `text-sm font-medium text-gray-700 dark:text-gray-300` |
| Body | `text-sm text-gray-700 dark:text-gray-300` |
| Supporting/metadata | `text-xs text-gray-500 dark:text-gray-400` |
| Table text | `text-sm text-gray-700 dark:text-gray-300`, header `text-xs font-medium uppercase tracking-wide text-gray-500` |

No new `text-2xl`+ anywhere in-app chrome (reserve large type for print documents only, which are already isolated).

## Shared Primitives (new files under `src/components/ui/`)
Extract, don't invent new visuals — copy the *best already-existing* instance of each pattern (per audit: LardoTracking/ClassRecord header bar; ViewLearners back-pill) into a shared component, then swap call sites.

- **`PageHeader.jsx`** — back-link pill + icon badge (`p-2 bg-accent/10 rounded-md`) + title + description + primary/secondary action slot. Replaces the 3+ divergent header patterns.
- **`Card.jsx`** — the panel-level surface from the table above, `className` passthrough for width/padding only.
- **`Button.jsx`** — variants `primary` (filled, brand), `secondary` (bordered, neutral), `ghost` (text-only, tertiary actions), `destructive` (red, always visually separated — right-aligned or divider before it). Fixed height `h-9` (`h-8` for compact table-row actions), `active:scale-[0.98]`, shared focus ring (`focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1`).
- **`Input.jsx` / `Select.jsx` / `Textarea.jsx`** — consumes the existing duplicated `inputClass`/`labelClass` constants from `EditLearnerModal`/`SchoolSettings`/`AccountSettings`, unifies them, adds consistent error-state (icon + text, not color-only) and helper-text slots.
- **`Table.jsx`** shell — `<Table>`, `<Table.Head>`, `<Table.Row>`, `<Table.Cell>` wrapping the existing `thClass`/`tdClass` values from ViewLearners (already reasonable) so ClassRecord/ConsolidatedGrades/LardoTracking can adopt the same header/row/hover/sticky-column treatment without rewriting their dense grids' internals.
- **`Alert.jsx`** — success/error/warning/info, icon-led, replaces the per-page colored-div reimplementations.
- **`EmptyState.jsx`** — icon + short line + optional action, for tables/lists with no data.
- **`Badge.jsx`** — status pill (used for LARDO risk levels, grade thresholds, etc.), consistent sizing/radius.

Everything else on a page (business logic, computation, data grid internals in ClassRecord/ConsolidatedGrades) stays untouched — this is a chrome-and-primitives extraction, not a rewrite.

## Buttons — Action Hierarchy
- Primary: one per view/toolbar, filled `bg-primary text-white`.
- Secondary: bordered `border-gray-300 text-gray-700`, used for "Cancel," "Export," etc.
- Tertiary/ghost: text-only, for low-priority inline actions (row-level "View," icon buttons).
- Destructive: red (`text-red-600 border-red-200` outline by default, filled red only on final confirm step inside a modal), always spatially separated from the primary action (left-aligned or after a divider, never adjacent-right of Save).

## Motion
150–250ms, opacity/transform/background-color/border-color/box-shadow only. Reuse existing `animate-fade-in`/`animate-slide-up` keyframes (already defined in `tailwind.config.js`) as the *only* two entrance animations app-wide — no new keyframes needed. Page content: `animate-fade-in`. Modals: fade + `translateY(4px)→0`. Dropdowns: existing `animate-fade-in`. Buttons: `active:scale-[0.98]`, no hover-scale. Respect `prefers-reduced-motion` via a global CSS rule disabling these two animations. Dashboard header clock is exempt from this pass but flagged in the audit to stop re-rendering the whole header tree every second (isolate into its own small ticking component).

## Empty/Loading States
Empty: `EmptyState` primitive (Lucide icon + one line + action if applicable). Loading: skeleton rows for tables (`animate-pulse` bars matching row height), inline spinner only inside buttons mid-submit — no full-screen blocking loaders except initial auth/session bootstrap (already exists, leave as-is).

## Dark Mode
No new dark palette — extend the surface-hierarchy table above consistently. Every new shared primitive ships both light and dark classes together (no page-specific dark overrides).

## Cleanup (low-risk, high-value)
- Delete unused Vite-starter rules from `src/App.css` (`.hero`, `#next-steps`, `.ticks`, and other selectors referencing nonexistent `--accent-bg`/`--text-h`/`--social-bg` vars) — dead weight, zero visual risk.
- Fix `App.jsx`'s inline-hex "Access Restricted" screen to use the token system.

## Explicitly Out of Scope
- `src/` vs `src/pages/` vs `src/components/` file placement (documented in audit, not fixed — would touch imports app-wide for zero user-visible gain).
- Any change to `firestore.rules`, grading/transmutation formulas, LARDO trigger logic, or auth/role logic.
- The print-safety `@media print` mechanism in `ReportCard`/`IDGenerator`/SF-forms — verified working, not touched, only regression-checked at the end.
