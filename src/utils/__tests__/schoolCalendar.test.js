import { describe, it, expect } from "vitest";
import {
  buildCalendarMonth,
  getUpcomingEntries,
  expandDateRange,
  getTermForDate,
  getTermBoundary,
  EVENT_CATEGORIES,
  WEEKDAY_LABELS,
  birthdayEntries,
  advisoryEntries,
  depedCalendarEntries,
} from "../schoolCalendar.js";

function findDay(month, dateKey) {
  return month.weeks.flat().find((d) => d.dateKey === dateKey);
}

describe("schoolCalendar", () => {
  describe("expandDateRange", () => {
    it("expands an inclusive multi-day range", () => {
      expect(expandDateRange("2026-08-16", "2026-08-19")).toEqual([
        "2026-08-16",
        "2026-08-17",
        "2026-08-18",
        "2026-08-19",
      ]);
    });

    it("returns a single day when there is no end date", () => {
      expect(expandDateRange("2026-08-16")).toEqual(["2026-08-16"]);
      expect(expandDateRange("2026-08-16", null)).toEqual(["2026-08-16"]);
    });

    it("crosses a month boundary", () => {
      expect(expandDateRange("2026-08-30", "2026-09-02")).toEqual([
        "2026-08-30",
        "2026-08-31",
        "2026-09-01",
        "2026-09-02",
      ]);
    });

    it("collapses an inverted range to the start day and handles a blank start", () => {
      expect(expandDateRange("2026-08-19", "2026-08-16")).toEqual(["2026-08-19"]);
      expect(expandDateRange("")).toEqual([]);
    });
  });

  describe("term lookup", () => {
    it("finds the term containing a date", () => {
      expect(getTermForDate("2026-08-16").label).toBe("Term 1");
      expect(getTermForDate("2026-10-01").label).toBe("Term 2");
      expect(getTermForDate("2027-02-01").label).toBe("Term 3");
    });

    it("returns null for a date in the term-break gap", () => {
      // Term 2 ends 2026-12-18; Term 3 starts 2027-01-04.
      expect(getTermForDate("2026-12-25")).toBeNull();
    });

    it("identifies the first and last day of a term", () => {
      expect(getTermBoundary("2026-06-08")).toMatchObject({ edge: "start" });
      expect(getTermBoundary("2026-09-15")).toMatchObject({ edge: "end" });
      expect(getTermBoundary("2026-08-16")).toBeNull();
    });
  });

  describe("buildCalendarMonth", () => {
    const month = buildCalendarMonth(2026, 7, { today: new Date(2026, 7, 16) }); // August 2026

    it("always returns a 6x7 grid so the layout never reflows", () => {
      expect(month.weeks).toHaveLength(6);
      month.weeks.forEach((week) => expect(week).toHaveLength(7));
      expect(WEEKDAY_LABELS).toHaveLength(7);
    });

    it("starts the grid on a Sunday", () => {
      expect(month.weeks[0][0].date.getDay()).toBe(0);
    });

    it("marks in-month vs adjacent-month days", () => {
      expect(findDay(month, "2026-08-01").inMonth).toBe(true);
      expect(findDay(month, "2026-08-31").inMonth).toBe(true);
      expect(findDay(month, "2026-07-31").inMonth).toBe(false);
    });

    it("flags today and weekends", () => {
      expect(findDay(month, "2026-08-16").isToday).toBe(true);
      expect(findDay(month, "2026-08-15").isToday).toBe(false);
      expect(findDay(month, "2026-08-16").isWeekend).toBe(true); // Sunday
      expect(findDay(month, "2026-08-17").isWeekend).toBe(false); // Monday
    });

    it("lands Philippine holidays on the right day", () => {
      const ninoy = findDay(month, "2026-08-21");
      expect(ninoy.entries.some((e) => e.kind === "holiday" && e.title.includes("Ninoy"))).toBe(true);

      const heroes = findDay(month, "2026-08-31");
      expect(heroes.entries.some((e) => e.title === "National Heroes Day")).toBe(true);
    });

    it("attaches the term to each day", () => {
      expect(findDay(month, "2026-08-16").term.label).toBe("Term 1");
    });

    it("spreads a multi-day school event across every day it covers", () => {
      const withEvent = buildCalendarMonth(2026, 7, {
        today: new Date(2026, 7, 16),
        schoolEvents: [
          {
            id: "e1",
            title: "First Term Examinations",
            startDate: "2026-08-24",
            endDate: "2026-08-26",
            category: "examination",
          },
        ],
      });
      ["2026-08-24", "2026-08-25", "2026-08-26"].forEach((key) => {
        expect(findDay(withEvent, key).entries.some((e) => e.kind === "event")).toBe(true);
      });
      expect(findDay(withEvent, "2026-08-27").entries.some((e) => e.kind === "event")).toBe(false);
    });

    it("sorts suspensions above holidays above events on the same day", () => {
      const stacked = buildCalendarMonth(2026, 7, {
        today: new Date(2026, 7, 16),
        schoolEvents: [{ id: "e1", title: "Recognition", startDate: "2026-08-21", category: "activity" }],
        announcements: [
          { id: "s1", type: "classSuspension", title: "No classes", effectiveDate: "2026-08-21" },
        ],
      });
      const day = findDay(stacked, "2026-08-21");
      expect(day.entries.map((e) => e.kind)).toEqual(["suspension", "holiday", "event"]);
    });

    it("marks an approximate holiday as subject to proclamation", () => {
      const may = buildCalendarMonth(2026, 4, { today: new Date(2026, 4, 1) });
      const eid = findDay(may, "2026-05-27");
      expect(eid.entries[0].title).toContain("subject to proclamation");
    });

    it("handles a month that begins on a Sunday without a blank leading week", () => {
      // 1 November 2026 is a Sunday.
      const nov = buildCalendarMonth(2026, 10, { today: new Date(2026, 10, 1) });
      expect(nov.weeks[0][0].dateKey).toBe("2026-11-01");
      expect(nov.weeks[0][0].inMonth).toBe(true);
    });

    it("ignores events with no start date", () => {
      const bad = buildCalendarMonth(2026, 7, {
        today: new Date(2026, 7, 16),
        schoolEvents: [{ id: "x", title: "Broken" }],
      });
      expect(bad.weeks.flat().every((d) => d.entries.every((e) => e.title !== "Broken"))).toBe(true);
    });
  });

  describe("getUpcomingEntries", () => {
    it("returns entries in date order within the window", () => {
      const result = getUpcomingEntries({}, "2026-08-16", 30);
      expect(result.length).toBeGreaterThan(0);
      const dates = result.map((e) => e.dateKey);
      expect(dates).toEqual([...dates].sort());
      expect(result[0].dateKey).toBe("2026-08-21"); // Ninoy Aquino Day
    });

    it("excludes anything past the window", () => {
      const result = getUpcomingEntries({}, "2026-08-16", 3);
      expect(result).toHaveLength(0);
    });

    it("collapses a multi-day event to a single entry", () => {
      const result = getUpcomingEntries(
        {
          schoolEvents: [
            {
              id: "e1",
              title: "First Term Examinations",
              startDate: "2026-08-24",
              endDate: "2026-08-28",
              category: "examination",
            },
          ],
        },
        "2026-08-16",
        30
      );
      const exams = result.filter((e) => e.title === "First Term Examinations");
      expect(exams).toHaveLength(1);
      expect(exams[0].dateKey).toBe("2026-08-24");
    });

    it("honours the limit", () => {
      const result = getUpcomingEntries({ limit: 2 }, "2026-08-16", 120);
      expect(result).toHaveLength(2);
    });
  });

  describe("EVENT_CATEGORIES", () => {
    it("gives every category an id, label, and tint", () => {
      EVENT_CATEGORIES.forEach((c) => {
        expect(c.id).toBeTruthy();
        expect(c.label).toBeTruthy();
        expect(c.tint).toBeTruthy();
      });
    });

    it("includes a DepEd/gov announcement category", () => {
      expect(EVENT_CATEGORIES.find((c) => c.id === "depedAnnouncement")).toEqual({
        id: "depedAnnouncement",
        label: "DepEd/Gov Announcement",
        tint: "blue",
      });
    });
  });

  describe("birthdayEntries", () => {
    it("projects a birthdate onto the viewed year", () => {
      const users = [{ id: "u1", fullName: "Ana Reyes", birthdate: "1990-03-14" }];
      const entries = birthdayEntries(users, 2026);
      expect(entries).toEqual([
        {
          kind: "birthday",
          dateKey: "2026-03-14",
          title: "Ana Reyes's Birthday",
          subtitle: "Personnel Birthday",
          tone: "violet",
          id: "u1",
        },
      ]);
    });

    it("handles a Feb 29 birthdate in a non-leap viewed year by falling back to Feb 28", () => {
      const users = [{ id: "u2", fullName: "Leap Cruz", birthdate: "1992-02-29" }];
      const entries = birthdayEntries(users, 2026);
      expect(entries[0].dateKey).toBe("2026-02-28");
    });

    it("skips users with no birthdate", () => {
      const users = [{ id: "u3", fullName: "No Date" }];
      expect(birthdayEntries(users, 2026)).toEqual([]);
    });
  });

  describe("advisoryEntries", () => {
    it("expands a bulletin's validity window into one entry per day", () => {
      const advisories = [{
        id: "adv1",
        cycloneName: "Typhoon Test",
        signalNumber: 2,
        issuedAt: "2026-08-20",
        validUntil: "2026-08-21",
        headline: "Signal No. 2 raised over Region V",
      }];
      const entries = advisoryEntries(advisories);
      expect(entries).toEqual([
        { kind: "advisory", dateKey: "2026-08-20", title: "Typhoon Test — Signal No. 2", subtitle: "Signal No. 2 raised over Region V", tone: "red", id: "adv1" },
        { kind: "advisory", dateKey: "2026-08-21", title: "Typhoon Test — Signal No. 2", subtitle: "Signal No. 2 raised over Region V", tone: "red", id: "adv1" },
      ]);
    });

    it("returns nothing when there are no active advisories", () => {
      expect(advisoryEntries([])).toEqual([]);
    });
  });

  describe("depedCalendarEntries", () => {
    it("expands a DepEd calendar event's date range", () => {
      const events = [{
        id: "dc1",
        title: "Term 1 Final Examinations",
        startDate: "2026-09-15",
        endDate: "2026-09-19",
      }];
      const entries = depedCalendarEntries(events);
      expect(entries).toHaveLength(5);
      expect(entries[0]).toEqual({
        kind: "depedCalendar",
        dateKey: "2026-09-15",
        title: "Term 1 Final Examinations",
        subtitle: "DepEd Official Calendar",
        tone: "blue",
        id: "dc1",
      });
    });
  });
});
