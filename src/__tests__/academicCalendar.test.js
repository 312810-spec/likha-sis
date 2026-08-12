import academicCalendarDefault, { academicCalendar } from "../academicCalendar.js";
import { describe, it, expect } from "vitest";

describe("academicCalendar exports", () => {
  it("exports academicCalendar as a named export", () => {
    expect(academicCalendar).toBeDefined();
    expect(typeof academicCalendar).toBe("object");
    expect(Object.keys(academicCalendar)).toContain("2026-2027");
  });

  it("exports academicCalendar as the default export", () => {
    expect(academicCalendarDefault).toBe(academicCalendar);
  });

  it("produces school years sorted in descending order", () => {
    const years = Object.keys(academicCalendar).sort((a, b) => b.localeCompare(a));
    expect(years[0]).toBe("2026-2027");
  });
});
