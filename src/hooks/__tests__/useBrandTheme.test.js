// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useBrandTheme, applyThemeToDocument, THEME_CSS_VARS } from "../useBrandTheme.js";
import { onSnapshot } from "firebase/firestore";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("../../firebase", () => ({
  db: {},
}));

describe("useBrandTheme and applyThemeToDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    THEME_CSS_VARS.forEach(({ varName }) => {
      document.documentElement.style.removeProperty(varName);
    });
  });

  describe("applyThemeToDocument helper", () => {
    it("leaves documentElement styles unset when theme is null or missing", () => {
      applyThemeToDocument(null);
      THEME_CSS_VARS.forEach(({ varName }) => {
        expect(document.documentElement.style.getPropertyValue(varName)).toBe("");
      });
    });

    it("applies light-mode (--lm-*) RGB triplets from the flat theme fields", () => {
      const mockTheme = {
        primary: "#112233",
        primaryLight: "#223344",
        primaryDark: "#001122",
        accent: "#AA5500",
        accentLight: "#CC7722",
        accentDark: "#883300",
        leaf: "#228833",
        leafLight: "#44AA55",
        leafDark: "#115522",
      };

      applyThemeToDocument(mockTheme);

      expect(document.documentElement.style.getPropertyValue("--lm-primary")).toBe("17 34 51");
      expect(document.documentElement.style.getPropertyValue("--lm-primary-light")).toBe("34 51 68");
      expect(document.documentElement.style.getPropertyValue("--lm-primary-dark")).toBe("0 17 34");
      expect(document.documentElement.style.getPropertyValue("--lm-accent")).toBe("170 85 0");
      expect(document.documentElement.style.getPropertyValue("--lm-leaf")).toBe("34 136 51");
    });

    it("derives and applies --dm-* variants for a theme saved before dual-mode support existed", () => {
      // Flat theme with no .dark sub-object, exactly as stored before this
      // feature. #FF00FF sits well outside the dark-safe luminance window,
      // so the derived --dm-primary must actually differ from --lm-primary.
      const legacyTheme = {
        primary: "#FF00FF",
        primaryLight: "#FF66FF",
        primaryDark: "#990099",
        accent: "#966122",
        accentLight: "#D18934",
        accentDark: "#583914",
        leaf: "#2A7B45",
        leafLight: "#3DB465",
        leafDark: "#174225",
      };

      applyThemeToDocument(legacyTheme);

      const dmPrimary = document.documentElement.style.getPropertyValue("--dm-primary");
      expect(dmPrimary).not.toBe("");
      expect(dmPrimary).not.toBe(document.documentElement.style.getPropertyValue("--lm-primary"));
    });

    it("applies text-on-* ink colors for both modes", () => {
      const mockTheme = {
        primary: "#1F6F5C",
        primaryLight: "#30AB8E",
        primaryDark: "#0E332A",
        accent: "#966122",
        accentLight: "#D18934",
        accentDark: "#583914",
        leaf: "#2A7B45",
        leafLight: "#3DB465",
        leafDark: "#174225",
      };

      applyThemeToDocument(mockTheme);

      expect(document.documentElement.style.getPropertyValue("--lm-text-on-primary")).not.toBe("");
      expect(document.documentElement.style.getPropertyValue("--dm-text-on-primary")).not.toBe("");
    });
  });

  describe("useBrandTheme hook", () => {
    it("handles fallback behavior when no stored theme exists", () => {
      let snapshotCallback;
      vi.mocked(onSnapshot).mockImplementation((ref, onNext) => {
        snapshotCallback = onNext;
        return vi.fn();
      });

      const { result } = renderHook(() => useBrandTheme());

      act(() => {
        snapshotCallback({
          exists: () => true,
          data: () => ({ schoolName: "Tingub NHS" }), // No theme field
        });
      });

      expect(result.current.theme).toBeNull();
      expect(result.current.loading).toBe(false);
      THEME_CSS_VARS.forEach(({ varName }) => {
        expect(document.documentElement.style.getPropertyValue(varName)).toBe("");
      });
    });

    it("updates documentElement properties when a stored theme is present", () => {
      let snapshotCallback;
      vi.mocked(onSnapshot).mockImplementation((ref, onNext) => {
        snapshotCallback = onNext;
        return vi.fn();
      });

      const { result } = renderHook(() => useBrandTheme());

      const sampleTheme = {
        primary: "#1A2FA0",
        primaryLight: "#2E45C7",
        primaryDark: "#101D6B",
        accent: "#F2A93B",
        accentLight: "#F5C168",
        accentDark: "#D48C1F",
        leaf: "#1E5C29",
        leafLight: "#2E7D3A",
        leafDark: "#123D1A",
      };

      act(() => {
        snapshotCallback({
          exists: () => true,
          data: () => ({ theme: sampleTheme }),
        });
      });

      expect(result.current.theme).toEqual(sampleTheme);
      expect(result.current.loading).toBe(false);
      expect(document.documentElement.style.getPropertyValue("--lm-primary")).toBe("26 47 160");
      expect(document.documentElement.style.getPropertyValue("--lm-accent")).toBe("242 169 59");
      expect(document.documentElement.style.getPropertyValue("--lm-leaf")).toBe("30 92 41");
    });
  });
});
