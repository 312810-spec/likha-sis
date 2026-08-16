import { describe, it, expect } from "vitest";
import { classifyHeightForAge, normalizeSex } from "../utils/nutritionComputations.js";

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
