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
