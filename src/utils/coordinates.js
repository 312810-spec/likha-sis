// src/utils/coordinates.js
// Normalizes the school's latitude/longitude between the text inputs that
// collect them and the numeric fields that consume them (the local weather
// card and the nearby-earthquake radius).

/**
 * Converts a form value to a finite number, or null.
 *
 * Blank, null, and unparseable input all collapse to null rather than NaN:
 * writing NaN into settings/schoolConfig would serialize badly and leave the
 * weather card in a permanently broken state instead of simply hidden.
 */
export function toCoordinate(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** True when both coordinates resolve to usable numbers in valid ranges. */
export function hasValidCoordinates(latitude, longitude) {
  const lat = toCoordinate(latitude);
  const lon = toCoordinate(longitude);
  if (lat === null || lon === null) return false;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
