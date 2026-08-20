// src/hooks/useBrandTheme.js

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { hexToRgbTriplet, getReadableTextColor } from "../utils/colorTheory.js";
import { deriveDarkThemeFromLight } from "../utils/extractTheme.js";

// Each role gets a light-mode var (--lm-*) and a dark-mode var (--dm-*),
// set as an RGB triplet. index.css maps the Tailwind-consumed --color-*
// tokens to whichever pair is active via plain :root / .dark selectors
// (the same pattern already used for --color-paper/--color-ink), so a
// theme switch is a stylesheet lookup, not a JS re-render, and never has
// to fight the specificity of these inline styles.
const ROLE_VAR_SUFFIX = {
  primary: "primary",
  primaryLight: "primary-light",
  primaryDark: "primary-dark",
  accent: "accent",
  accentLight: "accent-light",
  accentDark: "accent-dark",
  leaf: "leaf",
  leafLight: "leaf-light",
  leafDark: "leaf-dark",
};

const TEXT_ON_ROLES = ["primary", "accent", "leaf"];

export const THEME_CSS_VARS = [
  ...Object.entries(ROLE_VAR_SUFFIX).flatMap(([key, suffix]) => [
    { varName: `--lm-${suffix}`, key, mode: "light" },
    { varName: `--dm-${suffix}`, key, mode: "dark" },
  ]),
  ...TEXT_ON_ROLES.flatMap((role) => [
    { varName: `--lm-text-on-${role}`, key: role, mode: "light", textOn: true },
    { varName: `--dm-text-on-${role}`, key: role, mode: "dark", textOn: true },
  ]),
];

function computeTextOnRoles(lightTheme, darkTheme) {
  return {
    light: {
      primary: getReadableTextColor(lightTheme.primary),
      accent: getReadableTextColor(lightTheme.accent),
      leaf: getReadableTextColor(lightTheme.leaf),
    },
    dark: {
      primary: getReadableTextColor(darkTheme.primary),
      accent: getReadableTextColor(darkTheme.accent),
      leaf: getReadableTextColor(darkTheme.leaf),
    },
  };
}

// Cache key for the resolved CSS variables (not the raw theme object), so
// index.html's pre-paint inline script can apply them with a plain
// setProperty loop -- no color math duplicated outside this module.
export const THEME_CACHE_KEY = "likha-theme-vars";

function cacheThemeVars(vars) {
  try {
    if (vars) localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(vars));
    else localStorage.removeItem(THEME_CACHE_KEY);
  } catch {
    // localStorage unavailable (private browsing, quota) -- theme still
    // applies for this session, it just won't survive a refresh instantly.
  }
}

/**
 * Applies a theme object to document.documentElement.style as paired
 * light-mode/dark-mode CSS variables. If theme is null or missing, removes
 * the style properties so the app falls back to the :root/.dark defaults.
 *
 * Accepts both the current dual-mode theme shape (with a `.dark` and
 * `.textOn` sub-object, as produced by extractTheme.js) and a theme saved
 * before dual-mode support existed (flat `{primary, accent, leaf, ...}`
 * only) -- the dark variant and text-on colors are derived on the fly for
 * the latter so older saved themes keep working without a data migration.
 *
 * Also mirrors the resolved vars into localStorage so the next page load
 * can apply them synchronously (via the inline script in index.html)
 * before Firestore's onSnapshot resolves, avoiding a flash of the default
 * theme on refresh.
 */
export function applyThemeToDocument(theme) {
  if (typeof document === "undefined" || !document.documentElement) return;
  const root = document.documentElement.style;

  if (theme && typeof theme === "object" && theme.primary) {
    const darkTheme = theme.dark || deriveDarkThemeFromLight(theme);
    const textOn = theme.textOn || computeTextOnRoles(theme, darkTheme);
    const resolvedVars = {};

    Object.entries(ROLE_VAR_SUFFIX).forEach(([key, suffix]) => {
      if (theme[key]) {
        const value = hexToRgbTriplet(theme[key]);
        root.setProperty(`--lm-${suffix}`, value);
        resolvedVars[`--lm-${suffix}`] = value;
      }
      if (darkTheme?.[key]) {
        const value = hexToRgbTriplet(darkTheme[key]);
        root.setProperty(`--dm-${suffix}`, value);
        resolvedVars[`--dm-${suffix}`] = value;
      }
    });

    TEXT_ON_ROLES.forEach((role) => {
      if (textOn?.light?.[role]) {
        const value = hexToRgbTriplet(textOn.light[role]);
        root.setProperty(`--lm-text-on-${role}`, value);
        resolvedVars[`--lm-text-on-${role}`] = value;
      }
      if (textOn?.dark?.[role]) {
        const value = hexToRgbTriplet(textOn.dark[role]);
        root.setProperty(`--dm-text-on-${role}`, value);
        resolvedVars[`--dm-text-on-${role}`] = value;
      }
    });

    cacheThemeVars(resolvedVars);
  } else {
    THEME_CSS_VARS.forEach(({ varName }) => {
      root.removeProperty(varName);
    });
    cacheThemeVars(null);
  }
}

/**
 * Hook to subscribe to settings/schoolConfig in Firestore and apply custom theme live.
 */
export function useBrandTheme() {
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "settings", "schoolConfig");
    const unsubscribe = onSnapshot(
      ref,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() || {};
          const storedTheme = data.theme || null;
          setTheme(storedTheme);
          applyThemeToDocument(storedTheme);
        } else {
          setTheme(null);
          applyThemeToDocument(null);
        }
        setLoading(false);
      },
      () => {
        setTheme(null);
        applyThemeToDocument(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { theme, loading };
}

export default useBrandTheme;
