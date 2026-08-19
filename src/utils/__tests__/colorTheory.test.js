import { describe, it, expect } from "vitest";
import {
  hexToRgbTriplet,
  adjustLightness,
  ensureReadableContrast,
  getRelativeLuminance,
} from "../colorTheory.js";

describe("colorTheory utilities", () => {
  describe("hexToRgbTriplet", () => {
    it("converts standard 6-digit hex with hash to RGB triplet string", () => {
      expect(hexToRgbTriplet("#1A2FA0")).toBe("26 47 160");
      expect(hexToRgbTriplet("#F2A93B")).toBe("242 169 59");
      expect(hexToRgbTriplet("#1E5C29")).toBe("30 92 41");
    });

    it("converts 6-digit hex without hash to RGB triplet string", () => {
      expect(hexToRgbTriplet("1A2FA0")).toBe("26 47 160");
      expect(hexToRgbTriplet("F2A93B")).toBe("242 169 59");
      expect(hexToRgbTriplet("1E5C29")).toBe("30 92 41");
    });

    it("handles 3-digit shorthand hex with and without hash", () => {
      expect(hexToRgbTriplet("#FFF")).toBe("255 255 255");
      expect(hexToRgbTriplet("000")).toBe("0 0 0");
    });

    it("handles invalid or empty input gracefully", () => {
      expect(hexToRgbTriplet("")).toBe("0 0 0");
      expect(hexToRgbTriplet(null)).toBe("0 0 0");
    });
  });

  describe("adjustLightness", () => {
    it("lightens a color when percent is positive", () => {
      const original = "#1A2FA0";
      const lightened = adjustLightness(original, 15);
      expect(getRelativeLuminance(lightened)).toBeGreaterThan(getRelativeLuminance(original));
    });

    it("darkens a color when percent is negative", () => {
      const original = "#1A2FA0";
      const darkened = adjustLightness(original, -15);
      expect(getRelativeLuminance(darkened)).toBeLessThan(getRelativeLuminance(original));
    });

    it("clamps lightness to 0 and 100", () => {
      expect(adjustLightness("#000000", -50)).toBe("#000000");
      expect(adjustLightness("#FFFFFF", 50)).toBe("#FFFFFF");
    });
  });

  describe("ensureReadableContrast", () => {
    it("leaves sufficiently dark colors unchanged", () => {
      // #1A2FA0 has luminance ~0.046 (< 0.18)
      expect(ensureReadableContrast("#1A2FA0")).toBe("#1A2FA0");
      expect(ensureReadableContrast("#1E5C29")).toBe("#1E5C29");
    });

    it("darkens too-light colors until relative luminance is <= 0.18 (WCAG AA vs. white text)", () => {
      const tooLight = "#FFFF00"; // Pure bright yellow, luminance ~0.93
      const adjusted = ensureReadableContrast(tooLight);

      expect(getRelativeLuminance(adjusted)).toBeLessThanOrEqual(0.18);
      expect(getRelativeLuminance(adjusted)).toBeLessThan(getRelativeLuminance(tooLight));
    });

    it("darkens pure white to a readable contrast level", () => {
      const white = "#FFFFFF";
      const adjusted = ensureReadableContrast(white);

      expect(getRelativeLuminance(adjusted)).toBeLessThanOrEqual(0.18);
    });
  });
});
