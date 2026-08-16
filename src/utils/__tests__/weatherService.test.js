import { describe, it, expect, beforeEach } from "vitest";
import {
  describeWeatherCode,
  buildWeatherUrl,
  normalizeWeatherResponse,
  readCachedWeather,
  writeCachedWeather,
  coordinateKey,
  WEATHER_CACHE_KEY,
  WEATHER_CACHE_TTL_MS,
} from "../weatherService.js";

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    _store: store,
  };
}

const OPEN_METEO_PAYLOAD = {
  latitude: 10.33,
  longitude: 123.93,
  current: {
    time: "2026-08-16T09:00",
    temperature_2m: 31.4,
    apparent_temperature: 38.2,
    relative_humidity_2m: 78,
    precipitation: 0.2,
    weather_code: 61,
    wind_speed_10m: 14.8,
  },
  daily: {
    time: ["2026-08-16", "2026-08-17", "2026-08-18"],
    weather_code: [61, 3, 95],
    temperature_2m_max: [32.1, 31.0, 30.4],
    temperature_2m_min: [25.2, 25.0, 24.8],
    apparent_temperature_max: [39.5, 37.0, 36.2],
    precipitation_sum: [12.4, 2.0, 55.0],
    precipitation_probability_max: [80, 30, 95],
    wind_speed_10m_max: [22.0, 18.5, 47.0],
  },
};

describe("weatherService", () => {
  describe("describeWeatherCode", () => {
    it("maps known WMO codes to a label and icon", () => {
      expect(describeWeatherCode(0)).toEqual({ label: "Clear sky", icon: "Sun" });
      expect(describeWeatherCode(95).label).toBe("Thunderstorm");
      expect(describeWeatherCode(65).icon).toBe("CloudRainWind");
    });

    it("degrades gracefully for unknown or missing codes", () => {
      expect(describeWeatherCode(1234)).toEqual({ label: "Unknown conditions", icon: "Cloud" });
      expect(describeWeatherCode(null).icon).toBe("Cloud");
      expect(describeWeatherCode(undefined).icon).toBe("Cloud");
    });
  });

  describe("buildWeatherUrl", () => {
    it("requests Manila time and the fields the UI needs", () => {
      const url = buildWeatherUrl(10.33, 123.93);
      expect(url).toContain("latitude=10.33");
      expect(url).toContain("longitude=123.93");
      expect(url).toContain("timezone=Asia%2FManila");
      expect(url).toContain("apparent_temperature");
      expect(url).toContain("precipitation_sum");
    });
  });

  describe("normalizeWeatherResponse", () => {
    it("flattens the parallel daily arrays into per-day objects", () => {
      const result = normalizeWeatherResponse(OPEN_METEO_PAYLOAD);
      expect(result.temperature).toBe(31.4);
      expect(result.apparentTemperature).toBe(38.2);
      expect(result.weatherCode).toBe(61);
      expect(result.forecast).toHaveLength(3);
      expect(result.forecast[2]).toMatchObject({
        date: "2026-08-18",
        precipitationSum: 55.0,
        windSpeedMax: 47.0,
      });
    });

    it("returns null when the payload has no current conditions", () => {
      expect(normalizeWeatherResponse(null)).toBeNull();
      expect(normalizeWeatherResponse({})).toBeNull();
      expect(normalizeWeatherResponse({ daily: {} })).toBeNull();
    });

    it("nulls out non-numeric readings instead of propagating junk", () => {
      const result = normalizeWeatherResponse({
        current: { time: "2026-08-16T09:00", temperature_2m: "warm", weather_code: 3 },
      });
      expect(result.temperature).toBeNull();
      expect(result.weatherCode).toBe(3);
      expect(result.forecast).toEqual([]);
    });
  });

  describe("coordinateKey", () => {
    it("rounds to three decimals so tiny drift reuses the cache", () => {
      expect(coordinateKey(10.3300001, 123.93)).toBe("10.330,123.930");
    });

    it("differs for genuinely different locations", () => {
      expect(coordinateKey(10.33, 123.93)).not.toBe(coordinateKey(14.6, 121.0));
    });
  });

  describe("cache", () => {
    let storage;

    beforeEach(() => {
      storage = makeStorage();
    });

    it("round-trips a written entry as fresh", () => {
      writeCachedWeather({ temperature: 30 }, "10.330,123.930", 1000, storage);
      const cached = readCachedWeather(1000, storage);
      expect(cached.data.temperature).toBe(30);
      expect(cached.key).toBe("10.330,123.930");
      expect(cached.stale).toBe(false);
    });

    it("flags an entry past the TTL as stale but still returns the data", () => {
      writeCachedWeather({ temperature: 30 }, "k", 0, storage);
      const cached = readCachedWeather(WEATHER_CACHE_TTL_MS + 1, storage);
      expect(cached.stale).toBe(true);
      expect(cached.data.temperature).toBe(30);
    });

    it("treats an entry exactly at the TTL as still fresh", () => {
      writeCachedWeather({ temperature: 30 }, "k", 0, storage);
      expect(readCachedWeather(WEATHER_CACHE_TTL_MS, storage).stale).toBe(false);
    });

    it("returns null for missing, corrupt, or shapeless entries", () => {
      expect(readCachedWeather(0, storage)).toBeNull();

      storage.setItem(WEATHER_CACHE_KEY, "{not json");
      expect(readCachedWeather(0, storage)).toBeNull();

      storage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data: { t: 1 } }));
      expect(readCachedWeather(0, storage)).toBeNull();
    });

    it("survives a storage that throws, as in private browsing", () => {
      const hostile = {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      };
      expect(() => writeCachedWeather({ t: 1 }, "k", 0, hostile)).not.toThrow();
      expect(readCachedWeather(0, hostile)).toBeNull();
    });
  });
});
