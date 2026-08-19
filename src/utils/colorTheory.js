// src/utils/colorTheory.js

/**
 * Normalizes a hex string to standard 6-character hex without #.
 * Handles '#RRGGBB', 'RRGGBB', '#RGB', 'RGB'.
 */
function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return '000000';
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '000000';
  }
  return clean.toUpperCase();
}

/**
 * Converts a hex color string to an RGB triplet object { r, g, b }.
 */
export function hexToRgb(hex) {
  const clean = normalizeHex(hex);
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts RGB numbers (0-255) to a '#RRGGBB' hex string.
 */
export function rgbToHex(r, g, b) {
  const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (c) => clamp(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Converts RGB (0-255) to HSL ({ h: 0-360, s: 0-100, l: 0-100 }).
 */
export function rgbToHsl(r, g, b) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

/**
 * Converts HSL (h: 0-360, s: 0-100, l: 0-100) to RGB { r, g, b } (0-255).
 */
export function hslToRgb(h, s, l) {
  const hNorm = (h % 360 + 360) % 360 / 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p, q, t) => {
    let tAdj = t;
    if (tAdj < 0) tAdj += 1;
    if (tAdj > 1) tAdj -= 1;
    if (tAdj < 1 / 6) return p + (q - p) * 6 * tAdj;
    if (tAdj < 1 / 2) return q;
    if (tAdj < 2 / 3) return p + (q - p) * (2 / 3 - tAdj) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  const r = hue2rgb(p, q, hNorm + 1 / 3);
  const g = hue2rgb(p, q, hNorm);
  const b = hue2rgb(p, q, hNorm - 1 / 3);

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Exports a function hexToRgbTriplet(hex) returning a "R G B" string (e.g. "26 47 160")
 * from a hex color string. Handles both "#RRGGBB" and "RRGGBB".
 */
export function hexToRgbTriplet(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

/**
 * Exports a function adjustLightness(hex, percent) that converts hex to HSL,
 * shifts the lightness by percent (positive lightens, negative darkens,
 * clamped to 0-100), and returns the result as a '#RRGGBB' hex string.
 */
export function adjustLightness(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const newL = Math.max(0, Math.min(100, l + percent));
  const newRgb = hslToRgb(h, s, newL);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Calculates WCAG relative luminance for a given hex color.
 */
export function getRelativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rLin, gLin, bLin] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Exports a function ensureReadableContrast(hex) that checks the color's
 * relative luminance; if it's too light to give sufficient contrast against
 * white text (WCAG AA 4.5:1 requires background luminance at or below ~0.18),
 * darken it via adjustLightness until it passes, returning the adjusted hex.
 */
export function ensureReadableContrast(hex, maxLuminance = 0.18) {
  let currentHex = hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
  let iterations = 0;
  const MAX_ITERATIONS = 30;

  while (getRelativeLuminance(currentHex) > maxLuminance && iterations < MAX_ITERATIONS) {
    currentHex = adjustLightness(currentHex, -4);
    iterations++;
  }

  return currentHex;
}
