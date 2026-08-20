import { describe, it, expect, vi } from "vitest";
import {
  extractThemeFromImage,
  extractThemeSuggestionsFromImage,
  deriveDarkThemeFromLight,
  overrideThemeRole,
  DEFAULT_THEME_HEX,
} from "../extractTheme.js";
import { getContrastRatio } from "../colorTheory.js";
import * as ColorThiefModule from "colorthief";

vi.mock("colorthief", () => {
  return {
    default: undefined,
    getPalette: vi.fn(),
  };
});

describe("extractThemeFromImage", () => {
  it("falls back to default Tingub theme when no colors are extracted", async () => {
    vi.mocked(ColorThiefModule.getPalette).mockResolvedValueOnce([]);

    const fakeImg = {};
    const theme = await extractThemeFromImage(fakeImg);

    expect(theme.primary).toBe(DEFAULT_THEME_HEX.primary);
    expect(theme.accent).toBe(DEFAULT_THEME_HEX.accent);
    expect(theme.leaf).toBe(DEFAULT_THEME_HEX.leaf);
    expect(theme.primaryLight).toBeDefined();
    expect(theme.primaryDark).toBeDefined();
  });

  it("filters out near-white and near-black artifacts", async () => {
    vi.mocked(ColorThiefModule.getPalette).mockResolvedValueOnce([
      [250, 250, 250], // near white - skipped
      [10, 10, 10],     // near black - skipped
      [180, 50, 50],    // usable primary
      [50, 180, 50],    // usable accent
    ]);

    const fakeImg = {};
    const theme = await extractThemeFromImage(fakeImg);

    expect(theme.primary).toBe("#B43232");
    expect(theme.accent).toBe("#258425");
    expect(theme.leaf).toBe(DEFAULT_THEME_HEX.leaf);
  });

  it("uses third extracted color for leaf when available", async () => {
    vi.mocked(ColorThiefModule.getPalette).mockResolvedValueOnce([
      [100, 50, 150],  // primary
      [200, 100, 50],  // accent
      [40, 120, 60],   // leaf
    ]);

    const fakeImg = {};
    const theme = await extractThemeFromImage(fakeImg);

    expect(theme.primary).toBe("#643296");
    expect(theme.accent).toBe("#A8542A");
    expect(theme.leaf).toBe("#28783C");
  });

  it("attaches a dual-mode .dark theme and .textOn ink colors", async () => {
    vi.mocked(ColorThiefModule.getPalette).mockResolvedValueOnce([
      [100, 50, 150],
      [200, 100, 50],
      [40, 120, 60],
    ]);

    const theme = await extractThemeFromImage({});

    expect(theme.dark).toBeDefined();
    expect(theme.dark.primary).not.toBe(theme.primary);
    // The dark-mode base color must read clearly on a near-black surface.
    expect(getContrastRatio(theme.dark.primary, "#090D16")).toBeGreaterThanOrEqual(3);

    expect(theme.textOn.light.primary).toBeDefined();
    expect(theme.textOn.dark.primary).toBeDefined();
  });
});

describe("deriveDarkThemeFromLight", () => {
  it("returns null for a theme with no primary color", () => {
    expect(deriveDarkThemeFromLight(null)).toBeNull();
    expect(deriveDarkThemeFromLight({})).toBeNull();
  });

  it("derives all 9 dark-mode role fields from a flat light theme", () => {
    const dark = deriveDarkThemeFromLight(DEFAULT_THEME_HEX);

    expect(dark.primary).toBeDefined();
    expect(dark.primaryLight).toBeDefined();
    expect(dark.primaryDark).toBeDefined();
    expect(dark.accent).toBeDefined();
    expect(dark.leaf).toBeDefined();
  });
});

describe("overrideThemeRole", () => {
  it("overrides only the light-mode base color and recomputes its tints", async () => {
    vi.mocked(ColorThiefModule.getPalette).mockResolvedValueOnce([
      [100, 50, 150],
      [200, 100, 50],
      [40, 120, 60],
    ]);
    const theme = await extractThemeFromImage({});

    const overridden = overrideThemeRole(theme, "primary", { light: "#112233" });

    expect(overridden.primary).toBe("#112233");
    expect(overridden.primaryLight).not.toBe(theme.primaryLight);
    // Untouched roles/mode stay as they were.
    expect(overridden.accent).toBe(theme.accent);
    expect(overridden.dark.primary).toBe(theme.dark.primary);
  });

  it("overrides only the dark-mode base color independently of the light one", async () => {
    vi.mocked(ColorThiefModule.getPalette).mockResolvedValueOnce([
      [100, 50, 150],
      [200, 100, 50],
      [40, 120, 60],
    ]);
    const theme = await extractThemeFromImage({});

    const overridden = overrideThemeRole(theme, "leaf", { dark: "#44FF88" });

    expect(overridden.dark.leaf).toBe("#44FF88");
    expect(overridden.leaf).toBe(theme.leaf);
  });
});

describe("extractThemeSuggestionsFromImage", () => {
  it("returns a single Default suggestion when no colors are extracted", async () => {
    vi.mocked(ColorThiefModule.getPalette).mockResolvedValueOnce([]);

    const suggestions = await extractThemeSuggestionsFromImage({});

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].label).toBe("Default");
    expect(suggestions[0].theme.primary).toBe(DEFAULT_THEME_HEX.primary);
  });

  it("returns a Dominant suggestion built from the top 3 extracted colors", async () => {
    vi.mocked(ColorThiefModule.getPalette).mockResolvedValueOnce([
      [100, 50, 150],
      [200, 100, 50],
      [40, 120, 60],
    ]);

    const suggestions = await extractThemeSuggestionsFromImage({});

    expect(suggestions[0].label).toBe("Dominant");
    expect(suggestions[0].theme.primary).toBe("#643296");
    expect(suggestions[0].theme.accent).toBe("#A8542A");
    expect(suggestions[0].theme.leaf).toBe("#28783C");
  });

  it("dedupes candidate sets that collapse to the same theme", async () => {
    // A single usable color: every role in every candidate set falls back
    // to that same color, so all 3 sets collapse to one identical theme
    // and should be reported once.
    vi.mocked(ColorThiefModule.getPalette).mockResolvedValueOnce([[100, 50, 150]]);

    const suggestions = await extractThemeSuggestionsFromImage({});

    expect(suggestions).toHaveLength(1);
  });
});
