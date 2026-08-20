import { describe, it, expect } from "vitest";
import { toCoordinate, hasValidCoordinates } from "../coordinates.js";

describe("coordinates", () => {
  describe("toCoordinate", () => {
    it("parses numeric strings from the settings form", () => {
      expect(toCoordinate("10.3554")).toBe(10.3554);
      expect(toCoordinate("-8.5")).toBe(-8.5);
      expect(toCoordinate(123.935)).toBe(123.935);
      expect(toCoordinate("0")).toBe(0);
    });

    it("collapses blank and unparseable input to null, never NaN", () => {
      // NaN would serialize into settings/schoolConfig and leave the weather
      // card permanently broken rather than simply hidden.
      expect(toCoordinate("")).toBeNull();
      expect(toCoordinate(null)).toBeNull();
      expect(toCoordinate(undefined)).toBeNull();
      expect(toCoordinate("not a number")).toBeNull();
      expect(toCoordinate(Infinity)).toBeNull();
    });
  });

  describe("hasValidCoordinates", () => {
    it("accepts real Philippine coordinates", () => {
      expect(hasValidCoordinates("10.3554", "123.935")).toBe(true);
      expect(hasValidCoordinates(14.5995, 120.9842)).toBe(true);
    });

    it("rejects missing or out-of-range values", () => {
      expect(hasValidCoordinates("", "123.935")).toBe(false);
      expect(hasValidCoordinates("10.3554", "")).toBe(false);
      expect(hasValidCoordinates(91, 120)).toBe(false);
      expect(hasValidCoordinates(10, 181)).toBe(false);
    });

    it("treats 0,0 as valid rather than as a missing value", () => {
      // Null Island is a real coordinate; "unset" is null, not zero.
      expect(hasValidCoordinates(0, 0)).toBe(true);
    });
  });
});
