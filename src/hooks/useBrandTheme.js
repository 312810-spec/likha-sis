// src/hooks/useBrandTheme.js

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { hexToRgbTriplet } from "../utils/colorTheory.js";

export const THEME_CSS_VARS = [
  { varName: "--color-primary", key: "primary" },
  { varName: "--color-primary-light", key: "primaryLight" },
  { varName: "--color-primary-dark", key: "primaryDark" },
  { varName: "--color-accent", key: "accent" },
  { varName: "--color-accent-light", key: "accentLight" },
  { varName: "--color-accent-dark", key: "accentDark" },
  { varName: "--color-leaf", key: "leaf" },
  { varName: "--color-leaf-light", key: "leafLight" },
  { varName: "--color-leaf-dark", key: "leafDark" },
];

/**
 * Applies a theme object to document.documentElement.style.
 * If theme is null or missing, removes the style properties to fallback to :root defaults.
 */
export function applyThemeToDocument(theme) {
  if (typeof document === "undefined" || !document.documentElement) return;

  if (theme && typeof theme === "object" && theme.primary) {
    THEME_CSS_VARS.forEach(({ varName, key }) => {
      if (theme[key]) {
        document.documentElement.style.setProperty(varName, hexToRgbTriplet(theme[key]));
      }
    });
  } else {
    THEME_CSS_VARS.forEach(({ varName }) => {
      document.documentElement.style.removeProperty(varName);
    });
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
