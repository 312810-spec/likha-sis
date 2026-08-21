// src/utils/__tests__/sf1FitScale.test.js
import { describe, it, expect } from "vitest";
import { computeFitScale, SF1_SHEET_NATURAL_WIDTH_PX } from "../sf1FitScale.js";

describe("computeFitScale", () => {
  it("shrinks to fit a narrower container", () => {
    const scale = computeFitScale(648, SF1_SHEET_NATURAL_WIDTH_PX); // half the sheet width
    expect(scale).toBeCloseTo(0.5, 5);
  });

  it("never zooms in past 100%, even on a very wide container", () => {
    const scale = computeFitScale(4000, SF1_SHEET_NATURAL_WIDTH_PX);
    expect(scale).toBe(1);
  });

  it("falls back to 1 (true size) when a measurement is missing or invalid", () => {
    expect(computeFitScale(0, SF1_SHEET_NATURAL_WIDTH_PX)).toBe(1);
    expect(computeFitScale(800, 0)).toBe(1);
    expect(computeFitScale(undefined, SF1_SHEET_NATURAL_WIDTH_PX)).toBe(1);
    expect(computeFitScale(-100, SF1_SHEET_NATURAL_WIDTH_PX)).toBe(1);
  });
});
