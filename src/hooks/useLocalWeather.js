// src/hooks/useLocalWeather.js
// Current conditions for the school's own coordinates, refreshed on the same
// cadence as the weatherService cache.

import { useState, useEffect, useCallback } from "react";
import useSchoolConfig from "./useSchoolConfig.js";
import { fetchWeather, WEATHER_CACHE_TTL_MS } from "../utils/weatherService.js";

function usableCoordinate(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @returns {{
 *   weather: object|null,
 *   loading: boolean,
 *   error: string|null,
 *   stale: boolean,
 *   needsCoordinates: boolean,
 *   latitude: number|null,
 *   longitude: number|null,
 *   refresh: () => void
 * }}
 *
 * `stale` means the data came from an expired cache because the network was
 * unreachable — the UI should show it with a "last updated" note rather than
 * hide it. `needsCoordinates` means the school hasn't set a location yet, which
 * is a settings prompt, not an error.
 */
export default function useLocalWeather() {
  const { config, loading: configLoading } = useSchoolConfig();
  // `settledFor` records which request the stored result belongs to, so loading
  // can be DERIVED rather than set synchronously inside the effect (which would
  // trigger the cascading render react-hooks/set-state-in-effect warns about).
  const [state, setState] = useState({
    weather: null,
    error: null,
    stale: false,
    settledFor: null,
  });
  const [reloadToken, setReloadToken] = useState(0);

  const latitude = usableCoordinate(config?.latitude);
  const longitude = usableCoordinate(config?.longitude);
  const hasCoordinates = latitude !== null && longitude !== null;
  const requestKey = hasCoordinates ? `${latitude},${longitude}:${reloadToken}` : null;

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (configLoading || !hasCoordinates) return undefined;

    let cancelled = false;

    fetchWeather(latitude, longitude, { force: reloadToken > 0 })
      .then((result) => {
        if (cancelled) return;
        setState({
          weather: result.data,
          error: null,
          stale: result.stale,
          settledFor: requestKey,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // A failed forecast is not worth an error banner — the card just says
        // conditions are unavailable and the rest of the dashboard is fine.
        setState({
          weather: null,
          error: "Weather unavailable",
          stale: false,
          settledFor: requestKey,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [configLoading, hasCoordinates, latitude, longitude, reloadToken, requestKey]);

  // Re-fetch when the cache would have expired, so a dashboard left open all
  // day doesn't show morning conditions at dismissal time.
  useEffect(() => {
    if (!hasCoordinates) return undefined;
    const timer = setInterval(refresh, WEATHER_CACHE_TTL_MS);
    return () => clearInterval(timer);
  }, [hasCoordinates, refresh]);

  return {
    weather: state.weather,
    error: state.error,
    stale: state.stale,
    loading: !configLoading && hasCoordinates && state.settledFor !== requestKey,
    needsCoordinates: !configLoading && !hasCoordinates,
    latitude,
    longitude,
    refresh,
  };
}
