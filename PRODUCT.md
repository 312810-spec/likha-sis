# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Nine role-gated user types share one login-gated app (`src/utils/roles.js`): Principal, Master Teacher, Adviser, Subject Teacher, Stakeholder, ICT Coordinator, SMEA Coordinator, Guidance Counselor, Clinic Teacher. The primary builder/administrator is the ICT Coordinator persona (school-settings owner, first-run setup, branding, security), who is also acting as the product's developer during this pre-launch phase. Each other role has a narrowed slice of the app surfaced via `pageAccess.js` (e.g. LARDO/behavioral records restricted to `smeaCoordinator`, `principal`, `guidance`).

## Product Purpose

LIKHA-SIS (Learner Information & Knowledge Hub Administrative System) is a school management PWA that digitizes and automates DepEd Philippines administrative workflows: learner records, class records and grading, attendance (SF2), nutrition status (SF8/BMI), behavioral/LRP tracking (SMEA/LARDO), report cards, IDs, certificates, and consolidated DepEd forms (SF1, SF4, SF9, SF10). Success means a school's staff can run their full DepEd paperwork/compliance cycle inside one app instead of manual spreadsheets and paper forms, with automatic compliance flags (grade/attendance intervention triggers) replacing manual monitoring.

## Positioning

Purpose-built for current Philippine DepEd orders (DO 15 s.2026 grading, DO 006 s.2026 safe-environment/LRP, DO 017 s.2026 Strengthened SHS) rather than a generic school-management tool retrofitted with local rules — the grading weights, transmutation tables, 3-tier behavioral classification, and 2-track SHS model are first-class, current-year data/logic, not customizable approximations. A general SIS product could not truthfully claim this level of DepEd-order fidelity without being rebuilt around it.

## Operating Context

Deployed to individual DepEd public high schools, first proven at Tingub National High School. Each school runs its own instance/config, set up through a first-run `SetupWizard` and later editable in a single ICT-Coordinator-only **School Settings** page (identity, grade levels/SHS, branding & theme, academic calendar, security). School data is organized around the DepEd school year, now split into a fixed 3-term system (Term 1–3, not legacy quarters). Printable outputs (report cards, certificates, IDs, SF forms) must reproduce correctly on paper, independent of the app's on-screen theme.

## Capabilities and Constraints

- Reusable across DepEd schools by design: each deploying school configures its own identity, branding, and calendar rather than the product being tuned only for Tingub NHS.
- Routing is single-page string state in `App.jsx` — React Router is explicitly excluded.
- Theming supports dark/light/brand modes app-wide (`useDarkMode`, `useBrandTheme`) but printable documents must stay pure white under `@media print`, with zero theme leakage.
- No paid/external UI dependencies beyond `lucide-react` and `ColorThief`; QR codes come from `api.qrserver.com` rather than an npm package.
- Firebase (Auth + Firestore) is the only backend; every new collection requires a matching `firestore.rules` block.
- A separate School Settings key (distinct from login password) gates the settings page against accidental edits, not against a determined ICT Coordinator — this is an acknowledged, not a hardened, threat model.
- Grading, attendance, and behavioral logic must track current-year DepEd orders exactly (see Positioning); these are compliance-sensitive, not stylistic, constraints on any redesign.

## Evidence on Hand

No real school production data yet — the product is pre-launch/piloting, so no live learner records, testimonials, or usage metrics exist to reference. Domain evidence instead comes from the DepEd orders themselves (DO 15, DO 006, DO 017 s.2026) and the DepEd form formats already implemented in code (SF1, SF2, SF4, SF8, SF9, SF10). Future design work must not fabricate school names, learner data, or usage claims beyond Tingub NHS as the first pilot site.

## Product Principles

1. DepEd-order fidelity is non-negotiable — grading weights, transmutation, behavioral tiers, and track models follow the current DO exactly, not a simplified or customizable version.
2. One coordinator, one lock — all school-level configuration lives behind a single ICT-Coordinator-owned settings surface, not scattered admin screens.
3. Paper and screen are separate contracts — on-screen theming (dark/light/brand) must never bleed into printed DepEd forms and documents.
4. Reusability without genericness — the product must generalize cleanly to other schools while keeping DepEd specificity as its core value, not softening it into a generic SIS.
5. Automate the monitoring, not just the recordkeeping — attendance and grade thresholds should surface compliance risk (LARDO, academic intervention) automatically rather than relying on manual staff review.

## Accessibility & Inclusion

No unusual constraints beyond standard web accessibility practice; assume typical school office hardware and internet connectivity.
