// src/utils/dashboardFormatters.js
// Pure formatting helpers shared by the Dashboard widgets. Split out of
// components/dashboard/primitives.jsx (react-refresh/only-export-components
// requires a file to export either components or plain values, not both).

export function formatCount(n) {
  return Number(n || 0).toLocaleString('en-US');
}

// Firestore timestamps may arrive as `Date`, an object with `toMillis()`, a
// `{ seconds, nanoseconds }` object, or an ISO string. Normalize to epoch ms.
export function timestampToMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

export function formatActivityDate(value) {
  const ms = timestampToMillis(value);
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Nutrition statuses treated as "requires follow-up" -- mirrors the concerning
// list in src/utils/autoFlagTriggers.js's checkAutoFlagTriggers(), which is
// the authoritative auto-flag trigger. This copy is display-only (dashboard
// summary counts), not a second source of truth for flagging decisions.
export const CONCERNING_NUTRITION_STATUSES = ['Severely Wasted', 'Wasted', 'Obese'];
