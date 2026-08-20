---
name: LIKHA-SIS
description: DepEd-compliant school management PWA styled as a warm, official school ledger
colors:
  primary: "rgb(31 111 92)"
  primary-light: "rgb(48 171 142)"
  primary-dark: "rgb(14 51 42)"
  accent: "rgb(150 97 34)"
  accent-light: "rgb(209 137 52)"
  accent-dark: "rgb(88 57 20)"
  leaf: "rgb(42 123 69)"
  leaf-light: "rgb(61 180 101)"
  leaf-dark: "rgb(23 66 37)"
  paper: "rgb(246 244 238)"
  paper-raised: "rgb(255 254 251)"
  ink: "rgb(36 41 31)"
  ink-soft: "rgb(86 92 77)"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "\"Public Sans\", \"Segoe UI\", ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
  mono:
    fontFamily: "\"IBM Plex Mono\", ui-monospace, monospace"
    fontVariation: "tabular-nums"
rounded:
  sm: "8px"
  md: "12px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "rgb(255 255 255)"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-light}"
  card:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: LIKHA-SIS

## Overview

**Creative North Star: "The School Ledger"**

LIKHA-SIS reads as a well-kept official record book, not a SaaS dashboard: warm paper surfaces, an editorial serif for headings, and a deep institutional green that carries the same trust a school seal carries on a printed certificate. The mood is **warm and official** — approachable enough for daily use by teachers and coordinators, but never playful; every screen should feel like it belongs in the same binder as a report card or SF9 form. Density stays moderate: enough breathing room to scan a table of learners at a glance, without the whitespace of a marketing site.

Each deploying school can recolor the system through its own logo (`useBrandTheme` derives `--lm-*`/`--dm-*` from the uploaded brand image via `extractTheme.js` + `colorTheory.js`, contrast-checked for WCAG AA), but the *structure* — warm paper base, serif display headings, confident solid-fill primary actions, soft-lift cards — is the fixed identity beneath every school's palette. Tingub National High School's teal-green (`#1F6F5C`) is the reference/default instance of that identity, not a hardcoded constant.

Elevation and shadow treatment is **not yet locked as an invariant** — the current soft-shadow-on-cards-only pattern (see Elevation & Depth) is a reasonable default but open to a bolder pass; don't treat it as a Named Rule the way color and type are treated below.

**Key Characteristics:**
- Warm paper base (never pure white or cool gray) with a deep green institutional accent
- Serif display headings (Fraunces) paired with a clean grotesque body face (Public Sans)
- Confident, solid-fill buttons with tactile press feedback (`active:scale-[0.97–0.99]`)
- Per-school brand recoloring underneath a fixed structural identity
- Strict print/screen separation: printed DepEd forms always render in the light-mode palette regardless of on-screen theme

## Colors

Grounded and civic — a school-office palette of deep green, brass gold, and warm paper, never neon or corporate-blue.

### Primary
- **Deep Institutional Teal-Green** (`rgb(31 111 92)` / `#1F6F5C`): the school's brand color. Sidebar background, primary buttons, active nav indicators, primary headings (`text-primary`). Carries the same weight an institution's seal color would.

### Secondary
- **Ledger Gold** (`rgb(150 97 34)` / `#966122`): the accent. Used sparingly — section-group labels in the sidebar, small highlight text, the accent-light variant on hover states. Never a large fill; it marks, it doesn't dominate.
- **Working Leaf Green** (`rgb(42 123 69)` / `#2A7B45`): a distinct secondary green reserved for its own semantic role (currently scheduling/palette use in `schedulePalette.js`) — kept separate from Primary so it never gets read as "the brand color at a different shade."

### Neutral
- **Warm Paper** (`rgb(246 244 238)` / `#F6F4EE`) / dark: `rgb(24 28 22)`: the base surface — never pure white, never cool gray. This is the ledger-page color the whole system sits on.
- **Raised Paper** (`rgb(255 254 251)` / `#FFFEFB`) / dark: `rgb(32 37 29)`: cards and raised surfaces sitting slightly lighter than the base paper.
- **Ink** (`rgb(36 41 31)` / `#24291F`) / dark: `rgb(238 238 226)`: primary text — a warm near-black, not pure black.
- **Soft Ink** (`rgb(86 92 77)` / `#565C4D`) / dark: `rgb(183 188 172)`: secondary/muted text.

### Named Rules
**The Paper, Not Glass Rule.** Every neutral surface token is warm and slightly desaturated — never a cool gray, never pure white, never a translucent/glass effect on a base surface. Paper (light) and near-black-green paper (dark) are the two allowed grounds.

**The Print-Light Rule.** Printable documents (`ReportCard`, `CertificateGenerator`, `IDGenerator`, SF forms) force `--color-*` back to the `--lm-*` (light-mode) values under `@media print`, regardless of the active on-screen theme. A printed page must never carry the brighter dark-mode brand variant onto paper.

**The One-School, One-Palette Rule.** `--lm-*`/`--dm-*` are derived per-school from an uploaded logo via `colorTheory.js`/`extractTheme.js`, contrast-checked to WCAG AA (`ensureReadableContrast`, luminance ≤ 0.18 for light surfaces) and a dark-surface luminance window (0.12–0.18). Never hardcode a hex brand color into a component; always consume it through the `--color-*` / Tailwind `primary`/`accent`/`leaf` tokens so a repainted school stays on-model automatically.

## Typography

**Display Font:** Fraunces (with Georgia, serif fallback)
**Body Font:** Public Sans (with Segoe UI, ui-sans-serif, system-ui, sans-serif fallback)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, monospace fallback) — reserved for tabular numerals (`font-tabular`, dates, counts)

**Character:** A ledger pairing — Fraunces' warm, slightly editorial serif gives every screen's `<h1>` the weight of a heading in an official document, while Public Sans keeps the actual working UI (labels, tables, buttons) plain and legible.

### Hierarchy
- **Display / Page Title** (font-semibold, `text-xl`–`text-2xl`, tracking-tight): the `font-display` class on every screen's top `<h1>`/`<h2>` — "Announcements", "Academic Hub", "SF10 Generator", etc. This is the one place the serif appears; body copy never uses it.
- **Body** (font-normal to font-medium, `text-sm`–`text-base`): all table cells, form labels, descriptive text, using Public Sans.
- **Label** (font-semibold, `text-[11px]`, uppercase, tracking-wider): sidebar section-group headers (e.g. "ACADEMICS"), rendered in Ledger Gold (`text-accent-light`).
- **Tabular** (`font-tabular`, IBM Plex Mono stack via `font-mono`): clock display, counts, dates, anywhere numerals must align in a column.

### Named Rules
**The One Serif Rule.** Fraunces appears only on page-level `<h1>`/`<h2>` titles (`font-display`). Every other piece of type — labels, buttons, table data, nav — stays in Public Sans. The serif marks "this is a section of the record," nothing else.

## Layout

Content sits inside a persistent app shell: a fixed-width sidebar (`w-64` expanded / `w-20` collapsed, collapsible on desktop, off-canvas drawer on mobile below `md:`) and a scrollable main column with a sticky, blurred header (`backdrop-blur-sm`, `bg-white/90` / `bg-gray-900/90`). Page content sits in `p-4 md:p-6` padding with no additional max-width constraint — screens are built to use the available width for tables and forms rather than a centered reading column. Responsive behavior collapses the sidebar into a mobile drawer (`fixed`, slide-in via `translate-x`) rather than reflowing into a bottom nav.

## Elevation & Depth

Mostly flat with thin 1px borders (`border-gray-200`/`border-gray-700`) separating regions; cards are the one element that lifts, using a soft, warm-tinted ambient shadow that intensifies slightly on hover. This flat-plus-card-lift pattern is the current implementation, not yet confirmed as a permanent invariant — a future `bolder` or `polish` pass may deepen or restructure the depth model, so treat the values below as the present baseline rather than a Named Rule.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgba(36,41,31,.06), 0 1px 1px rgba(36,41,31,.04)`): resting state for stat tiles and content cards.
- **Card Hover** (`box-shadow: 0 4px 14px rgba(36,41,31,.10), 0 1px 3px rgba(36,41,31,.06)`): paired with a `-translate-y-0.5` lift on hover/focus.

## Shapes

Two radius steps cover nearly everything: `rounded-lg` (8px) on buttons, inputs, and dropdown menus; `rounded-xl` (12px) on cards and larger containers. Avatars, the profile initials badge, and pill toggles (theme switcher) use `rounded-full`. Corners are consistently soft, never sharp and never heavily rounded/pill-shaped outside those specific circular elements.

## Components

Confident and official: solid-fill primary actions with a firm outline, real hover/press feedback (`hover:bg-primary-light`, `active:scale-[0.97–0.99]`), never a bare-text "flat" primary button.

### Buttons
- **Shape:** `rounded-lg` (8px).
- **Primary:** `bg-primary text-white`, `px-4–5 py-2–2.5`, `text-sm font-semibold`, `shadow-sm`. This exact recipe repeats verbatim across the app (Announcements, AccountSettings, CertificateGenerator, IDGenerator, etc.) — treat it as the canonical primary button, not a per-screen invention.
- **Hover / Focus:** `hover:bg-primary-light` (or `hover:bg-primary-dark` on a few screens — both are in active use; prefer `-light` for new work to converge the pattern), `active:scale-[0.97]`–`[0.99]`, `transition-all`, `disabled:opacity-50–60 disabled:cursor-not-allowed`.
- **Ghost/Nav:** sidebar nav buttons use `text-white/75` at rest, `hover:bg-white/10 hover:text-white`, and an active state of `bg-white/15 font-semibold` plus a 1px accent-colored indicator bar on the leading edge — never a filled pill for "active," always the edge indicator + subtle background wash.

### Cards / Containers
- **Corner Style:** `rounded-xl` (12px).
- **Background:** white / `gray-900` (raised paper token), `border border-gray-200 dark:border-gray-700`.
- **Shadow Strategy:** `shadow-card` at rest, `shadow-card-hover` + `-translate-y-0.5` on hover — see Elevation & Depth.
- **Internal Padding:** `p-3`–`p-4` for compact tiles (StatCard), `p-4`–`p-6` for section containers.

### Inputs / Fields
- **Style:** `border border-gray-200 dark:border-gray-700`, `rounded-lg`, `bg-gray-50 dark:bg-gray-800` at rest (a subtly recessed tone, distinct from card background).
- **Focus:** `focus:ring-2 focus:ring-primary/20–40 focus:border-primary`, background brightens to `focus:bg-white`. No glow/shadow beyond the ring.

### Navigation
- Sidebar: `bg-primary` (school brand color) fill, white/translucent-white text, icon (18px, `lucide-react`, `strokeWidth={2}`) + label, grouped under uppercase Ledger Gold section labels. Collapses to icon-only with tooltips (`Tooltip.jsx`, CSS-only, no dependency) at `w-20`.
- Header: sticky, translucent-blurred, houses page title (serif), current date/time (tabular mono), a three-way light/system/dark pill toggle, notification bell, and profile menu — all right-aligned, consistent `w-9 h-9` circular hit targets.

### Tooltip (signature component)
Dependency-free, CSS-only (`Tooltip.jsx`): a small `bg-gray-900 dark:bg-gray-700` pill, `text-[11px]`, appearing on hover/focus-within with a 150ms opacity transition. Reused everywhere a compact hint is needed instead of pulling in a tooltip library — consistent with the project's broader "no npm dependency for small UI needs" pattern (see also `settingsLock.js` using Web Crypto instead of a crypto package).

## Do's and Don'ts

### Do:
- **Do** consume brand color exclusively through the `--color-*` custom properties / Tailwind `primary`/`accent`/`leaf` classes, never a hardcoded hex, so every deploying school's uploaded-logo palette applies automatically.
- **Do** reuse the exact primary-button recipe (`bg-primary text-white rounded-lg text-sm font-semibold shadow-sm active:scale-[0.97-0.99]`) for new primary actions instead of inventing a new button style per screen.
- **Do** keep `font-display` (Fraunces) reserved for page-level `<h1>`/`<h2>` titles only.
- **Do** force printable components back to the light-mode brand variables under `@media print`, independent of the on-screen theme.

### Don't:
- **Don't** use cool grays or pure white as a base surface — Warm Paper / Raised Paper are the only grounds.
- **Don't** apply the serif display font to body text, table data, labels, or buttons.
- **Don't** let dark-mode or brand-theme styling leak into printed output (`ReportCard`, `CertificateGenerator`, `IDGenerator`, SF forms) — print stays pure light-mode brand colors on white.
- **Don't** treat the current flat-plus-card-shadow elevation model as fixed doctrine — it's confirmed as the present baseline only, open to revision in a future bolder/polish pass.
