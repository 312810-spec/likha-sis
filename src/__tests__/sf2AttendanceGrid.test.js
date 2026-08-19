// src/__tests__/sf2AttendanceGrid.test.js
import { describe, it, expect } from "vitest";
import { getWeekdays, makeAttendanceDocId } from "../utils/attendanceDates.js";
import { computeSectionAttendance } from "../utils/sf4Computations.js";

describe("SF2 Daily Attendance Reporting & Grid Aggregations", () => {
  describe("getWeekdays", () => {
    it("generates correct weekday dates excluding Saturdays and Sundays", () => {
      // August 2026: Aug 1 is Saturday, Aug 2 is Sunday, Aug 3 is Monday (starts on Aug 3)
      const weekdays = getWeekdays("2026-08");
      expect(weekdays.length).toBe(21);
      expect(weekdays[0]).toEqual({
        day: 3,
        label: "M",
        dateString: "2026-08-03",
      });

      // Verify no Saturday (6) or Sunday (0) dates exist
      weekdays.forEach((w) => {
        const d = new Date(w.dateString);
        expect(d.getDay()).not.toBe(0);
        expect(d.getDay()).not.toBe(6);
      });
    });

    it("returns empty array for invalid or empty month value", () => {
      expect(getWeekdays("")).toEqual([]);
      expect(getWeekdays(null)).toEqual([]);
      expect(getWeekdays(undefined)).toEqual([]);
    });
  });

  describe("makeAttendanceDocId", () => {
    it("formats deterministic attendance document IDs with normalized underscores", () => {
      const docId = makeAttendanceDocId("Grade 10 - Kindness", "2026-08");
      expect(docId).toBe("Grade_10_Kindness_2026-08");

      const docId2 = makeAttendanceDocId("Grade 7 - Diamond", "2026-09");
      expect(docId2).toBe("Grade_7_Diamond_2026-09");
    });

    it("returns empty string when class value is empty", () => {
      expect(makeAttendanceDocId("", "2026-08")).toBe("");
    });
  });

  describe("Monthly summary aggregations and absent/tardy tracking", () => {
    it("correctly aggregates absent counts and tardy occurrences without counting tardy as absent", () => {
      const records = {
        learner1: {
          "2026-08-03": "A",
          "2026-08-04": "A",
          "2026-08-05": "T",
        },
        learner2: {
          "2026-08-03": "T",
          "2026-08-04": "T",
          "2026-08-05": "T",
        },
        learner3: {
          "2026-08-03": "A",
          "2026-08-04": "A",
          "2026-08-05": "A",
          "2026-08-06": "A",
        },
      };

      const weekdaysCount = 20;
      const maleLearnerIds = ["learner1", "learner2"];
      const femaleLearnerIds = ["learner3"];

      const summary = computeSectionAttendance({
        records,
        learnerIds: { male: maleLearnerIds, female: femaleLearnerIds },
        weekdaysCount,
      });

      // learner1: 20 - 2 absences = 18 present days
      // learner2: 20 - 0 absences (all T) = 20 present days
      // male total present learner-days = 38 / 20 = 1.9 daily average
      expect(summary.dailyAverageMale).toBeCloseTo(1.9, 5);
      expect(summary.percentageMale).toBeCloseTo((1.9 / 2) * 100, 5); // 95%

      // learner3: 20 - 4 absences = 16 present days
      // female daily average = 16 / 20 = 0.8
      expect(summary.dailyAverageFemale).toBeCloseTo(0.8, 5);
      expect(summary.percentageFemale).toBeCloseTo((0.8 / 1) * 100, 5); // 80%

      // Combined daily average = 1.9 + 0.8 = 2.7
      expect(summary.dailyAverageTotal).toBeCloseTo(2.7, 5);
      // Combined percentage = 2.7 / 3 * 100 = 90%
      expect(summary.percentageTotal).toBeCloseTo(90, 5);
    });
  });
});
