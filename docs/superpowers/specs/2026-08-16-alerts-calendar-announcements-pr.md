# PR: NDRRMC alerts, school calendar, announcements, DepEd dropdowns and local weather

Ready-to-paste pull request description for branch
`worktree-alerts-calendar-announcements` → `master`.

Open at:
https://github.com/312810-spec/likha-sis/compare/master...worktree-alerts-calendar-announcements

**Title:** `feat: NDRRMC alerts, school calendar, announcements, DepEd dropdowns and local weather`

---

Adds the school-wide alerts / calendar / announcements layer, plus the DepEd
field-office dropdowns and local weather.

## What this delivers

- **NDRRMC alerts in the notification bell.** No free CORS-enabled NDRRMC or
  PAGASA JSON API exists, and this is a client-only Firebase build with no
  Cloud Functions to scrape one. So the bell merges two clearly-distinguished
  sources: *posted advisories* transcribed by the principal or ICT Coordinator
  from an actual bulletin, and *automated readings* derived from Open-Meteo
  severe-weather thresholds and nearby USGS earthquakes. Posted advisories
  always sort above automated ones, and every row is labelled with which it
  is — an Open-Meteo rainfall figure must never read as a real class
  suspension.
- **Upcoming holidays** — Philippine regular and special non-working days for
  2026–2027 as static offline-safe data. Lunar-calendar holidays are flagged as
  provisional, since they follow Presidential Proclamation.
- **School Calendar page** — 6×7 month grid layering DepEd 3-term boundaries,
  holidays, class suspensions and school events, plus a 45-day upcoming list.
- **Announcements page** — posting gated to principal and ICT Coordinator in
  the UI *and* in `firestore.rules`. Types: General, DepEd Order, DepEd
  Memorandum (both requiring a reference number), NDRRMC / Weather Advisory,
  and Class Suspension.
- **Region / Division / District / School dropdowns** — all 18 regions and 230
  Schools Division Offices, sourced from the official DepEd directory rather
  than written from memory. Shared by School Settings and the Setup Wizard.
- **Local weather card** on the Dashboard — current conditions and a 3-day
  outlook, explicitly labelled as readings rather than a PAGASA warning.

## Notable decisions

- **The re-established Negros Island Region** means Region VI no longer
  contains Negros Occidental, Negros Oriental or Siquijor. A test locks that
  split in place, because a wrong division name silently corrupts the heading
  on every printed School Form.
- **District and School Name are type-ahead comboboxes, not fixed dropdowns.**
  There is no stable public machine-readable list of the country's districts or
  ~60,000 schools; shipping a partial snapshot would present stale data as
  authoritative. They read suggestions from a `referenceData/schoolDirectory`
  document each school maintains itself, and accept free text otherwise.
- **Every notification source degrades independently** — a dead weather API, a
  blocked seismic feed or a Firestore permission error drops only its own
  section. The bell cannot take the dashboard shell down.
- **Dates use local getters, never `toISOString()`**, which reports the
  previous day for any Philippine time before 08:00 (UTC+8).

## Data safety

Three new `firestore.rules` blocks (`announcements`, `schoolEvents`,
`referenceData`) sit before the deny-all catch-all: read for every assigned
role, write for principal and ICT Coordinator only. Already compiled and
deployed to the live `likha-sis` project.

## Verification

`npm run lint` clean · `npm run test` 325 passed across 32 files ·
`npm run build` green.

## Follow-up for the maintainer

The weather card and earthquake radius stay dark until the live
`settings/schoolConfig` document has `latitude` and `longitude`. The defaults
in `schoolConfig.js` only apply to a fresh document — open School Settings and
save once to populate them on the existing one.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
