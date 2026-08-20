# LIKHA-SIS Design Direction — Phase 2 (UI Designer)

Consumes the Phase 1 UX audit findings (P0–P2, listed below each item this doc addresses).
Scope: visual/interaction treatment only. No new deps, no IA changes, no new theming
mechanism — reuse `useDarkMode()` / `useBrandTheme()`, `tailwind.config.js` tokens, and
`src/components/settings/settingsStyles.js`. Read-only guidance; implementer does the edits.

Reference tokens already defined (do not redefine):
- Colors: `primary` / `accent` / `leaf` / `paper` / `ink` (Tailwind, CSS-var backed)
- Fonts: `font-display` (Fraunces, h1/h2 page titles ONLY), `font-sans` (Public Sans, everything else), `font-mono` (tabular numerals)
- Shadows: `shadow-card`, `shadow-card-hover`
- Motion: `animate-fade-in` (200ms), `animate-slide-up` (200ms), press feedback `active:scale-[0.97–0.99]`
- `src/components/settings/settingsStyles.js`: `inputClass`, `labelClass`, `cardClass`, `primaryButtonClass`

---

## 1. Canonical page header (addresses Audit #1, #2, #5)

`DashboardShell.jsx` already renders `pageTitle` (font-display h2) + "Welcome, {user}" in
its sticky top header (lines 96–100). Every page body must NOT repeat a title/user-identity
row. Replace all per-page `<h1>` + icon + "Logged in as {email}" blocks with a single
**in-content header row** that supplies what the shell does not: a one-line page
description and the primary action(s)/context selectors for that screen.

**New shared component to introduce:** `src/components/PageHeader.jsx`

```jsx
// Props: description (string, required), actions (ReactNode, optional),
// backTo (ReactNode label + onClick, optional — see rule below), children (context selectors, optional)
export default function PageHeader({ description, actions, backTo, children }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div className="min-w-0">
        {backTo && (
          <button
            type="button"
            onClick={backTo.onClick}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light mb-1 transition-colors"
          >
            <ArrowLeft size={14} /> {backTo.label}
          </button>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
        {children && <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
```

Usage pattern for every one of the ~15 pages listed in audit #1 (ViewLearners, SF2,
SchoolSettings, AcademicHub, LardoTracking, TransfersLog, NutritionStatus,
ConsolidatedGrades, ClassRecord, AnecdotalRecords, SF1, SF10Generator, Announcements,
SchoolCalendar, AccountSettings):

```jsx
<PageHeader
  description="Section 7-Rizal — School Year 2026–2027, Term 1"
  actions={<button className={primaryButtonClass}>Export CSV</button>}
>
  {/* term/section/grade-level selectors go here, replacing separate selector cards */}
</PageHeader>
```

- Delete the redundant `<h1>` + icon + "Logged in as {email}" markup outright — do not
  relocate the icon elsewhere. The icon added no scannable information; the shell title
  already carries the page name.
- **"Back to Dashboard" (#2):** remove globally. The sidebar is always visible/available per
  Phase 1 IA findings, so a back-to-dashboard affordance is redundant on every top-level
  page. Keep `backTo` in `PageHeader` only for genuinely nested detail views reached by
  drilling into a row (e.g. a single learner's LARDO case file opened from LardoTracking,
  a single announcement's detail view) — those get a `backTo` pointing to the parent list,
  not to the dashboard.

## 2. Container width tokens (Audit #3)

Exactly two width tokens. Apply as the outermost wrapper *inside* each page component;
do not add page-level padding — `DashboardShell`'s `<section className="p-4 md:p-6">`
(shell line 239) already owns that.

| Token | Class | Use for |
|---|---|---|
| `page-wide` | `max-w-none w-full` (i.e. no cap — let tables/grids use the full shell width) | ViewLearners, SF2, ConsolidatedGrades, ClassRecord, LardoTracking, TransfersLog, AcademicHub, Announcements, SchoolCalendar, Dashboard |
| `page-narrow` | `max-w-3xl mx-auto w-full` | SchoolSettings tabs, AccountSettings, SF1/SF10 single-form generators, NutritionStatus single-learner form, AnecdotalRecords entry form |

Delete every other max-width variant in play (`max-w-7xl`/`6xl`/`5xl`/`4xl`/`2xl`) and any
page-local `p-4`/`p-6`/`px-*`/`py-*` applied to the outermost page div — that's the double
padding referenced in the audit. `SchoolSettings.jsx`'s current wrapper is the reference
example for `page-narrow`.

## 3. Section vertical rhythm (Audit #4)

One token: **`space-y-6`** on the direct-children stack of every page's root content div
(the same div that carries the width token from §2). Remove all `space-y-5`, `space-y-4`,
and ad-hoc `mt-4`/`mt-6` spacers between sibling sections — replace with the parent
`space-y-6` doing the job. Within a single card's internal stack (label+input groups etc.),
`space-y-4` remains correct and is unaffected — this token is for *section-to-section*
rhythm on the page, not intra-card field spacing.

## 4. Header defragmentation (Audit #5)

SF2, ClassRecord, LardoTracking, TransfersLog currently stack 3–4 separate cards for
title / term selector / section selector / action button. Collapse into one `PageHeader`
(§1) row: description on the left, context selectors as `children` (rendered as a
flex-wrap row of `settingsStyles.inputClass`-styled `<select>`s, label-less, each preceded
by a small `text-xs text-gray-500` inline label if truly needed), primary action(s) in
`actions`. No separate bordered card wrapping the selectors — they sit directly in the
header row per the JSX shape in §1.

## 5. Dashboard duplication (Audit #6)

`Dashboard.jsx`:
- Keep exactly one stat summary: the `StatTiles` row. Delete the second `SectionCard`
  that repeats the same numbers in mini-card form — if any single number there doesn't
  exist in `StatTiles`, add that one metric to `StatTiles` instead of keeping a second
  block.
- Keep exactly one "Quick Actions" block. If the two existing blocks differ in which
  actions they expose, merge into a single list; do not keep a "Quick access" and a
  "Quick Actions" section side by side under different names — they read as the same
  feature to a user.

## 6. Card nesting (Audit #7)

Maximum **one** border/shadow level of card nesting. A card (`cardClass` from
settingsStyles, or `rounded-xl border border-gray-200 dark:border-gray-700 shadow-card`
per §7) may contain plain `<div>` groupings with spacing only — never a second card with
its own border+shadow inside a card. Where AnecdotalRecords, LardoTracking,
BrandingSettings, SetupWizard currently nest 3 levels:
- Outer card: real card (border + shadow-card).
- Middle "card": become a plain `<div className="space-y-3">` or, if visual grouping is
  still needed, a flat separator (`border-t border-gray-100 dark:border-gray-800 pt-4`)
  instead of a full bordered box.
- Innermost card: same flattening, or fold into the parent entirely if it was only ever
  wrapping one field group.

## 7. Buttons (Audit #8)

Two sizes × three variants. Base recipe from `.impeccable/design.json`'s locked Primary
Button component and `settingsStyles.primaryButtonClass` — do not invent a new recipe.

```
Base (all):  inline-flex items-center gap-2 rounded-lg font-semibold transition-all
             active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
Size default: px-5 py-2.5 text-sm
Size small:   px-3 py-1.5 text-xs

Variant primary:   bg-primary text-white shadow-sm hover:bg-primary-light
Variant secondary: bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
                    border border-gray-200 dark:border-gray-700
                    hover:bg-gray-50 dark:hover:bg-gray-700
Variant danger:    bg-red-600 text-white shadow-sm hover:bg-red-700
```

**New shared component:** `src/components/Button.jsx` exporting
`<Button variant="primary|secondary|danger" size="default|small" ...props>`, composing the
class strings above (variant+size template literal, no new tokens). Every one of the "8
different primary-button padding combos" call sites gets swapped to this component.
`settingsStyles.primaryButtonClass` can become a thin re-export of
`<Button variant="primary">`'s class string to avoid a second source of truth, or stay as
today's constant if `Button.jsx` imports and reuses it directly — implementer's call,
either avoids drift.

## 8. Inputs / selects (Audit #9)

No new input styling. Every inline-redeclared `<input>`/`<select>`/`<textarea>` class list
across the ~25 files gets replaced with `inputClass` (and paired `<label className={labelClass}>`)
imported from `src/components/settings/settingsStyles.js`. That file's exports move in
spirit from "School Settings only" to "the app's input primitive" — no code change needed
to the file itself, just wider adoption. If a screen needs a `<select>` with no visible
label (inline filter bars, per §4), still use `inputClass` for the control, just skip the
`labelClass` wrapper.

## 9. Card radius / elevation (Audit #10)

One rule: **`rounded-xl` + `shadow-card`** (resting) for every content/stat card,
**`hover:shadow-card-hover`** only on cards that are themselves interactive (clickable
rows, nav-style cards) — not on static stat tiles (see §11 on removing hover-lift from
non-interactive tiles). Delete `rounded-2xl` and `rounded-lg` outliers on cards; delete
`shadow-sm`/`shadow-2xs`/borderless-no-shadow siblings — every card gets the same
`border border-gray-200 dark:border-gray-700 rounded-xl shadow-card` combination
regardless of screen. This matches the locked `.ds-card` recipe in
`.impeccable/design.json` (12px/`rounded-xl`-equivalent radius, `shadow-card` value) —
do not diverge from it.

## 10. Tables (Audit #11)

Standardize row height to `py-3` (cell padding `px-4 py-3`) and header row to
`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400`
across all data tables reachable from this change. Remove one-off row-height and bleed
hacks that diverge from this.

**Explicit exclusions — do not touch:** `.sf2-table` and any SF1/SF10/TeacherLoadSheet
print-oriented table styles. Those are governed by print-safety layout constraints, not
this screen-density pass. Leave their CSS/classes exactly as-is.

## 11. Decorative treatments — remove (Audit #12)

- **Remove** `animate-slide-up` from page root elements (~20 pages). It replays on every
  in-app navigation since these are persistent mounted routes via `currentPage` string
  state, not real route transitions — the audit is correct that this reads as flicker, not
  polish. `animate-fade-in` may stay on transient overlays (dropdowns, modals, toasts)
  where it fires once per open, which is the existing correct use in `DashboardShell.jsx`
  (notification/profile dropdowns, lines 174 and 204) — do not touch those.
- **Remove** `hover:-translate-y-0.5` (or any lift transform) from stat tiles and other
  non-interactive display-only cards. Keep `hover:shadow-card-hover` + lift only on cards
  that navigate or open something on click (per §9).
- **Remove** decorative icon-chip badges placed next to section headings purely for visual
  texture (a colored circle/square containing an icon, adjacent to an `<h2>`/`<h3>`, with
  no click target and no unique information). Keep icons only when they sit inside an
  interactive control (a button, a nav item) or convey status (a colored dot for
  active/inactive, a warning triangle for a flagged row) — decorative-only chips go.
- Respect `index.css`'s print-safety block (~lines 144–160) and reduced-motion block
  (~lines 188–201) as immovable — no edit touches those regions, and no animation added
  anywhere in this pass may be exempt from the existing `prefers-reduced-motion` rule.

## 12. Dark mode call-outs

- Every class list in §§1–11 already includes a `dark:` pairing consistent with existing
  usage (`bg-white dark:bg-gray-900`, `border-gray-200 dark:border-gray-700`, etc.) — this
  mirrors current `DashboardShell.jsx`/`SchoolSettings.jsx` conventions, do not introduce a
  new dark-mode palette.
- `PageHeader`, `Button`, and any flattened card-nesting replacement divs must carry `dark:`
  variants on first implementation, not as a follow-up pass — there is no separate
  "add dark mode" step in this project's convention.
- Brand-theme (`useBrandTheme()`) recoloring flows through the existing `primary`/`accent`/
  `leaf` CSS-var-backed Tailwind classes automatically; nothing in this direction hardcodes
  a hex value, so no brand-theme-specific work is needed beyond using those token classes
  as specified.

## 13. Print-safety call-out (non-negotiable)

None of the components/patterns in this document apply to `ReportCard`, `CertificateGenerator`,
`IDGenerator`, SF1/SF2/SF4 print output, or `NutritionStatus`'s printable output — those stay
governed entirely by the existing `@media print` pure-white rule in `index.css` (~lines
144–160). Specifically:
- `PageHeader` (§1) is a screen-chrome-only component. Printable documents keep their own
  self-contained print layout with no shell/header dependency — do not wrap a printable
  component's print output in `PageHeader`.
- The card radius/elevation rule (§9) and table rule (§10) apply to on-screen data grids
  only; printed table/cell styling (`.sf2-table`, SF1/SF10 sheets) is explicitly excluded
  per §10 and must not be reflowed to match the on-screen `py-3` row height.
- If any of these printable components also render an on-screen "preview" wrapper (title,
  action buttons, back link) before the printable area, that surrounding chrome may adopt
  `PageHeader`/`Button` — but the printable node itself (the element actually rendered
  under `@media print`) must remain untouched by this pass.

---

## Implementation order suggestion (for the implementer, not binding)

1. Ship `PageHeader.jsx` and `Button.jsx` as new files.
2. Sweep the ~15 header-duplication pages (§1) — highest visual-noise fix, self-contained per file.
3. Apply container width + section-gap tokens (§§2–3) in the same pass per file (touches same lines).
4. Fix Dashboard duplication (§5) — isolated, single file.
5. Flatten nested cards (§6) on the four call-out files.
6. Swap inline buttons/inputs to `Button`/`inputClass` (§§7–8) app-wide — mechanical, low-risk, can run last since it's non-structural.
7. Table row-height pass (§10), excluding print tables.
8. Decorative-treatment removal (§11) — quick grep-driven cleanup of `animate-slide-up`, `-translate-y-0.5`, decorative icon chips.
