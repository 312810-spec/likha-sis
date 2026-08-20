import { describe, it, expect } from "vitest";
import {
  hexToRgbTriplet,
  adjustLightness,
  ensureReadableContrast,
  getRelativeLuminance,
  getContrastRatio,
  getWcagLevel,
  getReadableTextColor,
  deriveDarkSurfaceVariant,
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

  describe("getContrastRatio", () => {
    it("returns 21 for black against white", () => {
      expect(getContrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    });

    it("returns 1 for a color against itself", () => {
      expect(getContrastRatio("#1A2FA0", "#1A2FA0")).toBeCloseTo(1, 5);
    });

    it("is symmetric regardless of argument order", () => {
      expect(getContrastRatio("#1A2FA0", "#FFFFFF")).toBeCloseTo(
        getContrastRatio("#FFFFFF", "#1A2FA0"),
        5
      );
    });
  });

  describe("getWcagLevel", () => {
    it("classifies ratios against the AA/AAA thresholds", () => {
      expect(getWcagLevel(21)).toBe("AAA");
      expect(getWcagLevel(7)).toBe("AAA");
      expect(getWcagLevel(5)).toBe("AA");
      expect(getWcagLevel(4.5)).toBe("AA");
      expect(getWcagLevel(3)).toBe("FAIL");
    });
  });

  describe("getReadableTextColor", () => {
    it("picks dark ink for a light background", () => {
      expect(getReadableTextColor("#F5F5F5")).not.toBe("#FFFFFF");
    });

    it("picks light ink for a dark background", () => {
      expect(getReadableTextColor("#090D16")).toBe("#FFFFFF");
    });
  });

  describe("deriveDarkSurfaceVariant", () => {
    it("stays within the luminance window that is legible on a near-black surface AND under white text", () => {
      const darkBrand = "#1F6F5C"; // Tingub primary green, luminance ~0.12
      const variant = deriveDarkSurfaceVariant(darkBrand);

      // Must read clearly on #090D16 (3:1 minimum)...
      expect(getContrastRatio(variant, "#090D16")).toBeGreaterThanOrEqual(3);
      // ...AND still support white text at 4.5:1, so every existing
      // bg-primary/accent/leaf + text-white pairing across the app stays
      // valid in dark mode -- not just the branding preview panel.
      expect(getContrastRatio(variant, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    });

    it("pulls an already-bright color back down into the window instead of leaving it too light for white text", () => {
      const bright = "#7DE8C8"; // pale mint, luminance well above 0.18
      const variant = deriveDarkSurfaceVariant(bright);

      expect(getContrastRatio(variant, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(variant, "#090D16")).toBeGreaterThanOrEqual(3);
    });

    it("caps saturation so a highly saturated color doesn't stay oversaturated", () => {
      const saturated = "#FF00FF"; // fully saturated magenta
      const variant = deriveDarkSurfaceVariant(saturated, { maxSaturation: 62 });
      const { r, g, b } = { r: parseInt(variant.slice(1, 3), 16), g: parseInt(variant.slice(3, 5), 16), b: parseInt(variant.slice(5, 7), 16) };
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2 / 255;
      const s = l > 0.5 ? (max - min) / (2 - max / 255 - min / 255) / 255 : (max - min) / (max / 255 + min / 255) / 255;
      expect(s * 100).toBeLessThanOrEqual(63);
    });

    it("preserves the original hue family (still reads as the same brand color)", () => {
      const original = "#1F6F5C";
      const variant = deriveDarkSurfaceVariant(original);
      // A teal/green input should not flip to a red or blue variant.
      const r = parseInt(variant.slice(1, 3), 16);
      const g = parseInt(variant.slice(3, 5), 16);
      expect(g).toBeGreaterThanOrEqual(r);
    });
  });
});
