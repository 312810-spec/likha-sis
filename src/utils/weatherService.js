// src/utils/weatherService.js
// Local weather for the school's coordinates, via Open-Meteo.
//
// Open-Meteo is used because it is the only forecast source that satisfies all
// three constraints this app operates under: free without an API key (LIKHA-SIS
// ships no secrets -- it's a client-only Firebase build), CORS-enabled (there is
// no server to proxy through), and no npm dependency (plain fetch, same
// precedent as the api.qrserver.com QR integration).
//
// Responses are cached in localStorage for 30 minutes so the app doesn't re-hit
// the API on every render, and so a school with intermittent connectivity still
// sees last-known conditions instead of an empty card.

const OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export const WEATHER_CACHE_KEY = "likha.weather.cache";
export const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
];

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
];

// WMO weather interpretation codes -> label + a lucide-react icon name.
// Icon names are strings, not components, so this module stays pure and
// unit-testable without pulling React into a util.
const WEATHER_CODES = {
  0: { label: "Clear sky", icon: "Sun" },
  1: { label: "Mainly clear", icon: "CloudSun" },
  2: { label: "Partly cloudy", icon: "CloudSun" },
  3: { label: "Overcast", icon: "Cloudy" },
  45: { label: "Fog", icon: "CloudFog" },
  48: { label: "Depositing rime fog", icon: "CloudFog" },
  51: { label: "Light drizzle", icon: "CloudDrizzle" },
  53: { label: "Moderate drizzle", icon: "CloudDrizzle" },
  55: { label: "Dense drizzle", icon: "CloudDrizzle" },
  56: { label: "Light freezing drizzle", icon: "CloudDrizzle" },
  57: { label: "Dense freezing drizzle", icon: "CloudDrizzle" },
  61: { label: "Slight rain", icon: "CloudRain" },
  63: { label: "Moderate rain", icon: "CloudRain" },
  65: { label: "Heavy rain", icon: "CloudRainWind" },
  66: { label: "Light freezing rain", icon: "CloudRain" },
  67: { label: "Heavy freezing rain", icon: "CloudRainWind" },
  71: { label: "Slight snowfall", icon: "CloudSnow" },
  73: { label: "Moderate snowfall", icon: "CloudSnow" },
  75: { label: "Heavy snowfall", icon: "CloudSnow" },
  77: { label: "Snow grains", icon: "Snowflake" },
  80: { label: "Slight rain showers", icon: "CloudRain" },
  81: { label: "Moderate rain showers", icon: "CloudRain" },
  82: { label: "Violent rain showers", icon: "CloudRainWind" },
  85: { label: "Slight snow showers", icon: "CloudSnow" },
  86: { label: "Heavy snow showers", icon: "CloudSnow" },
  95: { label: "Thunderstorm", icon: "CloudLightning" },
  96: { label: "Thunderstorm with slight hail", icon: "CloudLightning" },
  99: { label: "Thunderstorm with heavy hail", icon: "CloudLightning" },
};

/** Label + icon for a WMO code. Unknown/missing codes degrade to a neutral cloud. */
export function describeWeatherCode(code) {
  return WEATHER_CODES[code] || { label: "Unknown conditions", icon: "Cloud" };
}

export function buildWeatherUrl(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: CURRENT_FIELDS.join(","),
    daily: DAILY_FIELDS.join(","),
    timezone: "Asia/Manila",
    forecast_days: "3",
  });
  return `${OPEN_METEO_ENDPOINT}?${params.toString()}`;
}

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Reshapes Open-Meteo's parallel-arrays payload into the flat object the UI and
 * hazardAlerts consume, so no consumer has to know Open-Meteo's field names.
 * Returns null for a payload missing the `current` block entirely.
 */
export function normalizeWeatherResponse(payload) {
  if (!payload || typeof payload !== "object" || !payload.current) return null;

  const current = payload.current;
  const daily = payload.daily || {};
  const dayCount = Array.isArray(daily.time) ? daily.time.length : 0;

  const forecast = [];
  for (let i = 0; i < dayCount; i += 1) {
    forecast.push({
      date: daily.time[i],
      weatherCode: num(daily.weather_code?.[i]),
      tempMax: num(daily.temperature_2m_max?.[i]),
      tempMin: num(daily.temperature_2m_min?.[i]),
      apparentTempMax: num(daily.apparent_temperature_max?.[i]),
      precipitationSum: num(daily.precipitation_sum?.[i]),
      precipitationChance: num(daily.precipitation_probability_max?.[i]),
      windSpeedMax: num(daily.wind_speed_10m_max?.[i]),
    });
  }

  return {
    observedAt: current.time || null,
    latitude: num(payload.latitude),
    longitude: num(payload.longitude),
    temperature: num(current.temperature_2m),
    apparentTemperature: num(current.apparent_temperature),
    humidity: num(current.relative_humidity_2m),
    precipitation: num(current.precipitation),
    weatherCode: num(current.weather_code),
    windSpeed: num(current.wind_speed_10m),
    forecast,
  };
}

export function readCachedWeather(now = Date.now(), storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.cachedAt !== "number" || !parsed.data) return null;
    return {
      data: parsed.data,
      key: parsed.key || null,
      // Expired entries are still returned, flagged stale: showing yesterday's
      // conditions labelled "last updated ..." beats showing nothing when the
      // school's connection is down.
      stale: now - parsed.cachedAt > WEATHER_CACHE_TTL_MS,
      cachedAt: parsed.cachedAt,
    };
  } catch {
    return null;
  }
}

export function writeCachedWeather(data, key, now = Date.now(), storage = globalThis.localStorage) {
  try {
    storage?.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, key, cachedAt: now }));
  } catch {
    // Private-mode or quota-exceeded localStorage must never break the page.
  }
}

/** Cache key so moving the school's coordinates invalidates a stale location. */
export function coordinateKey(latitude, longitude) {
  return `${Number(latitude).toFixed(3)},${Number(longitude).toFixed(3)}`;
}

/**
 * Fetches current conditions for the given coordinates, preferring a fresh
 * cache entry for the same location.
 *
 * @returns {Promise<{ data: object, stale: boolean, cachedAt: number }>}
 * @throws when the network fails AND no cached entry exists for the location.
 */
export async function fetchWeather(latitude, longitude, { force = false, now = Date.now() } = {}) {
  const key = coordinateKey(latitude, longitude);
  const cached = readCachedWeather(now);

  if (!force && cached && cached.key === key && !cached.stale) {
    return { data: cached.data, stale: false, cachedAt: cached.cachedAt };
  }

  try {
    const response = await fetch(buildWeatherUrl(latitude, longitude));
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
    const normalized = normalizeWeatherResponse(await response.json());
    if (!normalized) throw new Error("Weather response missing current conditions");
    writeCachedWeather(normalized, key, now);
    return { data: normalized, stale: false, cachedAt: now };
  } catch (error) {
    if (cached && cached.key === key) {
      return { data: cached.data, stale: true, cachedAt: cached.cachedAt };
    }
    throw error;
  }
}
