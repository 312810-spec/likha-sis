import { describe, it, expect, vi } from "vitest";
import { extractThemeFromImage, DEFAULT_THEME_HEX } from "../extractTheme.js";
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
    expect(theme.accent).toBe("#32B432");
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
    expect(theme.accent).toBe("#C86432");
    expect(theme.leaf).toBe("#28783C");
  });
});
