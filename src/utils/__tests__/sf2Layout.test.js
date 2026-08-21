// src/utils/__tests__/sf2Layout.test.js
import { describe, it, expect } from "vitest";
import {
  computeSf2ColumnPercents,
  SF2_TOTAL_GRID_UNITS,
  DROPOUT_REASONS,
  dropoutLabel,
  NLS_REASON_GROUPS,
} from "../sf2Layout.js";

describe("computeSf2ColumnPercents", () => {
  it("sums to 100% for a typical month", () => {
    const p = computeSf2ColumnPercents(21);
    const total = p.no + p.name + p.datePerColumn * 21 + p.absent + p.present + p.remarks;
    expect(total).toBeCloseTo(100, 6);
  });

  it("keeps the non-date columns' share fixed regardless of weekday count", () => {
    const short = computeSf2ColumnPercents(15);
    const long = computeSf2ColumnPercents(23);
    expect(short.no).toBeCloseTo(long.no, 10);
    expect(short.name).toBeCloseTo(long.name, 10);
    expect(short.absent).toBeCloseTo(long.absent, 10);
    expect(short.present).toBeCloseTo(long.present, 10);
    expect(short.remarks).toBeCloseTo(long.remarks, 10);
  });

  it("gives every date column an equal share, wider for a shorter month", () => {
    const short = computeSf2ColumnPercents(15);
    const long = computeSf2ColumnPercents(23);
    expect(short.datePerColumn).toBeGreaterThan(long.datePerColumn);
  });

  it("returns 0-width date columns without crashing for an empty month", () => {
    const p = computeSf2ColumnPercents(0);
    expect(p.datePerColumn).toBe(0);
  });

  it("matches the real workbook's 47-column grid", () => {
    expect(SF2_TOTAL_GRID_UNITS).toBe(47);
  });
});

describe("dropoutLabel", () => {
  it("formats a known reason code exactly as historically stored", () => {
    expect(dropoutLabel("b1")).toBe("Dropped Out - b1: Illness");
  });

  it("every DROPOUT_REASONS code is accounted for in NLS_REASON_GROUPS", () => {
    // Sub-lettered codes (a1, b3, ...) live in a group's `items`; the lone
    // top-level "f" (Others) has no sub-items and matches a group's own letter.
    const subItemCodes = NLS_REASON_GROUPS.flatMap((g) => g.items);
    const groupLetters = NLS_REASON_GROUPS.map((g) => g.letter);
    DROPOUT_REASONS.forEach((r) => {
      const accountedFor = subItemCodes.includes(r.code) || groupLetters.includes(r.code);
      expect(accountedFor).toBe(true);
    });
  });
});
