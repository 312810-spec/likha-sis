// src/utils/extractTheme.js

import * as ColorThiefModule from 'colorthief';
import {
  rgbToHex,
  hexToRgb,
  rgbToHsl,
  adjustLightness,
  ensureReadableContrast,
  deriveDarkSurfaceVariant,
  getReadableTextColor,
} from './colorTheory.js';

export const DEFAULT_THEME_HEX = {
  primary: '#1F6F5C',
  primaryLight: '#30AB8E',
  primaryDark: '#0E332A',
  accent: '#966122',
  accentLight: '#D18934',
  accentDark: '#583914',
  leaf: '#2A7B45',
  leafLight: '#3DB465',
  leafDark: '#174225',
};

function extractRgb(item) {
  if (!item) return null;
  if (Array.isArray(item)) {
    return { r: item[0], g: item[1], b: item[2] };
  }
  if (typeof item.rgb === 'function') {
    return item.rgb();
  }
  if (typeof item.array === 'function') {
    const arr = item.array();
    return { r: arr[0], g: arr[1], b: arr[2] };
  }
  if (typeof item.r === 'number') {
    return { r: item.r, g: item.g, b: item.b };
  }
  return null;
}

async function getRawPalette(imageElement, colorCount = 6) {
  try {
    if (typeof ColorThiefModule.getPalette === 'function') {
      const res = await ColorThiefModule.getPalette(imageElement, { colorCount });
      if (Array.isArray(res)) return res;
    }
    const DefaultExport = ColorThiefModule.default;
    if (typeof DefaultExport === 'function') {
      const thief = new DefaultExport();
      if (typeof thief?.getPalette === 'function') {
        const res = thief.getPalette(imageElement, colorCount);
        if (Array.isArray(res)) return res;
      }
    }
  } catch (err) {
    console.warn('ColorThief palette extraction failed, falling back to defaults:', err);
  }
  return [];
}

/**
 * Derives the dark-surface-optimized companion of a light-mode theme (the
 * flat {primary, accent, leaf, ...} shape). Used both when building a fresh
 * theme from a logo and when reading a theme saved before dual-mode support
 * existed (see useBrandTheme.js), so both paths produce an identical shape.
 */
export function deriveDarkThemeFromLight(lightTheme) {
  if (!lightTheme || !lightTheme.primary) return null;

  const darkPrimary = deriveDarkSurfaceVariant(lightTheme.primary);
  const darkAccent = deriveDarkSurfaceVariant(lightTheme.accent || DEFAULT_THEME_HEX.accent);
  const darkLeaf = deriveDarkSurfaceVariant(lightTheme.leaf || DEFAULT_THEME_HEX.leaf);

  return {
    primary: darkPrimary,
    primaryLight: adjustLightness(darkPrimary, 10),
    primaryDark: adjustLightness(darkPrimary, -10),
    accent: darkAccent,
    accentLight: adjustLightness(darkAccent, 10),
    accentDark: adjustLightness(darkAccent, -10),
    leaf: darkLeaf,
    leafLight: adjustLightness(darkLeaf, 10),
    leafDark: adjustLightness(darkLeaf, -10),
  };
}

/**
 * Foreground ink (light or dark) that reads clearly on top of each role
 * color, computed separately for the light-mode and dark-mode variant of
 * that role since the two can require different ink.
 */
export function buildTextOnRoles(lightRoles, darkRoles) {
  const textFor = (roles) => ({
    primary: getReadableTextColor(roles.primary),
    accent: getReadableTextColor(roles.accent),
    leaf: getReadableTextColor(roles.leaf),
  });

  return {
    light: textFor(lightRoles),
    dark: textFor(darkRoles),
  };
}

function buildRoleTheme(primaryHex, accentHex, leafHex) {
  const primary = ensureReadableContrast(primaryHex);
  const accent = ensureReadableContrast(accentHex);
  const leaf = ensureReadableContrast(leafHex);

  const lightTheme = {
    primary,
    primaryLight: adjustLightness(primary, 15),
    primaryDark: adjustLightness(primary, -15),
    accent,
    accentLight: adjustLightness(accent, 15),
    accentDark: adjustLightness(accent, -15),
    leaf,
    leafLight: adjustLightness(leaf, 15),
    leafDark: adjustLightness(leaf, -15),
  };

  const darkTheme = deriveDarkThemeFromLight(lightTheme);

  return {
    ...lightTheme,
    dark: darkTheme,
    textOn: buildTextOnRoles(lightTheme, darkTheme),
  };
}

/**
 * Applies a manual hex override to one role (primary/accent/leaf) of a
 * theme, for either its light-mode base color, its dark-mode base color, or
 * both. Recomputes that role's light/dark tint variants and the textOn ink
 * for both modes so the override stays internally consistent, without
 * touching ensureReadableContrast/deriveDarkSurfaceVariant -- a manual
 * override is a deliberate choice, not a candidate to re-derive.
 */
export function overrideThemeRole(theme, role, { light, dark } = {}) {
  if (!theme || !role) return theme;

  const nextLight = { ...theme };
  const nextDark = { ...(theme.dark || deriveDarkThemeFromLight(theme)) };

  if (light) {
    nextLight[role] = light;
    nextLight[`${role}Light`] = adjustLightness(light, 15);
    nextLight[`${role}Dark`] = adjustLightness(light, -15);
  }

  if (dark) {
    nextDark[role] = dark;
    nextDark[`${role}Light`] = adjustLightness(dark, 10);
    nextDark[`${role}Dark`] = adjustLightness(dark, -10);
  }

  return {
    ...nextLight,
    dark: nextDark,
    textOn: buildTextOnRoles(nextLight, nextDark),
  };
}

function extractUsableColors(rawPalette) {
  const isNearWhite = (r, g, b) => r > 235 && g > 235 && b > 235;
  const isNearBlack = (r, g, b) => r < 20 && g < 20 && b < 20;

  return rawPalette
    .map(extractRgb)
    .filter(Boolean)
    .filter(({ r, g, b }) => !isNearWhite(r, g, b) && !isNearBlack(r, g, b))
    .map(({ r, g, b }) => rgbToHex(r, g, b));
}

/**
 * Extracts a brand theme from an HTMLImageElement.
 * Filters near-white and near-black artifacts, selects primary/accent/leaf candidates,
 * ensures readable contrast, and generates light/dark variants.
 */
export async function extractThemeFromImage(imageElement) {
  const rawPalette = await getRawPalette(imageElement, 6);
  const usableColors = extractUsableColors(rawPalette);

  return buildRoleTheme(
    usableColors[0] || DEFAULT_THEME_HEX.primary,
    usableColors[1] || DEFAULT_THEME_HEX.accent,
    usableColors[2] || DEFAULT_THEME_HEX.leaf
  );
}

/**
 * Extracts up to 3 distinct candidate brand themes from an HTMLImageElement,
 * so the ICT Coordinator can pick the one that best represents the school's
 * logo instead of being locked into a single auto-picked combination:
 *  - "Dominant"  - the most prominent logo colors, in extraction order.
 *  - "Vibrant"   - the most saturated logo colors (often the logo's accent
 *                  ink rather than its background fill).
 *  - "Alternate" - the dominant colors in a different role order, for logos
 *                  where the "obvious" primary reads better as an accent.
 * Falls back to a single Tingub NHS default set when no usable color could
 * be extracted (e.g. a flat-color or fully transparent logo).
 */
export async function extractThemeSuggestionsFromImage(imageElement) {
  const rawPalette = await getRawPalette(imageElement, 8);
  const usableColors = extractUsableColors(rawPalette);

  if (usableColors.length === 0) {
    return [
      {
        label: 'Default',
        theme: buildRoleTheme(DEFAULT_THEME_HEX.primary, DEFAULT_THEME_HEX.accent, DEFAULT_THEME_HEX.leaf),
      },
    ];
  }

  // Dedupe identical raw swatches (flat-color logos often repeat the same
  // fill across several ColorThief buckets).
  const distinctColors = usableColors.filter((hex, idx) => usableColors.indexOf(hex) === idx);

  const bySaturation = [...distinctColors].sort((a, b) => {
    const satOf = (hex) => {
      const { r, g, b: blue } = hexToRgb(hex);
      return rgbToHsl(r, g, blue).s;
    };
    return satOf(b) - satOf(a);
  });

  const at = (arr, idx) => arr[idx] ?? arr[0];

  const candidateSets = [
    {
      label: 'Dominant',
      colors: [at(distinctColors, 0), at(distinctColors, 1), at(distinctColors, 2)],
    },
    {
      label: 'Vibrant',
      colors: [at(bySaturation, 0), at(bySaturation, 1), at(bySaturation, 2)],
    },
    {
      label: 'Alternate',
      colors: [at(distinctColors, 1), at(distinctColors, 2), at(distinctColors, 0)],
    },
  ];

  const suggestions = [];
  const seenKeys = new Set();
  for (const { label, colors } of candidateSets) {
    const theme = buildRoleTheme(
      colors[0] || DEFAULT_THEME_HEX.primary,
      colors[1] || DEFAULT_THEME_HEX.accent,
      colors[2] || DEFAULT_THEME_HEX.leaf
    );
    const key = `${theme.primary}-${theme.accent}-${theme.leaf}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    suggestions.push({ label, theme });
  }

  return suggestions;
}
