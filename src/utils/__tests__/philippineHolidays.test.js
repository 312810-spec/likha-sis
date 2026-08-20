import { describe, it, expect } from "vitest";
import {
  PHILIPPINE_HOLIDAYS,
  getHolidaysInRange,
  getUpcomingHolidays,
  getHolidayOn,
  isNonWorkingDay,
  toDateKey,
  daysUntil,
} from "../philippineHolidays.js";

describe("philippineHolidays", () => {
  describe("data integrity", () => {
    it("covers both calendar years of SY 2026-2027", () => {
      const years = new Set(PHILIPPINE_HOLIDAYS.map((h) => h.date.slice(0, 4)));
      expect(years.has("2026")).toBe(true);
      expect(years.has("2027")).toBe(true);
    });

    it("uses only known holiday types and valid ISO dates", () => {
      const validTypes = ["regular", "specialNonWorking", "observance"];
      PHILIPPINE_HOLIDAYS.forEach((h) => {
        expect(validTypes).toContain(h.type);
        expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(h.name.trim().length).toBeGreaterThan(0);
      });
    });

    it("has no duplicate dates", () => {
      const dates = PHILIPPINE_HOLIDAYS.map((h) => h.date);
      expect(new Set(dates).size).toBe(dates.length);
    });

    it("marks only the lunar-calendar holidays as approximate", () => {
      const approximate = PHILIPPINE_HOLIDAYS.filter((h) => h.approximate);
      expect(approximate.length).toBeGreaterThan(0);
      approximate.forEach((h) => {
        expect(h.name).toMatch(/Eid'l/);
      });
    });
  });

  describe("toDateKey", () => {
    it("formats a Date in local time, not UTC", () => {
      // 07:00 Manila on 12 June is still 11 June in UTC. toISOString() would
      // report the wrong day for any Philippine morning.
      const morning = new Date(2026, 5, 12, 7, 0, 0);
      expect(toDateKey(morning)).toBe("2026-06-12");
    });

    it("passes through an ISO string and trims a timestamp", () => {
      expect(toDateKey("2026-12-25")).toBe("2026-12-25");
      expect(toDateKey("2026-12-25T13:45:00Z")).toBe("2026-12-25");
    });

    it("returns an empty string for an invalid date", () => {
      expect(toDateKey(new Date("nonsense"))).toBe("");
    });
  });

  describe("getHolidaysInRange", () => {
    it("returns holidays inside the range, inclusive of both ends", () => {
      const result = getHolidaysInRange("2026-12-24", "2026-12-31");
      const names = result.map((h) => h.name);
      expect(names).toContain("Christmas Eve");
      expect(names).toContain("Christmas Day");
      expect(names).toContain("Rizal Day");
      expect(names).toContain("Last Day of the Year");
      expect(names).not.toContain("Bonifacio Day");
    });

    it("returns results ascending by date", () => {
      const result = getHolidaysInRange("2026-01-01", "2026-12-31");
      const dates = result.map((h) => h.date);
      expect(dates).toEqual([...dates].sort());
    });

    it("returns an empty array for an inverted or invalid range", () => {
      expect(getHolidaysInRange("2026-12-31", "2026-01-01")).toEqual([]);
      expect(getHolidaysInRange("", "2026-01-01")).toEqual([]);
    });
  });

  describe("getUpcomingHolidays", () => {
    it("returns the next holidays on or after the given date", () => {
      const result = getUpcomingHolidays("2026-06-01", 2);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Independence Day");
      expect(result[0].date).toBe("2026-06-12");
    });

    it("includes a holiday falling exactly on the from-date", () => {
      const result = getUpcomingHolidays("2026-06-12", 1);
      expect(result[0].date).toBe("2026-06-12");
    });

    it("crosses the year boundary", () => {
      const result = getUpcomingHolidays("2026-12-30", 4);
      const dates = result.map((h) => h.date);
      expect(dates).toContain("2026-12-31");
      expect(dates).toContain("2027-01-01");
    });

    it("preserves the approximate flag so the UI can mark it provisional", () => {
      const result = getUpcomingHolidays("2026-05-01", 3);
      const eid = result.find((h) => h.name.includes("Eid'l Adha"));
      expect(eid?.approximate).toBe(true);
    });

    it("handles a zero or negative limit without throwing", () => {
      expect(getUpcomingHolidays("2026-01-01", 0)).toEqual([]);
      expect(getUpcomingHolidays("2026-01-01", -3)).toEqual([]);
    });
  });

  describe("getHolidayOn / isNonWorkingDay", () => {
    it("finds a holiday on its exact date", () => {
      expect(getHolidayOn("2026-08-31")?.name).toBe("National Heroes Day");
      expect(getHolidayOn("2026-08-30")).toBeNull();
    });

    it("treats regular and special non-working days as days off", () => {
      expect(isNonWorkingDay("2026-06-12")).toBe(true); // regular
      expect(isNonWorkingDay("2026-11-01")).toBe(true); // specialNonWorking
    });

    it("does not treat an observance as a day off", () => {
      // EDSA anniversary is commemorated but classes still run.
      expect(getHolidayOn("2026-02-25")?.type).toBe("observance");
      expect(isNonWorkingDay("2026-02-25")).toBe(false);
    });

    it("returns false for an ordinary school day", () => {
      expect(isNonWorkingDay("2026-09-15")).toBe(false);
    });
  });

  describe("daysUntil", () => {
    it("counts whole days forward", () => {
      expect(daysUntil("2026-06-12", "2026-06-01")).toBe(11);
      expect(daysUntil("2026-06-12", "2026-06-12")).toBe(0);
    });

    it("returns a negative number for a past date", () => {
      expect(daysUntil("2026-06-01", "2026-06-12")).toBe(-11);
    });

    it("returns null for an unparseable date", () => {
      expect(daysUntil("not-a-date", "2026-06-01")).toBeNull();
    });
  });
});
