import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchForecast, SEVERE_RAIN_MM, SEVERE_WIND_KPH } from "../weather.js";

const mockResponse = {
  daily: {
    time: ["2026-08-20", "2026-08-21"],
    temperature_2m_max: [31.2, 29.8],
    temperature_2m_min: [24.1, 23.9],
    precipitation_sum: [2.0, 45.0],
    wind_speed_10m_max: [15.0, 60.0],
    weather_code: [3, 65],
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchForecast", () => {
  it("maps Open-Meteo's daily arrays into one entry per day", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }));

    const forecast = await fetchForecast(10.5, 123.1);

    expect(forecast).toHaveLength(2);
    expect(forecast[0]).toMatchObject({
      dateKey: "2026-08-20",
      tempMaxC: 31.2,
      tempMinC: 24.1,
      precipitationMm: 2.0,
      windKph: 15.0,
      severe: false,
    });
  });

  it("flags a day as severe when rain or wind crosses the threshold", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }));

    const forecast = await fetchForecast(10.5, 123.1);

    expect(forecast[1].severe).toBe(true);
    expect(mockResponse.daily.precipitation_sum[1]).toBeGreaterThan(SEVERE_RAIN_MM);
    expect(mockResponse.daily.wind_speed_10m_max[1]).toBeGreaterThan(SEVERE_WIND_KPH);
  });

  it("throws when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchForecast(10.5, 123.1)).rejects.toThrow();
  });
});
