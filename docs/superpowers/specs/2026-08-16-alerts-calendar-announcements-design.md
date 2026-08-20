# Alerts, Calendar & Announcements — Design

**Date:** 2026-08-16
**Status:** Approved
**Scope:** NDRRMC/hazard alerts, upcoming holidays, school calendar, role-gated announcements (DepEd Order / Memorandum), DepEd reference-data dropdowns, and local weather.

---

## 1. Purpose

LIKHA-SIS currently has no channel for time-sensitive, school-wide information. The
notification bell in `DashboardShell.jsx` is a hardcoded stub, `academicCalendar.js`
knows term boundaries but not holidays, and school identity fields (region, division,
district) are free-text inputs that drift into typos.

This work adds one coherent information layer: what is happening today (weather and
hazards), what is coming up (holidays, school events, term boundaries), and what the
school has been told (DepEd Orders, Memoranda, NDRRMC advisories, class suspensions) —
surfaced through a single notification panel.

---

## 2. Key Constraint: There Is No NDRRMC API

NDRRMC and PAGASA publish no free, CORS-enabled JSON API. LIKHA-SIS is a client-only
Firebase PWA with no Cloud Functions, so the browser must fetch cross-origin directly.
Scraping a government HTML page from the browser is blocked by CORS and cannot work.

The approved resolution is **hybrid**:

- **Automated** hazard signals come from sources that *are* browser-reachable:
  Open-Meteo (weather, severe thresholds) and USGS (earthquakes). These are labelled
  as automated environmental signals, never as official NDRRMC bulletins.
- **Manual** NDRRMC advisories and class suspensions are posted by the Principal or ICT
  Coordinator as first-class announcement types, transcribed from official bulletins.

Manual posts always outrank automated signals in the alert feed. This distinction is a
correctness requirement, not a cosmetic one: a teacher must never mistake an Open-Meteo
rainfall threshold for a DepEd class-suspension order.

---

## 3. Components

Each unit below has one purpose, a stated interface, and stated dependencies.

### 3.1 `src/data/depedReferenceData.js`

**Does:** Holds the official DepEd field-office hierarchy as static data.
**Exports:** `DEPED_REGIONS` (18 entries: `{ code, name }`), `DEPED_DIVISIONS`
(`{ [regionCode]: string[] }`, 230 division names), `getDivisionsForRegion(code)`,
`findRegionForDivision(name)`.
**Depends on:** nothing.

Sourced from the official DepEd Regional & Division Offices Directory, not written from
memory. Includes the re-established **Negros Island Region** — consequently Region VI
does *not* contain Negros Occidental, Negros Oriental, or Siquijor.

Districts and school names are deliberately **not** bundled. There are thousands of
districts and roughly 60,000 schools with no stable public machine-readable list;
shipping a partial one would present stale data as authoritative. Those two fields
become type-ahead comboboxes instead (§3.6).

### 3.2 `src/utils/philippineHolidays.js`

**Does:** Supplies Philippine non-working days for the school year, as static data.
**Exports:** `PHILIPPINE_HOLIDAYS` (`{ date, name, type, approximate? }`),
`getHolidaysInRange(from, to)`, `getUpcomingHolidays(from, limit)`,
`isNonWorkingDay(date)`.
**Depends on:** nothing.

`type` is one of `regular`, `specialNonWorking`, `observance`. Covers calendar years
2026 and 2027 so SY 2026–2027 is fully spanned. Movable Islamic holidays (Eid'l Fitr,
Eid'l Adha) carry `approximate: true` because their exact dates are proclaimed annually
by the Office of the President and must be displayed as provisional.

Static data, not an API: holidays must render offline in a PWA and must not depend on a
third-party service staying up during a school year.

### 3.3 `src/utils/weatherService.js` + `src/hooks/useLocalWeather.js`

**Does:** Fetches and caches current conditions and a short forecast for the school's
coordinates.
**Exports (service):** `fetchWeather(lat, lon)`, `describeWeatherCode(code)`,
`readCachedWeather()`, `writeCachedWeather(data)`, `WEATHER_CACHE_TTL_MS`.
**Exports (hook):** `useLocalWeather()` → `{ weather, loading, error, stale }`.
**Depends on:** `useSchoolConfig` for coordinates; Open-Meteo over `fetch`.

Endpoint: `https://api.open-meteo.com/v1/forecast` with `timezone=Asia/Manila`,
requesting current temperature, apparent temperature, humidity, precipitation, weather
code and wind speed, plus a 3-day daily summary.

No API key and no npm dependency — plain `fetch`, consistent with the existing
`api.qrserver.com` precedent. Responses are cached in `localStorage` for 30 minutes so
the app does not re-fetch per render and degrades to last-known data when offline. When
the school has no coordinates set, the hook returns a `needsCoordinates` state and the
UI links to School Settings rather than guessing a location.

WMO weather codes are mapped to a human label and a `lucide-react` icon name.

### 3.4 `src/utils/hazardAlerts.js`

**Does:** Normalizes every hazard source into one comparable alert shape.
**Exports:** `deriveWeatherAlerts(weather)`, `fetchEarthquakeAlerts(lat, lon)`,
`announcementsToAlerts(announcements)`, `mergeAlerts(...groups)`, `ALERT_SEVERITY`.
**Depends on:** `weatherService` output shape; USGS over `fetch`.

Normalized alert: `{ id, severity, source, title, detail, issuedAt, official }`.

Automated thresholds:

| Signal | Threshold | Severity |
|---|---|---|
| Daily precipitation | ≥ 50 mm / ≥ 100 mm | warning / danger |
| Wind speed | ≥ 62 km/h / ≥ 89 km/h | warning / danger |
| Apparent temperature (heat index) | ≥ 42 °C | danger |
| Earthquake | M4.5+ within 300 km, last 7 days | warning (M6+ danger) |

The 42 °C heat-index threshold matches the DepEd guidance level at which class
suspension is considered; it is surfaced as a decision input for the Principal, never as
an automatic suspension.

USGS endpoint: `https://earthquake.usgs.gov/fdsnws/event/1/query` with `format=geojson`
and a radius filter — CORS-enabled and keyless.

`official: true` is set only for manually posted NDRRMC advisories and class
suspensions. `mergeAlerts` sorts official alerts above automated ones, then by severity,
then by recency.

### 3.5 Announcements — `announcements` collection + `src/Announcements.jsx`

**Does:** Lets the Principal and ICT Coordinator publish school-wide notices; lets
everyone else read them.
**Depends on:** Firestore, `pageAccess.js`.

Document shape:

```
{
  title: string,
  body: string,
  type: "general" | "depedOrder" | "depedMemorandum" | "ndrrmcAdvisory" | "classSuspension",
  referenceNo: string,      // e.g. "DO 015, s. 2026" — required for depedOrder/depedMemorandum
  referenceUrl: string,     // optional link to the official PDF
  priority: "normal" | "urgent",
  effectiveDate: string,    // YYYY-MM-DD
  expiresAt: string | null, // YYYY-MM-DD; drives auto-removal from the alert feed
  postedByUid: string,
  postedByName: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

`src/utils/announcements.js` holds the pure logic: `ANNOUNCEMENT_TYPES` (id, label,
icon, whether `referenceNo` is required), `validateAnnouncement(draft)`,
`isAnnouncementActive(announcement, today)`, `sortAnnouncements(list)`.

Authoring is gated by `canPostAnnouncements(roles)` in `pageAccess.js` — `principal` and
`ictCoordinator` only — enforced both in the UI and in `firestore.rules`. The page itself
is readable by every real role, so the page key is `announcements: "all"` and the write
gate is a separate helper, mirroring the existing `canAccessDisciplineRecords` pattern.

### 3.6 School identity dropdowns — `SchoolSettings.jsx`, `SetupWizard.jsx`

**Does:** Replaces four free-text identity inputs with structured pickers.

- **Region** → `<select>` over `DEPED_REGIONS`.
- **Division Office** → `<select>` over `getDivisionsForRegion(selectedRegion)`; resets
  when the region changes.
- **District** and **School Name** → `<input list>` comboboxes. Free text is always
  accepted; suggestions come from a `referenceData/schoolDirectory` Firestore document
  the ICT Coordinator can extend for their own division.

Two new fields, `latitude` and `longitude`, are added to the School Identity section to
drive weather and earthquake proximity, defaulting to Tingub NHS.

Both files present the same control set; the shared option data lives in
`depedReferenceData.js` so the two screens cannot drift apart.

### 3.7 School calendar — `schoolEvents` collection + `src/SchoolCalendar.jsx`

**Does:** Shows one month grid plus an upcoming-events list, overlaying four sources:
the three terms from `academicCalendar.js`, Philippine holidays, school events, and
active class suspensions from `announcements`.

`schoolEvents` document: `{ title, description, startDate, endDate, category, createdBy,
createdAt }` where `category` is one of `examination`, `activity`, `deadline`,
`meeting`, `holiday`. Written by `principal` / `ictCoordinator`, read by all real roles.

`src/utils/schoolCalendar.js` holds the pure composition logic:
`buildCalendarMonth(year, month, sources)` returns a 6×7 day grid with each day's
entries already merged and sorted, so the component does no date arithmetic.

Per CLAUDE.md §2, the calendar's print stylesheet forces a pure white background with no
dark or brand theme leakage.

### 3.8 Notification bell — `src/components/NotificationPanel.jsx` + `useNotifications()`

**Does:** Replaces the "You're all caught up" stub at `DashboardShell.jsx:149`.

Three sections, in order: **Active alerts** (hazard + official advisories), **Recent
announcements** (last 14 days), **Coming up** (holidays and school events in the next 30
days). Empty sections are omitted; if all three are empty the existing caught-up message
is retained.

`useNotifications()` composes `useLocalWeather`, `hazardAlerts`, and Firestore listeners
on `announcements` and `schoolEvents`, returning `{ alerts, announcements, upcoming,
unreadCount }`. The unread badge compares the newest item timestamp against a
`likha.notifications.lastSeenAt` value in `localStorage`, set when the panel opens.

Failures degrade quietly: a dead weather or USGS fetch drops that section rather than
breaking the bell. School-wide information must never take the shell down.

---

## 4. Data Flow

```
settings/schoolConfig ──lat/lon──> useLocalWeather ──> weatherService ──> Open-Meteo
                                        │                                     │
                                        └──────────────┬──────────────────────┘
                                                       ▼
announcements (Firestore) ──official advisories──> hazardAlerts.mergeAlerts
USGS earthquakes ─────────automated signals───────────┘  │
                                                          ▼
philippineHolidays ─┐                            useNotifications
schoolEvents ───────┼──> schoolCalendar.build ──┐        │
academicCalendar ───┘                            ├───────┴──> NotificationPanel
                                                 └──────────> SchoolCalendar page
```

---

## 5. Firestore Rules

Three new blocks, added before the deny-all catch-all, following the existing
`hasAnyRole` helper style:

- `announcements` — read: every real `ROLE_OPTIONS` role; create/update/delete:
  `principal`, `ictCoordinator`.
- `schoolEvents` — same split.
- `referenceData/{document}` — read: every real role; write: `principal`,
  `ictCoordinator`.

Read access is an explicit allowlist of roles rather than a bare `isSignedIn()`, matching
the reasoning already documented on the `learners` block: a signed-in account with no
`users/{uid}` document must fail closed.

---

## 6. Testing

Vitest unit tests on pure logic only, matching the repository's existing convention of
not unit-testing JSX components:

| File | Covers |
|---|---|
| `depedReferenceData.test.js` | 18 regions; every division maps to a real region; no duplicate names within a region; `getDivisionsForRegion` on unknown code returns `[]` |
| `philippineHolidays.test.js` | range filtering, upcoming lookup across a year boundary, `approximate` flag preserved, `isNonWorkingDay` |
| `weatherService.test.js` | WMO code mapping incl. unknown codes, cache TTL expiry, malformed payload handled |
| `hazardAlerts.test.js` | each threshold at boundary and just below, official-over-automated ordering, expired announcements excluded |
| `announcements.test.js` | `validateAnnouncement` requires `referenceNo` for order/memo types, `isAnnouncementActive` around `expiresAt`, sort order |
| `schoolCalendar.test.js` | grid shape, entries land on correct days, term boundary days, month with a leading/trailing partial week |
| `pageAccess.test.js` (extended) | new page keys; `canPostAnnouncements` allows only principal/ictCoordinator, rejects empty and unknown roles |

---

## 7. Files

**New:** `src/data/depedReferenceData.js`, `src/utils/philippineHolidays.js`,
`src/utils/weatherService.js`, `src/utils/hazardAlerts.js`, `src/utils/announcements.js`,
`src/utils/schoolCalendar.js`, `src/hooks/useLocalWeather.js`,
`src/hooks/useNotifications.js`, `src/Announcements.jsx`, `src/SchoolCalendar.jsx`,
`src/components/NotificationPanel.jsx`, `src/components/WeatherCard.jsx`, plus the seven
test files above.

**Modified:** `App.jsx` (two routes), `components/Sidebar.jsx` (two nav entries, two
icons), `pageAccess.js`, `SchoolSettings.jsx`, `SetupWizard.jsx`, `DashboardShell.jsx`,
`Dashboard.jsx`, `schoolConfig.js`, `firestore.rules`.

**No new npm dependencies.** Both external APIs are plain `fetch`.

---

## 8. Out of Scope

- Push notifications or email. The bell is in-app only.
- Automatic scraping of NDRRMC or PAGASA bulletins — impossible from the browser (§2).
- A bundled national district or school-name registry (§3.1).
- Editing DepEd Orders' content. Announcements link to official PDFs; they do not mirror
  them.
