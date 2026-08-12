import { describe, it, expect } from "vitest";
import {
  getAgeInMonths,
  computeBMI,
  classifyNutritionalStatus,
} from "../nutritionComputations.js";

describe("nutritionComputations", () => {
  describe("getAgeInMonths", () => {
    it("computes exact whole number of months for exact year anniversaries", () => {
      expect(getAgeInMonths("2015-06-15", "2020-06-15")).toBe(60);
      expect(getAgeInMonths("2010-01-01", "2020-01-01")).toBe(120);
    });

    it("floors month calculation if measurement day is before birth day of the month", () => {
      expect(getAgeInMonths("2015-06-15", "2020-06-14")).toBe(59);
      expect(getAgeInMonths("2015-06-15", "2020-06-16")).toBe(60);
    });

    it("returns null for invalid date strings", () => {
      expect(getAgeInMonths("invalid-date", "2020-06-15")).toBe(null);
      expect(getAgeInMonths("2015-06-15", "invalid")).toBe(null);
      expect(getAgeInMonths("", "2020-06-15")).toBe(null);
      expect(getAgeInMonths(null, undefined)).toBe(null);
    });

    it("returns null if measurement date is prior to birth date", () => {
      expect(getAgeInMonths("2020-06-15", "2015-06-15")).toBe(null);
    });
  });

  describe("computeBMI", () => {
    it("computes correct BMI rounded to 2 decimal places", () => {
      expect(computeBMI(40, 1.4)).toBe(20.41);
      expect(computeBMI(50, 1.5)).toBe(22.22);
      expect(computeBMI(60, 1.6)).toBe(23.44);
    });

    it("returns null if height is 0 or negative", () => {
      expect(computeBMI(40, 0)).toBe(null);
      expect(computeBMI(40, -1.4)).toBe(null);
    });

    it("returns null if weight is 0 or negative", () => {
      expect(computeBMI(0, 1.4)).toBe(null);
      expect(computeBMI(-40, 1.4)).toBe(null);
    });

    it("returns null for invalid or non-numeric inputs", () => {
      expect(computeBMI("abc", 1.4)).toBe(null);
      expect(computeBMI(40, "xyz")).toBe(null);
      expect(computeBMI(null, 1.4)).toBe(null);
      expect(computeBMI(40, undefined)).toBe(null);
    });
  });

  describe("classifyNutritionalStatus", () => {
    describe("Male (M) classification using real table rows (e.g. age 60)", () => {
      // Row 60: [60, 12.0, 12.9, 18.3, 20.2, 11.7, 12.6, 18.9, 21.2]
      it("classifies Severely Wasted", () => {
        expect(classifyNutritionalStatus(11.5, 60, "M")).toBe("Severely Wasted");
        expect(classifyNutritionalStatus(12.0, 60, "M")).toBe("Severely Wasted");
      });

      it("classifies Wasted", () => {
        expect(classifyNutritionalStatus(12.1, 60, "M")).toBe("Wasted");
        expect(classifyNutritionalStatus(12.9, 60, "M")).toBe("Wasted");
      });

      it("classifies Normal", () => {
        expect(classifyNutritionalStatus(13.0, 60, "M")).toBe("Normal");
        expect(classifyNutritionalStatus(18.3, 60, "M")).toBe("Normal");
      });

      it("classifies Overweight", () => {
        expect(classifyNutritionalStatus(18.4, 60, "M")).toBe("Overweight");
        expect(classifyNutritionalStatus(20.2, 60, "M")).toBe("Overweight");
      });

      it("classifies Obese", () => {
        expect(classifyNutritionalStatus(20.3, 60, "M")).toBe("Obese");
        expect(classifyNutritionalStatus(25.0, 60, "M")).toBe("Obese");
      });
    });

    describe("Female (F) classification using real table rows (e.g. age 60)", () => {
      // Row 60: [60, 12.0, 12.9, 18.3, 20.2, 11.7, 12.6, 18.9, 21.2]
      it("classifies Severely Wasted", () => {
        expect(classifyNutritionalStatus(11.0, 60, "F")).toBe("Severely Wasted");
        expect(classifyNutritionalStatus(11.7, 60, "F")).toBe("Severely Wasted");
      });

      it("classifies Wasted", () => {
        expect(classifyNutritionalStatus(11.8, 60, "F")).toBe("Wasted");
        expect(classifyNutritionalStatus(12.6, 60, "F")).toBe("Wasted");
      });

      it("classifies Normal", () => {
        expect(classifyNutritionalStatus(12.7, 60, "F")).toBe("Normal");
        expect(classifyNutritionalStatus(18.9, 60, "F")).toBe("Normal");
      });

      it("classifies Overweight", () => {
        expect(classifyNutritionalStatus(19.0, 60, "F")).toBe("Overweight");
        expect(classifyNutritionalStatus(21.2, 60, "F")).toBe("Overweight");
      });

      it("classifies Obese", () => {
        expect(classifyNutritionalStatus(21.3, 60, "F")).toBe("Obese");
        expect(classifyNutritionalStatus(26.0, 60, "F")).toBe("Obese");
      });
    });

    describe("Out of range and invalid input behavior", () => {
      it("returns null if ageInMonths is below 60", () => {
        expect(classifyNutritionalStatus(15.0, 59, "M")).toBe(null);
        expect(classifyNutritionalStatus(15.0, 0, "F")).toBe(null);
      });

      it("returns null if ageInMonths is above 228", () => {
        expect(classifyNutritionalStatus(15.0, 229, "M")).toBe(null);
        expect(classifyNutritionalStatus(15.0, 300, "F")).toBe(null);
      });

      it("returns null for invalid sex or invalid bmi", () => {
        expect(classifyNutritionalStatus(15.0, 60, "X")).toBe(null);
        expect(classifyNutritionalStatus(0, 60, "M")).toBe(null);
        expect(classifyNutritionalStatus(null, 60, "F")).toBe(null);
        expect(classifyNutritionalStatus(15.0, null, "M")).toBe(null);
      });
    });
  });
});
