---
name: print-safety-audit
description: >-
  Audits LIKHA-SIS printable components for the print-safety boundary
  mandate in CLAUDE.md Section 2 (pure white background under @media print,
  no dark/brand theme leakage). Use whenever ReportCard.jsx,
  CertificateGenerator.jsx, IDGenerator.jsx, SF1.jsx, SF2.jsx, SF4.jsx, or
  NutritionStatus.jsx change, or when asked to review/verify a printable
  document, ID card, certificate, or form.
metadata:
  category: LIKHA-SIS Domain
---

# Print Safety Boundary Audit

Every printable component in this codebase (`ReportCard`, `CertificateGenerator`,
`IDGenerator`, and the print-capable school forms `SF1`, `SF2`, `SF4`,
`NutritionStatus`) must render on pure white regardless of the app's active
screen theme (dark / light / brand). This skill verifies that boundary holds.

## 1. Find the print styles
Grep the target file for `@media print`. The established pattern (see
`IDGenerator.jsx` around its `<style>{...}</style>` block) is:
* `.no-print { display: none !important; }` to hide screen-only chrome
* `body * { visibility: hidden; }` then `.<print-area>, .<print-area> * {
  visibility: visible; }` to isolate only the printable region
* The print area repositioned via `position: absolute; left: 0; top: 0;`

Confirm the target component follows this same isolation pattern rather than
inventing a new one.

## 2. Verify no theme leakage
Two patterns are both valid in this codebase — check for *either* before
flagging a component as leaking:
* **Hard-coded inline style**: the print area's background/text set via
  inline styles or hard-coded hex/white values (e.g. `backgroundColor:
  "#fff"`), independent of any dark-mode class. Used by `ReportCard.jsx`,
  `CertificateGenerator.jsx`, `IDGenerator.jsx`, `SF1.jsx`, `SF2.jsx`.
* **CSS override selector**: a rule scoped to `html.dark .<print-area>,
  html.dark .<print-area> *` inside the `@media print` block that forces
  `background-color`/`color`/`border-color` back to plain black-on-white
  with `!important`, overriding whatever `dark:` Tailwind classes are on
  the element. Used by `SF4.jsx` (see its `@media print` block). This
  works because `useDarkMode.js` toggles a literal `dark` class on
  `document.documentElement` — confirm that's still true
  (`root.classList.toggle('dark', ...)` in `useDarkMode.js`) before relying
  on this pattern's validity.

A component fails this check only if it has `dark:` classes inside its
print area with **neither** pattern present — plain unguarded `dark:`
classes and no inline hard-coding and no `html.dark` override block.

* Any `rgb(var(--color-primary) / …)` brand-color usage is fine for accents
  (borders, gradients) as long as the base background stays white/transparent
  over white — it must not become the dominant fill color.

## 3. Manual verification
Since this is visual, after any fix: start the dev server (see `run` skill/
`npm run dev`), open the component, toggle dark mode ON in the app shell,
open the browser print preview, and confirm the previewed page is pure white
with legible dark text/borders — not the dark screen theme leaking through.

## 4. Report
List each printable component checked as PASS/FAIL with file:line for the
style block reviewed. For any FAIL, fix by hard-coding the background/text
colors inside the print-area styles rather than adding new conditional theme
logic.
