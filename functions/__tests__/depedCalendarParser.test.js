import { describe, it, expect } from "vitest";
import { parseDepedCalendarHtml } from "../depedCalendarParser.js";

const sampleHtml = `
<table>
  <tr><td>June 8, 2026</td><td>Opening of Classes</td></tr>
  <tr><td>September 15-19, 2026</td><td>Term 1 Final Examinations</td></tr>
  <tr><td>not a date at all</td><td>Malformed row, should be skipped</td></tr>
</table>
`;

describe("parseDepedCalendarHtml", () => {
  it("extracts single-day events", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events).toContainEqual({
      title: "Opening of Classes",
      startDate: "2026-06-08",
      endDate: "2026-06-08",
      category: "deped",
    });
  });

  it("extracts date-range events", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events).toContainEqual({
      title: "Term 1 Final Examinations",
      startDate: "2026-09-15",
      endDate: "2026-09-19",
      category: "deped",
    });
  });

  it("skips rows that don't contain a parseable date", () => {
    const events = parseDepedCalendarHtml(sampleHtml);
    expect(events.find((e) => e.title.includes("Malformed"))).toBeUndefined();
  });

  it("returns an empty array for empty or unparseable input", () => {
    expect(parseDepedCalendarHtml("")).toEqual([]);
    expect(parseDepedCalendarHtml("<p>no table here</p>")).toEqual([]);
  });
});
