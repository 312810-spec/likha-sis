---
name: print-safety-audit
description: >-
  Audits LIKHA-SIS printable components for the print-safety boundary
  mandate in CLAUDE.md Section 2 (pure white background under @media print,
  no dark/brand theme leakage). Use whenever ReportCard.jsx,
  CertificateGenerator.jsx, IDGenerator.jsx, SF1.jsx, SF2.jsx, SF4.jsx,
  NutritionStatus.jsx, or ClassProgramGenerator.jsx change, or when asked to
  review/verify a printable document, ID card, certificate, form, class
  program, or teacher's load.
metadata:
  category: LIKHA-SIS Domain
---

# Print Safety Boundary Audit

`ReportCard`, `CertificateGenerator`, `IDGenerator`, `SF1`, `SF2`, `SF4`,
`NutritionStatus`, `ClassProgramGenerator` must render pure white under any
screen theme.

`ClassProgramGenerator` owns the print CSS for both of its sheet components
(`components/schedule/ClassProgramSheet.jsx`, `TeacherLoadSheet.jsx`) via the
shared `.schedule-print-area` wrapper — audit the page, not the sheets, but
confirm the sheets stay free of `dark:` classes since the wrapper only repaints
its own background and colour.

## Check
- `@media print` follows `IDGenerator.jsx`'s isolation pattern: `.no-print`, `body * { visibility: hidden }` + print-area override, `position: absolute`
- No theme leakage — either is valid: inline hard-coded white (`ReportCard.jsx`, `CertificateGenerator.jsx`, `IDGenerator.jsx`, `SF1.jsx`, `SF2.jsx`) or `html.dark .<print-area>` override with `!important` (`SF4.jsx` — confirm `useDarkMode.js` still toggles `.dark` on `documentElement`), or a print-area rule carrying `background: #ffffff !important` over `dark:`-free children (`ClassProgramGenerator.jsx`)
- FAIL only if `dark:` classes sit in the print area with neither pattern present
- Brand accents (`rgb(var(--color-primary) / …)`) OK if not the dominant fill

## Verify
Dev server → toggle dark mode → browser print preview → confirm pure white.

## Report
PASS/FAIL per component, file:line. Fix by hard-coding print-area colors.
