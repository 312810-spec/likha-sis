# Comprehensive Philippine Education Calendar — Design Spec

Date: 2026-08-20

## Purpose

Upgrade `SchoolCalendar.jsx` from its current 4-source layering (terms,
holidays, suspensions, school events) into a school-focused calendar that
also surfaces personnel birthdays, DepEd's official school calendar,
DOST-PAGASA weather/tropical-cyclone advisories, and DepEd/gov education
announcements — live-synced wherever technically possible.

## Architecture Overview

`buildCalendarMonth()` in `src/utils/schoolCalendar.js` already composes
independent entry sources into one `entries` array per day
(`{kind, dateKey, title, subtitle, tone, id}`). Every new source below
follows that same shape and slots into the existing composition — no
rewrite of the grid renderer in `SchoolCalendar.jsx`.

Two sources need **server-side fetching** (PAGASA bulletins, DepEd
calendar) because their upstream sources are not CORS-friendly and, for
PAGASA, require the `pagasa-parser` npm library. Since this repo has no
Cloud Functions today, this design adds a minimal `functions/` directory
with two scheduled functions that write parsed results into Firestore.
Everything else (birthdays, weather forecast, DepEd/gov manual
announcements) stays client-side, matching the existing "no npm
dependency in the frontend" convention.

## 1. Personnel Birthdays

- Add optional `birthdate` (`YYYY-MM-DD`) field to the `users` collection.
- Editable in `UserManagement.jsx` (ictCoordinator/principal, for any
  user) and on the signed-in user's own profile.
- New `birthdayEntries(users, viewYear)` in `schoolCalendar.js`: projects
  each birthdate onto the viewed year (recurring yearly), `kind:
  "birthday"`, `tone: "violet"`.
- No new collection. `SchoolCalendar.jsx` subscribes to `users` via
  `onSnapshot` (already fetched elsewhere in the app; reused query here)
  and passes it into `buildCalendarMonth()`.

## 2. Weather Forecast (Open-Meteo)

- `src/utils/weather.js`: fetches `https://api.open-meteo.com/v1/forecast`
  (free, keyless) using the school's lat/lon. If `schoolConfig` doesn't
  already carry coordinates, add `latitude`/`longitude` to School Settings
  → School Identity tab (optional; forecast panel hides if unset).
- Returns a 7-day forecast plus a derived `severe` flag (heavy
  rain/high-wind thresholds) per day.
- Rendered as a forecast strip on the calendar page (today + 6 days), not
  merged into day-grid entries — weather isn't a "school event."
- Client polls every hour (`setInterval`) while the calendar page is
  mounted; cleared on unmount.
- Labeled "General forecast — not an official PAGASA bulletin" to keep
  the distinction from section 3 honest.

## 3. PAGASA Tropical Cyclone Bulletins

- New `functions/` Cloud Functions project (Node, Firebase Functions v2).
  Scheduled function `syncPagasaBulletins` runs every 30 minutes:
  1. Fetches PAGASA's current public tropical cyclone bulletin
     (PDF/XML source, server-side — no CORS issue on the server).
  2. Parses it with `pagasa-parser` (approved npm exception — no
     public hosted API exists for this data).
  3. Writes structured result to Firestore collection
     `weatherAdvisories`: `{signalNumber, cycloneName, affectedAreas[],
     issuedAt, validUntil, headline, sourceUrl, updatedAt}`.
- If there's no active cyclone, the function clears/leaves the
  collection empty — PAGASA doesn't issue bulletins outside cyclone
  events, so this is normally empty and the calendar shows nothing.
- `SchoolCalendar.jsx` subscribes to `weatherAdvisories` via
  `onSnapshot`, same pattern as `schoolEvents`. Entries: `kind:
  "advisory"`, `tone: "red"`, spanning `issuedAt`–`validUntil`.
- `firestore.rules`: read for any authenticated user, write only from
  the Cloud Function's admin SDK context (no client write path).

## 4. DepEd Official School Calendar Parser

- Second scheduled function, `syncDepedCalendar`, runs daily:
  1. Fetches DepEd's published official School Calendar (the DepEd
     Order / matrix page on deped.gov.ph listing term dates, holidays,
     in-service training days, enrollment periods, etc. for the current
     school year).
  2. Parses the page/PDF into discrete dated events (title, date range,
     category) using a small purpose-built parser in the function
     (HTML table/PDF text extraction — whatever matches the source
     DepEd actually publishes; no existing npm package covers this, so
     it's hand-rolled and defensive: unparseable rows are skipped, not
     fatal).
  3. Writes results to a new Firestore collection `depedCalendarEvents`:
     `{title, startDate, endDate, category, sourceDoLink, updatedAt}`.
  4. Idempotent upsert keyed by a stable hash of `(title, startDate)` so
     re-runs don't duplicate entries, and a manually-edited term date in
     `academicCalendar.js` is never silently overridden — this collection
     is informational/supplementary, not the source of truth for Term
     1/2/3 boundaries (`academicCalendar.js` / School Settings remains
     authoritative per CLAUDE.md §4D).
- `SchoolCalendar.jsx` subscribes via `onSnapshot`. Entries: `kind:
  "depedCalendar"`, `tone: "blue"`.
- `firestore.rules`: read for any authenticated user, write only from
  the Cloud Function's admin SDK context.
- If DepEd changes their page structure and the parser starts skipping
  everything, the function logs a warning but does not fail loudly to
  users — the calendar simply shows fewer DepEd-sourced entries until
  the parser is patched. (Documented as a known maintenance point, not
  solved here.)

## 5. DepEd/Gov Announcements (manual)

- Add a `depedAnnouncement` category to the existing `schoolEvents`
  category list (alongside examination/activity/deadline/meeting) so
  ICT Coordinator/principal can post DepEd Order references or PSA/DepEd
  press announcements as ordinary calendar events. Reuses the existing
  add/delete UI in `SchoolCalendar.jsx` — no new collection, no new
  code path beyond one new category entry and its tint.

## 6. Live Sync Summary

| Source | Mechanism |
|---|---|
| School events, suspensions | `onSnapshot` (existing) |
| Personnel birthdays | `onSnapshot` on `users` (new subscription, same pattern) |
| Weather forecast | Client hourly poll, Open-Meteo |
| PAGASA advisories | `onSnapshot` on `weatherAdvisories`, fed by scheduled Cloud Function (30 min) |
| DepEd calendar | `onSnapshot` on `depedCalendarEvents`, fed by scheduled Cloud Function (daily) |
| PH holidays, terms | Static data (existing, unchanged) |

## Data Flow Changes

`buildCalendarMonth(year, month, sources)` gains two new `sources` keys:
`users` and `weatherAdvisories` and `depedCalendarEvents`. Three new
entry-builder functions (`birthdayEntries`, `advisoryEntries`,
`depedCalendarEntries`) follow the exact pattern of
`holidayEntries`/`eventEntries`/`suspensionEntries` and get merged into
the same `entries` array and `order` sort map.

## Firestore Schema Changes

Two new collections (`weatherAdvisories`, `depedCalendarEvents`), both
read-only to clients, write-only from Cloud Functions admin context.
Per CLAUDE.md §4B.4 (Data-Safety Loop), matching `firestore.rules`
blocks are added before either collection is considered done — handled
via the `firestore-schema-sync` skill / `schema-guardian` agent during
implementation.

One field addition (`users.birthdate`) — no rules change needed since
`users` write rules already gate by role/ownership.

## Testing

- `schoolCalendar.js`: unit tests for `birthdayEntries` (year rollover,
  Feb 29 handling), `advisoryEntries`, `depedCalendarEntries` — pure
  functions, same style as existing `schoolCalendar.test.js`.
- `weather.js`: unit test with mocked fetch response → severe-flag
  derivation.
- Cloud Functions: not covered by the existing Vitest frontend suite;
  smoke-tested manually against real PAGASA/DepEd sources during
  implementation, with fixture-based unit tests for the parsing logic
  (parser takes raw text/HTML in, structured events out — testable in
  isolation from the network fetch).

## Out of Scope

- Push notifications for new advisories (existing `NotificationPanel`/
  `useNotifications` can pick these up later as a follow-on, not part of
  this build).
- Historical DepEd calendar archive — only the current school year's
  published calendar is parsed.
- Editing/dismissing DepEd-calendar or PAGASA entries — they're
  read-only, sourced entries; ICT Coordinator can still add school
  events around them as needed.
