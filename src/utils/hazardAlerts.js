// src/utils/hazardAlerts.js
// Normalizes every hazard signal LIKHA-SIS can reach into one comparable alert
// shape, so the notification panel renders a single ranked list.
//
// CRITICAL DISTINCTION -- do not collapse these two categories:
//
//   official: true   Manually posted by the Principal or ICT Coordinator,
//                    transcribed from an actual NDRRMC / DepEd / LGU bulletin.
//                    These carry authority. A class suspension is one of these.
//
//   official: false  Automated environmental readings derived from Open-Meteo
//                    and USGS. These are DECISION INPUTS, never orders. A
//                    rainfall reading crossing a threshold does not suspend
//                    classes -- only a posted advisory does.
//
// NDRRMC and PAGASA publish no free CORS-enabled API, and this is a client-only
// Firebase build with no Cloud Functions to proxy through, so automatic ingest
// of official bulletins is not achievable from the browser. The manual posting
// path in Announcements is how official notices actually enter the system; the
// automated signals below exist to prompt someone to go look.

export const ALERT_SEVERITY = {
  info: 0,
  warning: 1,
  danger: 2,
};

export const SEVERITY_LABELS = {
  info: "Advisory",
  warning: "Warning",
  danger: "Danger",
};

// Thresholds. The heat-index figure matches the level at which DepEd guidance
// has schools consider suspending face-to-face classes; it is surfaced to the
// Principal as an input to that decision, not as an automatic suspension.
export const THRESHOLDS = {
  rainWarningMm: 50,
  rainDangerMm: 100,
  windWarningKph: 62,
  windDangerKph: 89,
  heatIndexDangerC: 42,
  quakeMinMagnitude: 4.5,
  quakeDangerMagnitude: 6.0,
  quakeRadiusKm: 300,
  quakeLookbackDays: 7,
};

function alert({ id, severity, source, title, detail, issuedAt, official = false }) {
  return { id, severity, source, title, detail, issuedAt, official };
}

/**
 * Derives automated weather alerts from a normalized weatherService payload.
 * Examines today's forecast entry only -- a warning about conditions three days
 * out is noise in a notification bell.
 */
export function deriveWeatherAlerts(weather) {
  if (!weather || !Array.isArray(weather.forecast) || weather.forecast.length === 0) {
    return [];
  }

  const today = weather.forecast[0];
  const issuedAt = weather.observedAt || today.date || null;
  const alerts = [];

  const rain = today.precipitationSum;
  if (typeof rain === "number") {
    if (rain >= THRESHOLDS.rainDangerMm) {
      alerts.push(
        alert({
          id: `weather-rain-${today.date}`,
          severity: "danger",
          source: "Open-Meteo",
          title: "Very heavy rainfall expected",
          detail: `About ${Math.round(rain)} mm of rain forecast today. Check for LGU or DepEd class suspension announcements.`,
          issuedAt,
        })
      );
    } else if (rain >= THRESHOLDS.rainWarningMm) {
      alerts.push(
        alert({
          id: `weather-rain-${today.date}`,
          severity: "warning",
          source: "Open-Meteo",
          title: "Heavy rainfall expected",
          detail: `About ${Math.round(rain)} mm of rain forecast today. Flooding is possible on low-lying routes to school.`,
          issuedAt,
        })
      );
    }
  }

  const wind = today.windSpeedMax;
  if (typeof wind === "number") {
    if (wind >= THRESHOLDS.windDangerKph) {
      alerts.push(
        alert({
          id: `weather-wind-${today.date}`,
          severity: "danger",
          source: "Open-Meteo",
          title: "Storm-force winds expected",
          detail: `Winds up to ${Math.round(wind)} km/h forecast today. Secure outdoor equipment and check for advisories.`,
          issuedAt,
        })
      );
    } else if (wind >= THRESHOLDS.windWarningKph) {
      alerts.push(
        alert({
          id: `weather-wind-${today.date}`,
          severity: "warning",
          source: "Open-Meteo",
          title: "Gale-force winds expected",
          detail: `Winds up to ${Math.round(wind)} km/h forecast today.`,
          issuedAt,
        })
      );
    }
  }

  const heat = today.apparentTempMax;
  if (typeof heat === "number" && heat >= THRESHOLDS.heatIndexDangerC) {
    alerts.push(
      alert({
        id: `weather-heat-${today.date}`,
        severity: "danger",
        source: "Open-Meteo",
        title: "Dangerous heat index",
        detail: `Heat index may reach ${Math.round(heat)}°C today, at or above the ${THRESHOLDS.heatIndexDangerC}°C level where suspending face-to-face classes should be considered.`,
        issuedAt,
      })
    );
  }

  return alerts;
}

export function buildEarthquakeUrl(latitude, longitude, now = new Date()) {
  const start = new Date(now.getTime() - THRESHOLDS.quakeLookbackDays * 86400000);
  const params = new URLSearchParams({
    format: "geojson",
    latitude: String(latitude),
    longitude: String(longitude),
    maxradiuskm: String(THRESHOLDS.quakeRadiusKm),
    minmagnitude: String(THRESHOLDS.quakeMinMagnitude),
    starttime: start.toISOString().slice(0, 10),
    orderby: "time",
  });
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`;
}

/** Converts a USGS GeoJSON FeatureCollection into alerts. */
export function normalizeEarthquakeResponse(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features
    .map((feature) => {
      const props = feature?.properties || {};
      const magnitude = typeof props.mag === "number" ? props.mag : null;
      if (magnitude === null) return null;
      return alert({
        id: `quake-${feature.id}`,
        severity: magnitude >= THRESHOLDS.quakeDangerMagnitude ? "danger" : "warning",
        source: "USGS",
        title: `Magnitude ${magnitude.toFixed(1)} earthquake nearby`,
        detail: props.place ? `Recorded near ${props.place}.` : "Recorded near your school.",
        issuedAt: props.time ? new Date(props.time).toISOString() : null,
      });
    })
    .filter(Boolean);
}

/**
 * Fetches recent significant earthquakes near the school.
 * Resolves to [] rather than throwing: a dead seismic feed must silently drop
 * its section, not take down the notification bell.
 */
export async function fetchEarthquakeAlerts(latitude, longitude, now = new Date()) {
  try {
    const response = await fetch(buildEarthquakeUrl(latitude, longitude, now));
    if (!response.ok) return [];
    return normalizeEarthquakeResponse(await response.json());
  } catch {
    return [];
  }
}

/**
 * Promotes manually posted NDRRMC advisories and class suspensions into the
 * alert stream. Only those two announcement types become alerts -- a DepEd
 * Order is important but it is not an emergency, and burying a real typhoon
 * warning under routine memoranda is exactly the failure to avoid.
 */
export function announcementsToAlerts(announcements = [], today = new Date()) {
  const todayKey =
    today instanceof Date ? today.toISOString().slice(0, 10) : String(today).slice(0, 10);

  return announcements
    .filter((a) => a && (a.type === "ndrrmcAdvisory" || a.type === "classSuspension"))
    .filter((a) => !a.expiresAt || a.expiresAt >= todayKey)
    .map((a) =>
      alert({
        id: `announcement-${a.id}`,
        severity: a.type === "classSuspension" || a.priority === "urgent" ? "danger" : "warning",
        source: a.type === "classSuspension" ? "Class Suspension" : "NDRRMC Advisory",
        title: a.title,
        detail: a.body,
        issuedAt: a.effectiveDate || null,
        official: true,
      })
    );
}

/**
 * Merges alert groups into one ranked list: official notices above automated
 * readings, then by severity, then most recent first. Duplicate ids collapse to
 * the first occurrence, so passing the same group twice is harmless.
 */
export function mergeAlerts(...groups) {
  const seen = new Set();
  const merged = [];

  for (const group of groups) {
    for (const item of group || []) {
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged.sort((a, b) => {
    if (a.official !== b.official) return a.official ? -1 : 1;
    const severityDiff = (ALERT_SEVERITY[b.severity] ?? 0) - (ALERT_SEVERITY[a.severity] ?? 0);
    if (severityDiff !== 0) return severityDiff;
    return String(b.issuedAt || "").localeCompare(String(a.issuedAt || ""));
  });
}
