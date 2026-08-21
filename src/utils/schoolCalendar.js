// src/utils/schoolCalendar.js
// Composes the four calendar sources into a month grid and an upcoming-events
// list. All date arithmetic lives here so SchoolCalendar.jsx only renders.
//
// Sources, in the order they stack on a day:
//   1. term        -- boundaries from academicCalendar.js (Term 1/2/3)
//   2. suspension  -- posted classSuspension announcements
//   3. holiday     -- philippineHolidays.js
//   4. event       -- the schoolEvents Firestore collection

import {
  getHolidaysInRange,
  getUpcomingHolidays,
  toDateKey,
  HOLIDAY_TYPE_LABELS,
} from "./philippineHolidays.js";
import academicCalendar from "../academicCalendar.js";

export const EVENT_CATEGORIES = [
  { id: "examination", label: "Examination", tint: "amber" },
  { id: "activity", label: "School Activity", tint: "blue" },
  { id: "deadline", label: "Deadline", tint: "rose" },
  { id: "meeting", label: "Meeting", tint: "violet" },
  { id: "depedAnnouncement", label: "DepEd/Gov Announcement", tint: "blue" },
  { id: "holiday", label: "School Holiday", tint: "emerald" },
];

export const EVENT_CATEGORY_MAP = EVENT_CATEGORIES.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return next;
}

/** Every date key from start to end inclusive, for multi-day events. */
export function expandDateRange(startDate, endDate) {
  const start = toDateKey(startDate);
  const end = toDateKey(endDate || startDate);
  if (!start) return [];
  if (!end || end < start) return [start];

  const keys = [];
  let cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  // Guard against a malformed range producing an unbounded loop.
  let guard = 0;
  while (cursor <= last && guard < 400) {
    keys.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return keys;
}

/** The term containing a date, across every configured school year. */
export function getTermForDate(dateKey) {
  for (const year of Object.values(academicCalendar)) {
    for (const term of year.terms || []) {
      if (dateKey >= term.startDate && dateKey <= term.endDate) {
        return { ...term, schoolYearLabel: year.schoolYearLabel };
      }
    }
  }
  return null;
}

/** True when the date is the first or last day of a term — worth marking. */
export function getTermBoundary(dateKey) {
  for (const year of Object.values(academicCalendar)) {
    for (const term of year.terms || []) {
      if (dateKey === term.startDate) return { term, edge: "start" };
      if (dateKey === term.endDate) return { term, edge: "end" };
    }
  }
  return null;
}

function holidayEntries(from, to) {
  return getHolidaysInRange(from, to).map((h) => ({
    kind: "holiday",
    dateKey: h.date,
    title: h.approximate ? `${h.name} (date subject to proclamation)` : h.name,
    subtitle: HOLIDAY_TYPE_LABELS[h.type] || "",
    tone: h.type === "regular" ? "rose" : "amber",
  }));
}

function eventEntries(schoolEvents = []) {
  const entries = [];
  for (const event of schoolEvents) {
    if (!event?.startDate) continue;
    const category = EVENT_CATEGORY_MAP[event.category] || EVENT_CATEGORY_MAP.activity;
    for (const dateKey of expandDateRange(event.startDate, event.endDate)) {
      entries.push({
        kind: "event",
        dateKey,
        title: event.title,
        subtitle: category.label,
        tone: category.tint,
        id: event.id,
        description: event.description || "",
      });
    }
  }
  return entries;
}

function suspensionEntries(announcements = []) {
  return announcements
    .filter((a) => a?.type === "classSuspension" && a.effectiveDate)
    .flatMap((a) =>
      expandDateRange(a.effectiveDate, a.expiresAt).map((dateKey) => ({
        kind: "suspension",
        dateKey,
        title: a.title,
        subtitle: "Classes Suspended",
        tone: "red",
        id: a.id,
      }))
    );
}

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

/** Expands a PAGASA weather advisory's validity window into one entry per day. */
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

/** Expands a synced DepEd official calendar event's date range into one entry per day. */
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

/**
 * Builds a 6x7 day grid for the given month, with each day's entries merged.
 *
 * Always six weeks so the grid doesn't reflow height between months. Days
 * outside the requested month are included with `inMonth: false` rather than
 * blanked, so a holiday on the 1st or 31st is still visible in the adjacent
 * month's view.
 *
 * @param {number} year  full year, e.g. 2026
 * @param {number} month zero-based, matching Date#getMonth
 */
export function buildCalendarMonth(year, month, sources = {}) {
  const {
    schoolEvents = [],
    announcements = [],
    users = [],
    weatherAdvisories = [],
    depedCalendarEvents = [],
    today = new Date(),
  } = sources;

  const firstOfMonth = new Date(year, month, 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const gridEnd = addDays(gridStart, 41);

  const entries = [
    ...holidayEntries(gridStart, gridEnd),
    ...eventEntries(schoolEvents),
    ...suspensionEntries(announcements),
    ...birthdayEntries(users, year),
    ...advisoryEntries(weatherAdvisories),
    ...depedCalendarEntries(depedCalendarEvents),
  ];

  const byDate = entries.reduce((acc, entry) => {
    (acc[entry.dateKey] = acc[entry.dateKey] || []).push(entry);
    return acc;
  }, {});

  const order = { advisory: 0, suspension: 0, holiday: 1, event: 2, birthday: 3, depedCalendar: 4 };
  const todayKey = toDateKey(today);

  const weeks = [];
  for (let w = 0; w < 6; w += 1) {
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(gridStart, w * 7 + d);
      const dateKey = toDateKey(date);
      days.push({
        date,
        dateKey,
        dayOfMonth: date.getDate(),
        inMonth: date.getMonth() === month,
        isToday: dateKey === todayKey,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        term: getTermForDate(dateKey),
        termBoundary: getTermBoundary(dateKey),
        entries: (byDate[dateKey] || []).sort(
          (a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9)
        ),
      });
    }
    weeks.push(days);
  }

  return { year, month, weeks };
}

/**
 * Flat, date-ascending list of what is coming in the next `days` — holidays and
 * school events together. Feeds both the notification panel's "Coming up"
 * section and the calendar page's side list.
 */
export function getUpcomingEntries(sources = {}, from = new Date(), days = 30) {
  const {
    schoolEvents = [],
    announcements = [],
    users = [],
    weatherAdvisories = [],
    depedCalendarEvents = [],
    limit = 8,
  } = sources;

  const start = toDateKey(from);
  const endDate = new Date(`${start}T00:00:00`);
  endDate.setDate(endDate.getDate() + days);
  const end = toDateKey(endDate);

  const fromYear = new Date(`${start}T00:00:00`).getFullYear();

  const entries = [
    ...holidayEntries(start, end),
    ...eventEntries(schoolEvents),
    ...suspensionEntries(announcements),
    ...birthdayEntries(users, fromYear),
    ...birthdayEntries(users, fromYear + 1),
    ...advisoryEntries(weatherAdvisories),
    ...depedCalendarEntries(depedCalendarEvents),
  ]
    .filter((e) => e.dateKey >= start && e.dateKey <= end)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  // Multi-day events expand to one entry per day; collapse to the first day so
  // a week-long exam period doesn't consume the whole "coming up" list.
  const seen = new Set();
  const collapsed = [];
  for (const entry of entries) {
    const dedupeKey = `${entry.kind}:${entry.id || entry.title}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    collapsed.push(entry);
  }

  return collapsed.slice(0, limit);
}

export { getUpcomingHolidays };
