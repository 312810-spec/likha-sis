// src/components/WeatherCard.jsx
// Local conditions for the school's own coordinates, plus a 3-day outlook.
//
// This card shows READINGS, not warnings. Any hazard interpretation belongs in
// the notification bell where it can be labelled "Automated reading" next to
// genuinely posted advisories -- a weather card that looks like it is issuing
// warnings is exactly the confusion this feature has to avoid.

import {
  Sun,
  CloudSun,
  Cloudy,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  Snowflake,
  CloudLightning,
  Droplets,
  Wind,
  MapPin,
  RefreshCw,
} from "lucide-react";
import useLocalWeather from "../hooks/useLocalWeather.js";
import { describeWeatherCode } from "../utils/weatherService.js";

const ICONS = {
  Sun,
  CloudSun,
  Cloudy,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  Snowflake,
  CloudLightning,
};

function WeatherIcon({ code, size = 20, className = "" }) {
  const { icon } = describeWeatherCode(code);
  const Icon = ICONS[icon] || Cloud;
  return <Icon size={size} className={className} />;
}

function round(value, suffix = "") {
  return typeof value === "number" ? `${Math.round(value)}${suffix}` : "—";
}

function dayLabel(dateKey, index) {
  if (index === 0) return "Today";
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export default function WeatherCard({ onOpenSettings }) {
  const { weather, loading, error, stale, needsCoordinates, refresh } = useLocalWeather();

  const shell =
    "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm";

  if (needsCoordinates) {
    return (
      <div className={shell}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MapPin size={16} className="text-primary" /> Local Weather
        </h3>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Set your school's latitude and longitude in School Settings to show local conditions and
          nearby earthquake alerts.
        </p>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-3 text-xs font-semibold text-primary dark:text-primary-light hover:underline"
          >
            Open School Settings
          </button>
        )}
      </div>
    );
  }

  if (loading && !weather) {
    return (
      <div className={shell}>
        <div className="h-4 w-28 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        <div className="mt-4 h-10 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        <div className="mt-4 h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className={shell}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Cloud size={16} className="text-gray-400" /> Local Weather
        </h3>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Conditions are unavailable right now.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-primary-light hover:underline"
        >
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    );
  }

  if (!weather) return null;

  const { label } = describeWeatherCode(weather.weatherCode);
  const forecast = (weather.forecast || []).slice(0, 3);

  return (
    <div className={shell}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MapPin size={16} className="text-primary" /> Local Weather
        </h3>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh weather"
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <WeatherIcon code={weather.weatherCode} size={40} className="text-primary flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 leading-none tabular-nums">
            {round(weather.temperature, "°")}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span>Feels like {round(weather.apparentTemperature, "°")}</span>
        <span className="inline-flex items-center gap-1">
          <Droplets size={11} /> {round(weather.humidity, "%")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Wind size={11} /> {round(weather.windSpeed)} km/h
        </span>
      </div>

      {forecast.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
          {forecast.map((day, i) => (
            <div key={day.date} className="text-center">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {dayLabel(day.date, i)}
              </p>
              <WeatherIcon
                code={day.weatherCode}
                size={18}
                className="mx-auto my-1 text-gray-400 dark:text-gray-500"
              />
              <p className="text-[11px] text-gray-700 dark:text-gray-200 tabular-nums">
                {round(day.tempMax, "°")} / {round(day.tempMin, "°")}
              </p>
              {typeof day.precipitationChance === "number" && (
                <p className="text-[10px] text-blue-500 dark:text-blue-400 tabular-nums">
                  {Math.round(day.precipitationChance)}% rain
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500">
        {stale
          ? "Showing last known conditions — couldn't reach the weather service."
          : "Source: Open-Meteo. Readings only — not an official PAGASA warning."}
      </p>
    </div>
  );
}
