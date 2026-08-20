import { describe, it, expect } from "vitest";
import {
  deriveWeatherAlerts,
  normalizeEarthquakeResponse,
  announcementsToAlerts,
  mergeAlerts,
  buildEarthquakeUrl,
  THRESHOLDS,
} from "../hazardAlerts.js";

function weatherWith(today) {
  return {
    observedAt: "2026-08-16T09:00",
    forecast: [{ date: "2026-08-16", ...today }],
  };
}

describe("hazardAlerts", () => {
  describe("deriveWeatherAlerts — rainfall", () => {
    it("stays silent below the warning threshold", () => {
      const alerts = deriveWeatherAlerts(weatherWith({ precipitationSum: THRESHOLDS.rainWarningMm - 0.1 }));
      expect(alerts).toHaveLength(0);
    });

    it("warns exactly at the warning threshold", () => {
      const alerts = deriveWeatherAlerts(weatherWith({ precipitationSum: THRESHOLDS.rainWarningMm }));
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("warning");
      expect(alerts[0].official).toBe(false);
    });

    it("escalates to danger exactly at the danger threshold", () => {
      const alerts = deriveWeatherAlerts(weatherWith({ precipitationSum: THRESHOLDS.rainDangerMm }));
      expect(alerts[0].severity).toBe("danger");
    });
  });

  describe("deriveWeatherAlerts — wind", () => {
    it("warns at gale force and escalates at storm force", () => {
      expect(
        deriveWeatherAlerts(weatherWith({ windSpeedMax: THRESHOLDS.windWarningKph }))[0].severity
      ).toBe("warning");
      expect(
        deriveWeatherAlerts(weatherWith({ windSpeedMax: THRESHOLDS.windDangerKph }))[0].severity
      ).toBe("danger");
      expect(
        deriveWeatherAlerts(weatherWith({ windSpeedMax: THRESHOLDS.windWarningKph - 1 }))
      ).toHaveLength(0);
    });
  });

  describe("deriveWeatherAlerts — heat index", () => {
    it("raises a danger alert at the DepEd suspension-consideration level", () => {
      const alerts = deriveWeatherAlerts(
        weatherWith({ apparentTempMax: THRESHOLDS.heatIndexDangerC })
      );
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("danger");
      expect(alerts[0].detail).toContain("42");
    });

    it("stays silent just below it", () => {
      expect(
        deriveWeatherAlerts(weatherWith({ apparentTempMax: THRESHOLDS.heatIndexDangerC - 0.1 }))
      ).toHaveLength(0);
    });
  });

  describe("deriveWeatherAlerts — general", () => {
    it("only examines today, not the rest of the forecast", () => {
      const alerts = deriveWeatherAlerts({
        observedAt: "2026-08-16T09:00",
        forecast: [
          { date: "2026-08-16", precipitationSum: 1 },
          { date: "2026-08-17", precipitationSum: 500 },
        ],
      });
      expect(alerts).toHaveLength(0);
    });

    it("can raise several alerts for one day", () => {
      const alerts = deriveWeatherAlerts(
        weatherWith({ precipitationSum: 150, windSpeedMax: 95, apparentTempMax: 43 })
      );
      expect(alerts).toHaveLength(3);
    });

    it("returns an empty array for missing or empty weather data", () => {
      expect(deriveWeatherAlerts(null)).toEqual([]);
      expect(deriveWeatherAlerts({})).toEqual([]);
      expect(deriveWeatherAlerts({ forecast: [] })).toEqual([]);
    });

    it("ignores non-numeric readings rather than raising a bogus alert", () => {
      expect(deriveWeatherAlerts(weatherWith({ precipitationSum: null, windSpeedMax: null }))).toEqual([]);
    });
  });

  describe("buildEarthquakeUrl", () => {
    it("filters by radius, magnitude, and lookback window", () => {
      const url = buildEarthquakeUrl(10.33, 123.93, new Date("2026-08-16T00:00:00Z"));
      expect(url).toContain("maxradiuskm=300");
      expect(url).toContain("minmagnitude=4.5");
      expect(url).toContain("starttime=2026-08-09");
      expect(url).toContain("format=geojson");
    });
  });

  describe("normalizeEarthquakeResponse", () => {
    it("converts features into alerts and escalates large magnitudes", () => {
      const alerts = normalizeEarthquakeResponse({
        features: [
          { id: "a1", properties: { mag: 5.1, place: "12 km SE of Cebu", time: 1755300000000 } },
          { id: "a2", properties: { mag: 6.4, place: "40 km N of Bohol", time: 1755200000000 } },
        ],
      });
      expect(alerts).toHaveLength(2);
      expect(alerts[0].severity).toBe("warning");
      expect(alerts[0].title).toBe("Magnitude 5.1 earthquake nearby");
      expect(alerts[1].severity).toBe("danger");
      expect(alerts.every((a) => a.official === false)).toBe(true);
    });

    it("skips features with no magnitude and tolerates a bad payload", () => {
      expect(normalizeEarthquakeResponse({ features: [{ id: "x", properties: {} }] })).toEqual([]);
      expect(normalizeEarthquakeResponse(null)).toEqual([]);
      expect(normalizeEarthquakeResponse({})).toEqual([]);
    });
  });

  describe("announcementsToAlerts", () => {
    const posts = [
      { id: "1", type: "classSuspension", title: "No classes", body: "Typhoon", effectiveDate: "2026-08-16", priority: "normal" },
      { id: "2", type: "ndrrmcAdvisory", title: "Signal No. 2", body: "Prepare", effectiveDate: "2026-08-15", priority: "normal" },
      { id: "3", type: "depedOrder", title: "DO 15", body: "Grading", effectiveDate: "2026-08-10" },
      { id: "4", type: "general", title: "Meeting", body: "Faculty", effectiveDate: "2026-08-16" },
    ];

    it("promotes only suspensions and advisories, never routine issuances", () => {
      const alerts = announcementsToAlerts(posts, new Date("2026-08-16T08:00:00"));
      expect(alerts).toHaveLength(2);
      expect(alerts.map((a) => a.id)).toEqual(["announcement-1", "announcement-2"]);
    });

    it("marks them official so they outrank automated readings", () => {
      const alerts = announcementsToAlerts(posts, new Date("2026-08-16T08:00:00"));
      expect(alerts.every((a) => a.official === true)).toBe(true);
    });

    it("treats a class suspension as danger and a plain advisory as warning", () => {
      const alerts = announcementsToAlerts(posts, new Date("2026-08-16T08:00:00"));
      expect(alerts[0].severity).toBe("danger");
      expect(alerts[1].severity).toBe("warning");
    });

    it("escalates an urgent advisory to danger", () => {
      const [alert] = announcementsToAlerts(
        [{ id: "9", type: "ndrrmcAdvisory", title: "Signal 4", body: "!", priority: "urgent", effectiveDate: "2026-08-16" }],
        new Date("2026-08-16T08:00:00")
      );
      expect(alert.severity).toBe("danger");
    });

    it("drops expired advisories", () => {
      const expired = [
        { id: "5", type: "ndrrmcAdvisory", title: "Old", body: "x", effectiveDate: "2026-08-01", expiresAt: "2026-08-10" },
      ];
      expect(announcementsToAlerts(expired, new Date("2026-08-16T08:00:00"))).toHaveLength(0);
      expect(announcementsToAlerts(expired, new Date("2026-08-10T08:00:00"))).toHaveLength(1);
    });

    it("handles an empty or missing list", () => {
      expect(announcementsToAlerts()).toEqual([]);
      expect(announcementsToAlerts([])).toEqual([]);
    });
  });

  describe("mergeAlerts", () => {
    const official = { id: "o1", severity: "warning", official: true, issuedAt: "2026-08-10" };
    const autoDanger = { id: "a1", severity: "danger", official: false, issuedAt: "2026-08-16" };
    const autoWarn = { id: "a2", severity: "warning", official: false, issuedAt: "2026-08-15" };

    it("ranks official notices above automated readings regardless of severity", () => {
      const merged = mergeAlerts([autoDanger, autoWarn], [official]);
      expect(merged[0].id).toBe("o1");
    });

    it("ranks automated alerts by severity, then recency", () => {
      const merged = mergeAlerts([autoWarn, autoDanger]);
      expect(merged.map((a) => a.id)).toEqual(["a1", "a2"]);
    });

    it("collapses duplicate ids", () => {
      const merged = mergeAlerts([autoDanger], [autoDanger]);
      expect(merged).toHaveLength(1);
    });

    it("tolerates empty, missing, and null-containing groups", () => {
      expect(mergeAlerts()).toEqual([]);
      expect(mergeAlerts([], undefined, null)).toEqual([]);
      expect(mergeAlerts([null, autoWarn])).toHaveLength(1);
    });
  });
});
