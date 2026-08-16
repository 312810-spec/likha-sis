import { describe, it, expect } from "vitest";
import {
  getAgeInMonths,
  computeBMI,
  classifyNutritionalStatus,
  classifyHeightForAge,
  normalizeSex,
} from "../nutritionComputations.js";
import { HFA_FOR_AGE_TABLE } from "../hfaForAgeTable.js";

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

describe("normalizeSex", () => {
  it("normalizes M/Male and F/Female variants", () => {
    expect(normalizeSex("M")).toBe("M");
    expect(normalizeSex("Male")).toBe("M");
    expect(normalizeSex("male")).toBe("M");
    expect(normalizeSex("F")).toBe("F");
    expect(normalizeSex("Female")).toBe("F");
    expect(normalizeSex("female")).toBe("F");
  });

  it("returns empty string for missing or unrecognized values", () => {
    expect(normalizeSex("")).toBe("");
    expect(normalizeSex(null)).toBe("");
    expect(normalizeSex(undefined)).toBe("");
    expect(normalizeSex("Other")).toBe("");
  });
});

describe("classifyHeightForAge", () => {
  it("classifies boys at age 60 months using the exact table cutoffs", () => {
    // row: [60, 0.96, 1.006, 1.192, ...]
    expect(classifyHeightForAge(0.95, 60, "M")).toBe("Severely Stunted");
    expect(classifyHeightForAge(0.96, 60, "M")).toBe("Severely Stunted");
    expect(classifyHeightForAge(1.0, 60, "M")).toBe("Stunted");
    expect(classifyHeightForAge(1.006, 60, "M")).toBe("Stunted");
    expect(classifyHeightForAge(1.1, 60, "M")).toBe("Normal");
    expect(classifyHeightForAge(1.192, 60, "M")).toBe("Normal");
    expect(classifyHeightForAge(1.3, 60, "M")).toBe("Tall");
  });

  it("classifies girls at age 60 months using the exact table cutoffs", () => {
    // row: [60, ..., 0.951, 0.998, 1.189]
    expect(classifyHeightForAge(0.94, 60, "F")).toBe("Severely Stunted");
    expect(classifyHeightForAge(0.98, 60, "F")).toBe("Stunted");
    expect(classifyHeightForAge(1.1, 60, "F")).toBe("Normal");
    expect(classifyHeightForAge(1.2, 60, "F")).toBe("Tall");
  });

  it("accepts Male/Female sex spelling the same as M/F", () => {
    expect(classifyHeightForAge(0.95, 60, "Male")).toBe("Severely Stunted");
    expect(classifyHeightForAge(0.94, 60, "Female")).toBe("Severely Stunted");
  });

  it("returns null for missing height, age, or sex", () => {
    expect(classifyHeightForAge(null, 60, "M")).toBeNull();
    expect(classifyHeightForAge(1.0, null, "M")).toBeNull();
    expect(classifyHeightForAge(1.0, 60, "")).toBeNull();
    expect(classifyHeightForAge(1.0, 60, "Other")).toBeNull();
    expect(classifyHeightForAge(0, 60, "M")).toBeNull();
    expect(classifyHeightForAge(-1, 60, "M")).toBeNull();
  });

  it("returns null for ages outside the table's 60-228 month range, matching classifyNutritionalStatus", () => {
    expect(classifyHeightForAge(0.5, 59, "M")).toBeNull();
    expect(classifyHeightForAge(1.9, 229, "M")).toBeNull();
    expect(classifyHeightForAge(1.9, 300, "M")).toBeNull();
  });
});

describe("HFA_FOR_AGE_TABLE integrity", () => {
  const COLUMNS = [
    { index: 1, name: "boysSeverelyStuntedMax" },
    { index: 2, name: "boysStuntedMax" },
    { index: 3, name: "boysNormalMax" },
    { index: 4, name: "girlsSeverelyStuntedMax" },
    { index: 5, name: "girlsStuntedMax" },
    { index: 6, name: "girlsNormalMax" },
  ];

  // Known, intentional non-monotonic dips carried over verbatim from the DepEd
  // SF8 workbook's "Sir Wedz Helper Tables" sheet. They were verified against
  // the source workbook's raw cell data and are disclosed in the header comment
  // of src/utils/hfaForAgeTable.js — they are NOT transcription errors, and must
  // not be "corrected" without an authoritative WHO source. Any dip outside this
  // allow-list means a re-export silently corrupted the table.
  const KNOWN_DIPS = new Set([
    "boysSeverelyStuntedMax@163", // 1.369 (162) -> 1.364 (163)
    "boysNormalMax@226", //          1.912 (225) -> 1.911 (226), tail plateau
    "girlsNormalMax@227", //         1.763 (226) -> 1.762 (227), tail plateau
  ]);

  function findDips() {
    const dips = [];
    for (const { index, name } of COLUMNS) {
      for (let i = 1; i < HFA_FOR_AGE_TABLE.length; i++) {
        const prev = HFA_FOR_AGE_TABLE[i - 1];
        const curr = HFA_FOR_AGE_TABLE[i];
        if (curr[index] < prev[index]) {
          dips.push({ id: `${name}@${curr[0]}`, from: prev[index], to: curr[index] });
        }
      }
    }
    return dips;
  }

  it("covers every month from 60 to 228 with no gaps", () => {
    expect(HFA_FOR_AGE_TABLE).toHaveLength(169);
    HFA_FOR_AGE_TABLE.forEach((row, i) => {
      expect(row).toHaveLength(7);
      expect(row[0]).toBe(60 + i);
    });
  });

  it("keeps each cutoff column non-decreasing as age increases, except the documented dips", () => {
    const unexpected = findDips()
      .filter((d) => !KNOWN_DIPS.has(d.id))
      .map((d) => `${d.id} (${d.from} -> ${d.to})`);
    expect(unexpected).toEqual([]);
  });

  it("still contains every documented dip, so the allow-list cannot rot silently", () => {
    const found = findDips().map((d) => d.id).sort();
    expect(found).toEqual([...KNOWN_DIPS].sort());
  });

  it("keeps cutoffs ordered severelyStunted <= stunted <= normal within every row", () => {
    for (const row of HFA_FOR_AGE_TABLE) {
      expect(row[1]).toBeLessThanOrEqual(row[2]);
      expect(row[2]).toBeLessThanOrEqual(row[3]);
      expect(row[4]).toBeLessThanOrEqual(row[5]);
      expect(row[5]).toBeLessThanOrEqual(row[6]);
    }
  });
});
