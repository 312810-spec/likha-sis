// src/utils/philippineHolidays.js
// Philippine regular holidays and special (non-working) days for calendar years
// 2026 and 2027, which together span SY 2026-2027.
//
// This is static data rather than an API call on purpose: holidays must render
// in a PWA that is offline, and a school year must not depend on a third-party
// holiday service staying up. The cost is that it needs a yearly top-up.
//
// CAVEAT the UI must respect: Philippine holidays are fixed each year by
// Presidential Proclamation, and dates DO get moved (holiday economics) or
// added. Entries whose date is genuinely not knowable in advance -- the Islamic
// holidays, which follow lunar observation -- carry `approximate: true` and must
// be displayed as provisional. Everything else reflects the customary date rule
// for that holiday.

/** @typedef {"regular"|"specialNonWorking"|"observance"} HolidayType */

export const HOLIDAY_TYPE_LABELS = {
  regular: "Regular Holiday",
  specialNonWorking: "Special (Non-Working) Day",
  observance: "Observance",
};

export const PHILIPPINE_HOLIDAYS = [
  // ---- 2026 ----
  { date: "2026-01-01", name: "New Year's Day", type: "regular" },
  { date: "2026-02-17", name: "Chinese New Year", type: "specialNonWorking" },
  { date: "2026-02-25", name: "EDSA People Power Revolution Anniversary", type: "observance" },
  { date: "2026-03-20", name: "Eid'l Fitr (Feast of Ramadhan)", type: "regular", approximate: true },
  { date: "2026-04-02", name: "Maundy Thursday", type: "regular" },
  { date: "2026-04-03", name: "Good Friday", type: "regular" },
  { date: "2026-04-04", name: "Black Saturday", type: "specialNonWorking" },
  { date: "2026-04-09", name: "Araw ng Kagitingan (Day of Valor)", type: "regular" },
  { date: "2026-05-01", name: "Labor Day", type: "regular" },
  { date: "2026-05-27", name: "Eid'l Adha (Feast of Sacrifice)", type: "regular", approximate: true },
  { date: "2026-06-12", name: "Independence Day", type: "regular" },
  { date: "2026-08-21", name: "Ninoy Aquino Day", type: "specialNonWorking" },
  { date: "2026-08-31", name: "National Heroes Day", type: "regular" },
  { date: "2026-11-01", name: "All Saints' Day", type: "specialNonWorking" },
  { date: "2026-11-02", name: "All Souls' Day", type: "specialNonWorking" },
  { date: "2026-11-30", name: "Bonifacio Day", type: "regular" },
  { date: "2026-12-08", name: "Feast of the Immaculate Conception", type: "specialNonWorking" },
  { date: "2026-12-24", name: "Christmas Eve", type: "specialNonWorking" },
  { date: "2026-12-25", name: "Christmas Day", type: "regular" },
  { date: "2026-12-30", name: "Rizal Day", type: "regular" },
  { date: "2026-12-31", name: "Last Day of the Year", type: "specialNonWorking" },

  // ---- 2027 ----
  { date: "2027-01-01", name: "New Year's Day", type: "regular" },
  { date: "2027-02-06", name: "Chinese New Year", type: "specialNonWorking" },
  { date: "2027-02-25", name: "EDSA People Power Revolution Anniversary", type: "observance" },
  { date: "2027-03-10", name: "Eid'l Fitr (Feast of Ramadhan)", type: "regular", approximate: true },
  { date: "2027-03-25", name: "Maundy Thursday", type: "regular" },
  { date: "2027-03-26", name: "Good Friday", type: "regular" },
  { date: "2027-03-27", name: "Black Saturday", type: "specialNonWorking" },
  { date: "2027-04-09", name: "Araw ng Kagitingan (Day of Valor)", type: "regular" },
  { date: "2027-05-01", name: "Labor Day", type: "regular" },
  { date: "2027-05-17", name: "Eid'l Adha (Feast of Sacrifice)", type: "regular", approximate: true },
  { date: "2027-06-12", name: "Independence Day", type: "regular" },
  { date: "2027-08-21", name: "Ninoy Aquino Day", type: "specialNonWorking" },
  { date: "2027-08-30", name: "National Heroes Day", type: "regular" },
  { date: "2027-11-01", name: "All Saints' Day", type: "specialNonWorking" },
  { date: "2027-11-02", name: "All Souls' Day", type: "specialNonWorking" },
  { date: "2027-11-30", name: "Bonifacio Day", type: "regular" },
  { date: "2027-12-08", name: "Feast of the Immaculate Conception", type: "specialNonWorking" },
  { date: "2027-12-24", name: "Christmas Eve", type: "specialNonWorking" },
  { date: "2027-12-25", name: "Christmas Day", type: "regular" },
  { date: "2027-12-30", name: "Rizal Day", type: "regular" },
  { date: "2027-12-31", name: "Last Day of the Year", type: "specialNonWorking" },
];

/**
 * Normalizes a Date or "YYYY-MM-DD" string to "YYYY-MM-DD" in LOCAL time.
 *
 * Deliberately avoids toISOString(), which converts to UTC first and therefore
 * reports the previous day for any Philippine local time before 08:00 (UTC+8).
 */
export function toDateKey(value) {
  if (typeof value === "string") return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Holidays falling within [from, to] inclusive, ascending by date. */
export function getHolidaysInRange(from, to) {
  const start = toDateKey(from);
  const end = toDateKey(to);
  if (!start || !end || start > end) return [];
  return PHILIPPINE_HOLIDAYS.filter((h) => h.date >= start && h.date <= end).sort(
    (a, b) => a.date.localeCompare(b.date)
  );
}

/**
 * The next `limit` holidays on or after `from`. Crosses the year boundary
 * naturally because PHILIPPINE_HOLIDAYS is a single flat, sorted list rather
 * than a per-year map.
 */
export function getUpcomingHolidays(from = new Date(), limit = 5) {
  const start = toDateKey(from);
  if (!start) return [];
  return PHILIPPINE_HOLIDAYS.filter((h) => h.date >= start)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, Math.max(0, limit));
}

/** The holiday on a given date, or null. `observance` days are working days. */
export function getHolidayOn(date) {
  const key = toDateKey(date);
  if (!key) return null;
  return PHILIPPINE_HOLIDAYS.find((h) => h.date === key) || null;
}

/**
 * True when classes are suspended nationwide for a proclaimed holiday.
 * `observance` entries (e.g. EDSA anniversary) are commemorations, not days off,
 * so they are excluded.
 */
export function isNonWorkingDay(date) {
  const holiday = getHolidayOn(date);
  if (!holiday) return false;
  return holiday.type === "regular" || holiday.type === "specialNonWorking";
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysUntil(to, from = new Date()) {
  const a = new Date(`${toDateKey(from)}T00:00:00`);
  const b = new Date(`${toDateKey(to)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}
