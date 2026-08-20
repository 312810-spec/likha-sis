# Comprehensive Philippine Education Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend LIKHA-SIS's `SchoolCalendar.jsx` with personnel birthdays, an Open-Meteo weather forecast strip, DepEd/PAGASA data synced by two new scheduled Cloud Functions, and a manual DepEd/gov announcement category — all composed through the existing `buildCalendarMonth()` entry-source pattern.

**Architecture:** Client-side sources (birthdays, weather forecast, manual DepEd/gov events) plug directly into `schoolCalendar.js`'s existing composition function. Two upstream sources that need CORS-unfriendly fetching (PAGASA bulletins via the `pagasa-parser` npm library, and DepEd's official school calendar) run server-side in new scheduled Firebase Cloud Functions, writing structured, read-only results into two new Firestore collections that the client subscribes to with `onSnapshot`, exactly like the existing `schoolEvents`/`announcements` subscriptions.

**Tech Stack:** React + Vite (frontend, unchanged), Firebase Firestore + Cloud Functions v2 (Node, new `functions/` directory), Open-Meteo REST API (keyless, frontend fetch), `pagasa-parser` npm package (Cloud Functions only — approved scoped exception to the no-new-frontend-dependency rule; it does not touch the Vite bundle).

**Spec:** `docs/superpowers/specs/2026-08-20-comprehensive-calendar-design.md`

## Global Constraints

- No React Router — routing stays single-page `currentPage` state.
- 3-term academic system only; `academicCalendar.js` remains the sole authority for Term 1/2/3 boundaries — the new DepEd calendar collection is supplementary/informational and must never overwrite or be read as authoritative for term dates.
- No new frontend npm dependency — `pagasa-parser` is scoped to `functions/` only, never imported from `src/`.
- Every new Firestore collection gets a matching `firestore.rules` block before the task is done (Data-Safety Loop, CLAUDE.md §4B.4).
- Print safety, dark mode, and existing `ENTRY_TONES` Tailwind-JIT-visible-class convention in `SchoolCalendar.jsx` must be preserved for any new tone.
- Weather forecast panel must be clearly labeled as general forecast, distinct from official PAGASA bulletins.

---

## Task 1: Personnel birthdate field + recurring birthday entries

**Files:**
- Modify: `src/pages/UserManagement.jsx` (add birthdate field to the create/edit user form)
- Modify: `src/utils/schoolCalendar.js` (add `birthdayEntries`, wire into `buildCalendarMonth`/`getUpcomingEntries`)
- Test: `src/utils/__tests__/schoolCalendar.test.js` (extend)

**Interfaces:**
- Produces: `birthdayEntries(users, viewYear)` → `Array<{kind: "birthday", dateKey, title, subtitle, tone, id}>`, exported from `schoolCalendar.js`.
- Consumes: `users` array of `{id, fullName, birthdate}` where `birthdate` is `"YYYY-MM-DD"` or absent.

- [ ] **Step 1: Write the failing test for `birthdayEntries`**

Add to `src/utils/__tests__/schoolCalendar.test.js`:

```javascript
import { birthdayEntries } from "../schoolCalendar.js";

describe("birthdayEntries", () => {
  it("projects a birthdate onto the viewed year", () => {
    const users = [{ id: "u1", fullName: "Ana Reyes", birthdate: "1990-03-14" }];
    const entries = birthdayEntries(users, 2026);
    expect(entries).toEqual([
      {
        kind: "birthday",
        dateKey: "2026-03-14",
        title: "Ana Reyes's Birthday",
        subtitle: "Personnel Birthday",
        tone: "violet",
        id: "u1",
      },
    ]);
  });

  it("handles a Feb 29 birthdate in a non-leap viewed year by falling back to Feb 28", () => {
    const users = [{ id: "u2", fullName: "Leap Cruz", birthdate: "1992-02-29" }];
    const entries = birthdayEntries(users, 2026);
    expect(entries[0].dateKey).toBe("2026-02-28");
  });

  it("skips users with no birthdate", () => {
    const users = [{ id: "u3", fullName: "No Date" }];
    expect(birthdayEntries(users, 2026)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js --reporter=compact`
Expected: FAIL with "birthdayEntries is not a function" (or similar import error).

- [ ] **Step 3: Implement `birthdayEntries` in `src/utils/schoolCalendar.js`**

Add near the other `*Entries` helpers (after `suspensionEntries`, before `buildCalendarMonth`):

```javascript
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Projects each user's birthdate onto the viewed year (recurring yearly). */
export function birthdayEntries(users = [], viewYear) {
  const entries = [];
  for (const user of users) {
    if (!user?.birthdate) continue;
    const [, month, day] = user.birthdate.split("-").map(Number);
    if (!month || !day) continue;
    const safeDay = month === 2 && day === 29 && !isLeapYear(viewYear) ? 28 : day;
    const dateKey = `${viewYear}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
    entries.push({
      kind: "birthday",
      dateKey,
      title: `${user.fullName || "Unknown"}'s Birthday`,
      subtitle: "Personnel Birthday",
      tone: "violet",
      id: user.id,
    });
  }
  return entries;
}
```

Then wire it into `buildCalendarMonth` and `getUpcomingEntries`:

```javascript
// buildCalendarMonth: add `users = []` to the destructured sources, and
// include birthdayEntries(users, year) in the `entries` array alongside
// holidayEntries/eventEntries/suspensionEntries. Add "birthday": 3 to the
// `order` sort map.

// getUpcomingEntries: destructure `users = []` from sources too. Because
// this function can span a year boundary (e.g. viewing in December for the
// next 45 days), call birthdayEntries for both the `from` year and the
// `from` year + 1, concatenate, then let the existing date-range filter
// narrow it down:
//   ...birthdayEntries(users, from.getFullYear()),
//   ...birthdayEntries(users, from.getFullYear() + 1),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js --reporter=compact`
Expected: PASS

- [ ] **Step 5: Add the `birthdate` field to `UserManagement.jsx`**

Read `src/pages/UserManagement.jsx` around the existing create/edit user
form fields (search for `fullName` field) and add a matching optional
date input:

```jsx
<label className={labelClass}>
  Birthdate <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
  <input
    type="date"
    className={inputClass}
    value={draft.birthdate || ""}
    onChange={(e) => updateDraft("birthdate", e.target.value)}
  />
</label>
```

Include `birthdate: draft.birthdate || ""` in whatever object is written
to `users/{uid}` on create/update (find the existing `setDoc`/`updateDoc`
call and add the field alongside `fullName`). Match the exact form-state
variable names already used in that file (`draft`, `updateDraft`, or
whatever the file's existing pattern is — read the file first, this
snippet assumes the same pattern as `SchoolCalendar.jsx`'s `draft`/
`updateDraft`).

- [ ] **Step 6: Manual/lint verification**

Run: `npx eslint src/pages/UserManagement.jsx src/utils/schoolCalendar.js`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/UserManagement.jsx src/utils/schoolCalendar.js src/utils/__tests__/schoolCalendar.test.js
git commit -m "feat: add personnel birthdate field and recurring birthday calendar entries"
```

---

## Task 2: Weather forecast (Open-Meteo)

**Files:**
- Create: `src/utils/weather.js`
- Test: `src/utils/__tests__/weather.test.js`
- Modify: `src/components/settings/SchoolIdentityTab.jsx` or equivalent School Identity tab (add optional latitude/longitude fields) — first locate the actual file with `grep "School Identity" src -r` before editing.

**Interfaces:**
- Produces: `async function fetchForecast(latitude, longitude)` → `Promise<Array<{dateKey, tempMaxC, tempMinC, precipitationMm, windKph, severe, description}>>` (7 entries), and `SEVERE_RAIN_MM`, `SEVERE_WIND_KPH` threshold constants, all exported from `weather.js`.
- Consumes: `schoolConfig.latitude`, `schoolConfig.longitude` (numbers, optional).

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/weather.test.js`:

```javascript
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchForecast, SEVERE_RAIN_MM, SEVERE_WIND_KPH } from "../weather.js";

const mockResponse = {
  daily: {
    time: ["2026-08-20", "2026-08-21"],
    temperature_2m_max: [31.2, 29.8],
    temperature_2m_min: [24.1, 23.9],
    precipitation_sum: [2.0, 45.0],
    wind_speed_10m_max: [15.0, 60.0],
    weather_code: [3, 65],
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchForecast", () => {
  it("maps Open-Meteo's daily arrays into one entry per day", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const forecast = await fetchForecast(10.5, 123.1);

    expect(forecast).toHaveLength(2);
    expect(forecast[0]).toMatchObject({
      dateKey: "2026-08-20",
      tempMaxC: 31.2,
      tempMinC: 24.1,
      precipitationMm: 2.0,
      windKph: 15.0,
      severe: false,
    });
  });

  it("flags a day as severe when rain or wind crosses the threshold", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const forecast = await fetchForecast(10.5, 123.1);

    expect(forecast[1].severe).toBe(true);
    expect(mockResponse.daily.precipitation_sum[1]).toBeGreaterThan(SEVERE_RAIN_MM);
    expect(mockResponse.daily.wind_speed_10m_max[1]).toBeGreaterThan(SEVERE_WIND_KPH);
  });

  it("throws when fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchForecast(10.5, 123.1)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/weather.test.js --reporter=compact`
Expected: FAIL — module `../weather.js` does not exist.

- [ ] **Step 3: Implement `src/utils/weather.js`**

```javascript
// src/utils/weather.js
// Fetches a 7-day forecast from Open-Meteo (free, no API key) for the
// school's coordinates. This is a general forecast, NOT an official
// DOST-PAGASA bulletin -- see utils/pagasaAdvisories usage in
// schoolCalendar.js for the official tropical cyclone source.

export const SEVERE_RAIN_MM = 30;
export const SEVERE_WIND_KPH = 50;

const WEATHER_CODE_LABELS = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
};

export async function fetchForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
    timezone: "Asia/Manila",
    forecast_days: "7",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status}`);
  }
  const data = await response.json();
  const { time, temperature_2m_max, temperature_2m_min, precipitation_sum, wind_speed_10m_max, weather_code } = data.daily;

  return time.map((dateKey, i) => {
    const precipitationMm = precipitation_sum[i];
    const windKph = wind_speed_10m_max[i];
    return {
      dateKey,
      tempMaxC: temperature_2m_max[i],
      tempMinC: temperature_2m_min[i],
      precipitationMm,
      windKph,
      severe: precipitationMm > SEVERE_RAIN_MM || windKph > SEVERE_WIND_KPH,
      description: WEATHER_CODE_LABELS[weather_code[i]] || "Unknown",
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/weather.test.js --reporter=compact`
Expected: PASS

- [ ] **Step 5: Locate and extend the School Identity settings tab**

Run: `grep -rl "School Identity" src/components/settings src/SchoolSettings.jsx`

Open the matched file and add two optional number inputs (`latitude`,
`longitude`) next to the existing address/region fields, following that
file's existing `draft`/`updateDraft`/`inputClass`/`labelClass` pattern
exactly as already used for other fields in the same form. Persist them
as `Number(value)` (or `null` if blank) into `schoolConfig.latitude` /
`schoolConfig.longitude` on save, alongside the existing fields already
written by that tab.

- [ ] **Step 6: Lint**

Run: `npx eslint src/utils/weather.js`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/weather.js src/utils/__tests__/weather.test.js src/components/settings/*.jsx
git commit -m "feat: add Open-Meteo weather forecast fetch and school coordinates setting"
```

---

## Task 3: DepEd/gov announcement category

**Files:**
- Modify: `src/utils/schoolCalendar.js` (`EVENT_CATEGORIES`)
- Test: `src/utils/__tests__/schoolCalendar.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EVENT_CATEGORIES` now includes `{id: "depedAnnouncement", label: "DepEd/Gov Announcement", tint: "blue"}`. `ENTRY_TONES.blue` already exists in `SchoolCalendar.jsx` — no new tone needed.

- [ ] **Step 1: Write the failing test**

Add to `src/utils/__tests__/schoolCalendar.test.js`:

```javascript
it("includes a DepEd/gov announcement category", () => {
  expect(EVENT_CATEGORIES.find((c) => c.id === "depedAnnouncement")).toEqual({
    id: "depedAnnouncement",
    label: "DepEd/Gov Announcement",
    tint: "blue",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js --reporter=compact`
Expected: FAIL — `find(...)` returns `undefined`.

- [ ] **Step 3: Add the category**

In `src/utils/schoolCalendar.js`, add to the `EVENT_CATEGORIES` array
(after `meeting`, before `holiday`):

```javascript
{ id: "depedAnnouncement", label: "DepEd/Gov Announcement", tint: "blue" },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js --reporter=compact`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/schoolCalendar.js src/utils/__tests__/schoolCalendar.test.js
git commit -m "feat: add DepEd/gov announcement calendar event category"
```

---

## Task 4: Firestore schema for `weatherAdvisories` and `depedCalendarEvents`

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Produces: two new top-level collections both readable by any authenticated user with a school role, writable only via Cloud Functions admin SDK (no client `allow write` grant at all — Cloud Functions using the Admin SDK bypass Firestore rules entirely, so omitting `allow write` is correct and sufficient).

- [ ] **Step 1: Add the rules blocks**

In `firestore.rules`, after the existing `match /schoolEvents/{eventId}`
block (around line 266), add:

```
    // ---- weatherAdvisories (DOST-PAGASA tropical cyclone bulletins) ----
    // Populated only by the syncPagasaBulletins scheduled Cloud Function via
    // the Admin SDK, which bypasses these rules -- so no client write path
    // is granted here at all.
    match /weatherAdvisories/{advisoryId} {
      allow read: if hasAnyRole(["principal", "masterTeacher", "adviser", "subjectTeacher", "stakeholder", "ictCoordinator", "smeaCoordinator", "guidance"]);
    }

    // ---- depedCalendarEvents (parsed DepEd official school calendar) ----
    // Populated only by the syncDepedCalendar scheduled Cloud Function via
    // the Admin SDK. Supplementary/informational only -- never authoritative
    // for Term 1/2/3 boundaries, which stay owned by settings/schoolConfig.
    match /depedCalendarEvents/{eventId} {
      allow read: if hasAnyRole(["principal", "masterTeacher", "adviser", "subjectTeacher", "stakeholder", "ictCoordinator", "smeaCoordinator", "guidance"]);
    }
```

- [ ] **Step 2: Deploy the rules**

Run: `npx firebase-tools deploy --only firestore:rules`
Expected: deploy succeeds.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore rules for weatherAdvisories and depedCalendarEvents"
```

---

## Task 5: Cloud Functions scaffolding

**Files:**
- Create: `functions/package.json`
- Create: `functions/index.js`
- Modify: `firebase.json` (add `functions` config block)
- Create: `functions/.gitignore`

**Interfaces:**
- Produces: a deployable, empty-but-valid Firebase Functions v2 project that Tasks 6 and 7 add scheduled functions into.

- [ ] **Step 1: Create `functions/package.json`**

```json
{
  "name": "likha-sis-functions",
  "private": true,
  "type": "module",
  "engines": { "node": "20" },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `functions/index.js`**

```javascript
// functions/index.js
// Entry point for LIKHA-SIS's scheduled Cloud Functions. Each sync job
// lives in its own file under functions/ and is re-exported here.

import { initializeApp } from "firebase-admin/app";

initializeApp();

export { syncPagasaBulletins } from "./syncPagasaBulletins.js";
export { syncDepedCalendar } from "./syncDepedCalendar.js";
```

- [ ] **Step 3: Create `functions/.gitignore`**

```
node_modules/
```

- [ ] **Step 4: Add the `functions` block to `firebase.json`**

```json
{
  "firestore": {
    "database": "(default)",
    "location": "asia-southeast1",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log"]
    }
  ]
}
```

- [ ] **Step 5: Install dependencies**

Run: `cd functions && npm install && cd ..`
Expected: `functions/node_modules` created, `functions/package-lock.json` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add functions/package.json functions/index.js functions/.gitignore functions/package-lock.json firebase.json
git commit -m "feat: scaffold Firebase Cloud Functions project"
```

(Note: Tasks 6 and 7 add `syncPagasaBulletins.js` and
`syncDepedCalendar.js`, which `functions/index.js` above already
imports — this task's `firebase-tools deploy --only functions` will
correctly fail until those files exist. Don't deploy functions until
Task 7 is complete; deploy `firestore:rules` only in the meantime.)

---

## Task 6: `syncPagasaBulletins` scheduled function

**Files:**
- Create: `functions/syncPagasaBulletins.js`
- Modify: `functions/package.json` (add `pagasa-parser` dependency)
- Modify: `src/utils/schoolCalendar.js` (add `advisoryEntries`, wire into `buildCalendarMonth`/`getUpcomingEntries`)
- Modify: `src/SchoolCalendar.jsx` (subscribe to `weatherAdvisories`)
- Test: `src/utils/__tests__/schoolCalendar.test.js`

**Interfaces:**
- Produces (client side): `advisoryEntries(advisories)` → `Array<{kind: "advisory", dateKey, title, subtitle, tone: "red", id}>`, exported from `schoolCalendar.js`. Reads Firestore docs shaped `{signalNumber, cycloneName, affectedAreas, issuedAt, validUntil, headline, sourceUrl}` (`issuedAt`/`validUntil` as `"YYYY-MM-DD"` strings).
- Consumes: nothing from earlier tasks besides the existing `entries`/`order` composition in `buildCalendarMonth`.

- [ ] **Step 1: Add `pagasa-parser` to `functions/package.json`**

Add to `dependencies`: `"pagasa-parser": "^1.0.0"` (use whatever the
latest published major version is — check with `npm view pagasa-parser
version` before pinning). Run `cd functions && npm install && cd ..`.

- [ ] **Step 2: Write `functions/syncPagasaBulletins.js`**

```javascript
// functions/syncPagasaBulletins.js
// Runs every 30 minutes. Fetches PAGASA's current public tropical cyclone
// bulletin and writes structured advisory data to Firestore. When there is
// no active cyclone this clears the collection -- PAGASA doesn't issue
// bulletins outside cyclone events, so an empty collection is the normal
// state, not an error.

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { parseBulletin } from "pagasa-parser";

const PAGASA_BULLETIN_LIST_URL = "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin";

export const syncPagasaBulletins = onSchedule(
  { schedule: "every 30 minutes", region: "asia-southeast1", timeoutSeconds: 60 },
  async () => {
    const db = getFirestore();
    const collection = db.collection("weatherAdvisories");

    let bulletins = [];
    try {
      const listResponse = await fetch(PAGASA_BULLETIN_LIST_URL);
      if (!listResponse.ok) {
        console.warn(`PAGASA bulletin list fetch failed: ${listResponse.status}`);
        return;
      }
      const html = await listResponse.text();
      bulletins = await parseBulletin(html);
    } catch (error) {
      console.error("Failed to fetch/parse PAGASA bulletin:", error);
      return;
    }

    const existing = await collection.get();
    const batch = db.batch();
    for (const doc of existing.docs) batch.delete(doc.ref);

    for (const bulletin of bulletins) {
      const ref = collection.doc();
      batch.set(ref, {
        signalNumber: bulletin.signalNumber ?? null,
        cycloneName: bulletin.cycloneName ?? "",
        affectedAreas: bulletin.affectedAreas ?? [],
        issuedAt: bulletin.issuedAt ?? "",
        validUntil: bulletin.validUntil ?? "",
        headline: bulletin.headline ?? "",
        sourceUrl: PAGASA_BULLETIN_LIST_URL,
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
  }
);
```

(The exact shape `parseBulletin` returns depends on the installed
`pagasa-parser` version's actual API — during implementation, run `npm
view pagasa-parser` and check its README/exports, and adjust the field
mapping above to match. The Firestore document shape written
(`signalNumber`, `cycloneName`, `affectedAreas`, `issuedAt`,
`validUntil`, `headline`, `sourceUrl`, `updatedAt`) is what the client
in Step 4 depends on — keep that shape stable even if the parser's raw
output field names differ.)

- [ ] **Step 3: Write the failing client-side test**

Add to `src/utils/__tests__/schoolCalendar.test.js`:

```javascript
import { advisoryEntries } from "../schoolCalendar.js";

describe("advisoryEntries", () => {
  it("expands a bulletin's validity window into one entry per day", () => {
    const advisories = [{
      id: "adv1",
      cycloneName: "Typhoon Test",
      signalNumber: 2,
      issuedAt: "2026-08-20",
      validUntil: "2026-08-21",
      headline: "Signal No. 2 raised over Region V",
    }];
    const entries = advisoryEntries(advisories);
    expect(entries).toEqual([
      { kind: "advisory", dateKey: "2026-08-20", title: "Typhoon Test — Signal No. 2", subtitle: "Signal No. 2 raised over Region V", tone: "red", id: "adv1" },
      { kind: "advisory", dateKey: "2026-08-21", title: "Typhoon Test — Signal No. 2", subtitle: "Signal No. 2 raised over Region V", tone: "red", id: "adv1" },
    ]);
  });

  it("returns nothing when there are no active advisories", () => {
    expect(advisoryEntries([])).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js --reporter=compact`
Expected: FAIL — `advisoryEntries` is not exported.

- [ ] **Step 5: Implement `advisoryEntries` in `src/utils/schoolCalendar.js`**

Add alongside `birthdayEntries`:

```javascript
function advisoryEntries(advisories = []) {
  const entries = [];
  for (const advisory of advisories) {
    if (!advisory?.issuedAt) continue;
    const title = `${advisory.cycloneName || "Weather Advisory"} — Signal No. ${advisory.signalNumber ?? "?"}`;
    for (const dateKey of expandDateRange(advisory.issuedAt, advisory.validUntil)) {
      entries.push({
        kind: "advisory",
        dateKey,
        title,
        subtitle: advisory.headline || "",
        tone: "red",
        id: advisory.id,
      });
    }
  }
  return entries;
}
export { advisoryEntries };
```

Wire into `buildCalendarMonth`: destructure `weatherAdvisories = []`
from `sources`, add `...advisoryEntries(weatherAdvisories)` to the
`entries` array, add `"advisory": 0` to the `order` map (advisories sort
first alongside suspensions — both are urgent/blocking notices).

Wire into `getUpcomingEntries` the same way (destructure
`weatherAdvisories = []`, spread `advisoryEntries(weatherAdvisories)`
into its `entries` array too).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js --reporter=compact`
Expected: PASS

- [ ] **Step 7: Subscribe to `weatherAdvisories` in `SchoolCalendar.jsx`**

Following the exact pattern of the existing `announcements` `useEffect`
(around line 109 of `src/SchoolCalendar.jsx`), add:

```jsx
const [weatherAdvisories, setWeatherAdvisories] = useState([]);

useEffect(() => {
  const q = query(collection(db, "weatherAdvisories"), orderBy("issuedAt", "desc"), limit(20));
  const unsubscribe = onSnapshot(
    q,
    (snap) => setWeatherAdvisories(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => setWeatherAdvisories([])
  );
  return () => unsubscribe();
}, []);
```

Pass `weatherAdvisories` into both `buildCalendarMonth(...)` and
`getUpcomingEntries(...)` calls in that file (add it to their `sources`
argument objects). Also add a legend entry for the `red` tone if not
already covered by "Suspension" (it shares the `red` tint, so the
existing legend line covers it — no new legend row needed, but rename
that legend label from "Suspension" to "Suspension / Weather Advisory"
so it's not misleading).

- [ ] **Step 8: Lint**

Run: `npx eslint src/SchoolCalendar.jsx src/utils/schoolCalendar.js functions/syncPagasaBulletins.js`
Expected: no errors (functions/ is outside the frontend ESLint config's
scope in most Vite setups — if `eslint .` errors on `functions/` because
it's picked up unintentionally, add `functions/` to `.eslintignore` or
the flat config's `ignores` array).

- [ ] **Step 9: Commit**

```bash
git add functions/syncPagasaBulletins.js functions/package.json src/utils/schoolCalendar.js src/utils/__tests__/schoolCalendar.test.js src/SchoolCalendar.jsx
git commit -m "feat: add PAGASA tropical cyclone bulletin sync and calendar advisory entries"
```

---

## Task 7: `syncDepedCalendar` scheduled function

**Files:**
- Create: `functions/syncDepedCalendar.js`
- Create: `functions/depedCalendarParser.js` (pure parsing logic, testable in isolation)
- Create: `functions/__tests__/depedCalendarParser.test.js`
- Modify: `src/utils/schoolCalendar.js` (add `depedCalendarEntries`, wire in)
- Modify: `src/SchoolCalendar.jsx` (subscribe to `depedCalendarEvents`)
- Test: `src/utils/__tests__/schoolCalendar.test.js`

**Interfaces:**
- Produces (functions side): `parseDepedCalendarHtml(html)` → `Array<{title, startDate, endDate, category}>`, pure function, no network/Firestore calls — this is what makes it unit-testable without hitting the real DepEd site.
- Produces (client side): `depedCalendarEntries(events)` → `Array<{kind: "depedCalendar", dateKey, title, subtitle, tone: "blue", id}>`, exported from `schoolCalendar.js`. Reads Firestore docs shaped `{title, startDate, endDate, category, sourceDoLink}`.

- [ ] **Step 1: Add a `functions/package.json` test setup**

`pagasa-parser`'s presence already requires Node in `functions/`; add a
lightweight test runner. Add to `functions/package.json`
`devDependencies`: `"vitest": "^4.1.10"`, and a `"test": "vitest run"`
script. Run `cd functions && npm install && cd ..`.

- [ ] **Step 2: Write the failing parser test**

Create `functions/__tests__/depedCalendarParser.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import { parseDepedCalendarHtml } from "../depedCalendarParser.js";

const sampleHtml = `
<table>
  <tr><td>June 8, 2026</td><td>Opening of Classes</td></tr>
  <tr><td>September 15-19, 2026</td><td>Term 1 Final Examinations</td></tr>
  <tr><td>not a date at all</td><td>Malformed row, should be skipped</td></tr>
</table>
`;

describe("parseDepedCalendarHtml", () => {
  it("extracts single-day events", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events).toContainEqual({
      title: "Opening of Classes",
      startDate: "2026-06-08",
      endDate: "2026-06-08",
      category: "deped",
    });
  });

  it("extracts date-range events", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events).toContainEqual({
      title: "Term 1 Final Examinations",
      startDate: "2026-09-15",
      endDate: "2026-09-19",
      category: "deped",
    });
  });

  it("skips rows that don't contain a parseable date", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events.find((e) => e.title.includes("Malformed"))).toBeUndefined();
  });

  it("returns an empty array for empty or unparseable input", () => {
    expect(parseDepedCalendarHtml("")).toEqual([]);
    expect(parseDepedCalendarHtml("<p>no table here</p>")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd functions && npx vitest run __tests__/depedCalendarParser.test.js --reporter=compact && cd ..`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement `functions/depedCalendarParser.js`**

```javascript
// functions/depedCalendarParser.js
// Pure text-parsing logic for DepEd's published official School Calendar
// page. No network or Firestore calls here -- syncDepedCalendar.js does
// the fetching and writing; this file is the part that can drift out of
// sync with DepEd's actual page structure, so it's kept isolated and
// defensive: unparseable rows are skipped, never fatal.

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const DATE_RANGE_RE = /([A-Za-z]+)\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?,\s*(\d{4})/;

function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractRows(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

/** Parses DepEd's published school calendar table HTML into discrete dated events. */
export function parseDepedCalendarHtml(html) {
  if (!html) return [];
  const events = [];
  for (const [dateCell, titleCell] of extractRows(html)) {
    const match = DATE_RANGE_RE.exec(dateCell);
    if (!match || !titleCell) continue;
    const [, monthName, startDay, endDay, year] = match;
    const month = MONTHS[monthName.toLowerCase()];
    if (!month) continue;
    events.push({
      title: titleCell,
      startDate: toDateKey(Number(year), month, Number(startDay)),
      endDate: toDateKey(Number(year), month, Number(endDay || startDay)),
      category: "deped",
    });
  }
  return events;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd functions && npx vitest run __tests__/depedCalendarParser.test.js --reporter=compact && cd ..`
Expected: PASS

- [ ] **Step 6: Write `functions/syncDepedCalendar.js`**

```javascript
// functions/syncDepedCalendar.js
// Runs daily. Fetches DepEd's published official School Calendar page and
// upserts parsed events into depedCalendarEvents. This collection is
// supplementary/informational only -- it never overrides the Term 1/2/3
// boundaries owned by settings/schoolConfig (academicCalendar.js).

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { parseDepedCalendarHtml } from "./depedCalendarParser.js";

const DEPED_CALENDAR_URL = "https://www.deped.gov.ph/school-calendar/";

function stableId(title, startDate) {
  // Simple deterministic key so re-runs upsert instead of duplicating.
  return `${startDate}-${title}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 200);
}

export const syncDepedCalendar = onSchedule(
  { schedule: "every 24 hours", region: "asia-southeast1", timeoutSeconds: 60 },
  async () => {
    const db = getFirestore();
    const collection = db.collection("depedCalendarEvents");

    let html;
    try {
      const response = await fetch(DEPED_CALENDAR_URL);
      if (!response.ok) {
        console.warn(`DepEd calendar fetch failed: ${response.status}`);
        return;
      }
      html = await response.text();
    } catch (error) {
      console.error("Failed to fetch DepEd calendar page:", error);
      return;
    }

    const events = parseDepedCalendarHtml(html);
    if (events.length === 0) {
      console.warn("DepEd calendar parser found zero events -- page structure may have changed.");
      return;
    }

    const batch = db.batch();
    for (const event of events) {
      const ref = collection.doc(stableId(event.title, event.startDate));
      batch.set(ref, {
        ...event,
        sourceDoLink: DEPED_CALENDAR_URL,
        updatedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }
);
```

- [ ] **Step 7: Write the failing client-side test**

Add to `src/utils/__tests__/schoolCalendar.test.js`:

```javascript
import { depedCalendarEntries } from "../schoolCalendar.js";

describe("depedCalendarEntries", () => {
  it("expands a DepEd calendar event's date range", () => {
    const events = [{
      id: "dc1",
      title: "Term 1 Final Examinations",
      startDate: "2026-09-15",
      endDate: "2026-09-19",
    }];
    const entries = depedCalendarEntries(events);
    expect(entries).toHaveLength(5);
    expect(entries[0]).toEqual({
      kind: "depedCalendar",
      dateKey: "2026-09-15",
      title: "Term 1 Final Examinations",
      subtitle: "DepEd Official Calendar",
      tone: "blue",
      id: "dc1",
    });
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js --reporter=compact`
Expected: FAIL — `depedCalendarEntries` not exported.

- [ ] **Step 9: Implement `depedCalendarEntries` in `src/utils/schoolCalendar.js`**

```javascript
function depedCalendarEntries(events = []) {
  const entries = [];
  for (const event of events) {
    if (!event?.startDate) continue;
    for (const dateKey of expandDateRange(event.startDate, event.endDate)) {
      entries.push({
        kind: "depedCalendar",
        dateKey,
        title: event.title,
        subtitle: "DepEd Official Calendar",
        tone: "blue",
        id: event.id,
      });
    }
  }
  return entries;
}
export { depedCalendarEntries };
```

Wire into `buildCalendarMonth` and `getUpcomingEntries` the same way as
`advisoryEntries`: destructure `depedCalendarEvents = []` from
`sources`, spread `...depedCalendarEntries(depedCalendarEvents)` into
`entries`, add `"depedCalendar": 4` to the `order` map (sorts after
events, same tier as a normal informational entry).

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js --reporter=compact`
Expected: PASS

- [ ] **Step 11: Subscribe to `depedCalendarEvents` in `SchoolCalendar.jsx`**

Same pattern as Task 6 Step 7:

```jsx
const [depedCalendarEvents, setDepedCalendarEvents] = useState([]);

useEffect(() => {
  const q = query(collection(db, "depedCalendarEvents"), orderBy("startDate", "desc"), limit(200));
  const unsubscribe = onSnapshot(
    q,
    (snap) => setDepedCalendarEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => setDepedCalendarEvents([])
  );
  return () => unsubscribe();
}, []);
```

Pass `depedCalendarEvents` into both `buildCalendarMonth(...)` and
`getUpcomingEntries(...)` calls.

- [ ] **Step 12: Lint both projects**

Run: `npx eslint src/SchoolCalendar.jsx src/utils/schoolCalendar.js`
Run: `cd functions && npx eslint . --no-eslintrc --env es2022 --parser-options=sourceType:module || true && cd ..`
(If `functions/` has no ESLint config of its own, skip strict linting
there — just confirm `node --check functions/*.js` passes for syntax
validity: `cd functions && for f in *.js; do node --check "$f"; done && cd ..`)

- [ ] **Step 13: Commit**

```bash
git add functions/syncDepedCalendar.js functions/depedCalendarParser.js functions/__tests__/depedCalendarParser.test.js functions/package.json src/utils/schoolCalendar.js src/utils/__tests__/schoolCalendar.test.js src/SchoolCalendar.jsx
git commit -m "feat: add DepEd official calendar sync and parser"
```

---

## Task 8: Birthday and weather panel UI in `SchoolCalendar.jsx`

**Files:**
- Modify: `src/SchoolCalendar.jsx`

**Interfaces:**
- Consumes: `fetchForecast` from `weather.js` (Task 2), `ENTRY_TONES` (existing), `EVENT_CATEGORIES`/`EVENT_CATEGORY_MAP` (Task 3), `users` Firestore collection (already used elsewhere in the app for personnel lists — subscribe the same way as `schoolEvents`).

- [ ] **Step 1: Add the `users` subscription**

Add alongside the existing `schoolEvents`/`announcements` `useEffect`
blocks in `SchoolCalendar.jsx`:

```jsx
const [personnel, setPersonnel] = useState([]);

useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, "users"),
    (snap) => setPersonnel(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => setPersonnel([])
  );
  return () => unsubscribe();
}, []);
```

Add `users: personnel` to the `sources` object passed into both
`buildCalendarMonth(...)` and `getUpcomingEntries(...)`.

Add `violet` to the `ENTRY_TONES` map if not already present (it already
is, per the existing map at the top of the file — confirm and skip if
so).

- [ ] **Step 2: Add the weather forecast strip**

Add state and an effect that fetches once on mount and polls hourly:

```jsx
const [forecast, setForecast] = useState([]);
const [schoolConfig, setSchoolConfig] = useState(null); // read from existing useSchoolConfig hook if one exists -- grep for it first

useEffect(() => {
  if (!schoolConfig?.latitude || !schoolConfig?.longitude) return;
  let cancelled = false;

  async function load() {
    try {
      const data = await fetchForecast(schoolConfig.latitude, schoolConfig.longitude);
      if (!cancelled) setForecast(data);
    } catch (error) {
      console.error("Failed to fetch weather forecast:", error);
    }
  }

  load();
  const interval = setInterval(load, 60 * 60 * 1000);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, [schoolConfig?.latitude, schoolConfig?.longitude]);
```

Before writing this, run `grep -rn "useSchoolConfig" src/hooks
src/SchoolCalendar.jsx` — if a `useSchoolConfig()` hook already exists
(CLAUDE.md §8C references it), use it to obtain `schoolConfig` instead
of adding a new Firestore read; only add a raw `onSnapshot(doc(db,
"settings", "schoolConfig"))` subscription here if no such hook exists.

Render a small strip in the JSX, in the space between the header and the
existing error banner:

```jsx
{forecast.length > 0 && (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {forecast.map((day) => (
      <div
        key={day.dateKey}
        className={`flex-shrink-0 w-20 text-center px-2 py-2 rounded-lg border text-xs ${
          day.severe
            ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
            : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        }`}
      >
        <p className="font-semibold text-gray-700 dark:text-gray-200">
          {new Date(`${day.dateKey}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" })}
        </p>
        <p className="text-gray-500 dark:text-gray-400">{Math.round(day.tempMaxC)}°/{Math.round(day.tempMinC)}°</p>
        {day.severe && <p className="text-red-600 dark:text-red-400 font-medium mt-0.5">Severe</p>}
      </div>
    ))}
    <p className="text-[10px] text-gray-400 dark:text-gray-500 self-center ml-1">
      General forecast — not an official PAGASA bulletin.
    </p>
  </div>
)}
```

- [ ] **Step 3: Run the full targeted test suite**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js src/utils/__tests__/weather.test.js --reporter=compact`
Expected: PASS (all tests from Tasks 1, 2, 6, 7 still pass with the new
composition).

- [ ] **Step 4: Lint**

Run: `npx eslint src/SchoolCalendar.jsx`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open the School Calendar page as a user with
`canManageSchoolEvents` access, and confirm: birthdays render on the
grid (seed a test user with a birthdate first), the weather strip
appears (requires `schoolConfig.latitude`/`longitude` set via Task 2's
School Identity tab addition — set it, e.g. to the school's actual
coordinates), and no console errors appear when `weatherAdvisories`/
`depedCalendarEvents` collections are empty (the normal case pre-deploy
of Cloud Functions).

- [ ] **Step 6: Commit**

```bash
git add src/SchoolCalendar.jsx
git commit -m "feat: render personnel birthdays and weather forecast strip on the school calendar"
```

---

## Task 9: Deploy Cloud Functions and final verification

**Files:** none (deployment + verification only)

- [ ] **Step 1: Deploy functions**

Run: `npx firebase-tools deploy --only functions`
Expected: `syncPagasaBulletins` and `syncDepedCalendar` both deploy
successfully as scheduled functions.

- [ ] **Step 2: Manually trigger each function once to verify end-to-end**

Via Firebase Console → Cloud Scheduler, trigger both jobs once. Confirm
`weatherAdvisories` and `depedCalendarEvents` collections populate (or,
for `weatherAdvisories`, confirm it stays empty if there's no active
cyclone at test time — check Cloud Functions logs to confirm the
function ran and found zero bulletins rather than erroring).

- [ ] **Step 3: Run the full targeted test suite one more time**

Run: `npx vitest run src/utils/__tests__/schoolCalendar.test.js src/utils/__tests__/weather.test.js --reporter=compact`
Run: `cd functions && npx vitest run __tests__/depedCalendarParser.test.js --reporter=compact && cd ..`
Expected: all PASS.

- [ ] **Step 4: Run the release-gate agent**

Use the `release-gate` agent to check lint/test/build, unintended files,
Firestore rule coverage for the two new collections, print-safety
(unaffected — no printable components touched), dark mode, and
constraint adherence (no React Router, 3-term system preserved, no new
frontend npm dependency).

- [ ] **Step 5: Final commit if release-gate requested fixes**

```bash
git add -A
git commit -m "fix: address release-gate findings for comprehensive calendar feature"
```
