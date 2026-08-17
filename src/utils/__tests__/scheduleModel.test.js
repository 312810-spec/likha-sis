import { describe, it, expect } from "vitest";
import {
  DAYS,
  parseTime,
  formatTime,
  formatRange,
  generatePeriodRows,
  mergeRowSets,
} from "../scheduleModel";

// The morning shift exactly as it appears in
// public/Tingub-NHS-Class-Program-SY-26-27.docx
const AM_SHIFT = {
  id: "AM",
  label: "Morning",
  startTime: "6:00",
  periodDuration: 40,
  periodsPerDay: 8,
  fixedBlocks: [
    {
      afterPeriod: 0,
      label: "Flag Ceremony",
      labelByDay: {
        tue: "Environmental Sanitation",
        wed: "Environmental Sanitation",
        thu: "Environmental Sanitation",
        fri: "Environmental Sanitation",
      },
      duration: 10,
    },
    { afterPeriod: 4, label: "Health Break", duration: 10 },
    {
      afterPeriod: 8,
      label: "Aral Program",
      labelByDay: { fri: "HGP" },
      duration: 40,
    },
    { afterPeriod: 8, label: "Environmental Sanitation", duration: 10 },
  ],
};

describe("DAYS", () => {
  it("is the five weekdays in order", () => {
    expect(DAYS).toEqual(["mon", "tue", "wed", "thu", "fri"]);
  });
});

describe("parseTime", () => {
  it("resolves morning times directly", () => {
    expect(parseTime("6:00")).toBe(360);
    expect(parseTime("11:40")).toBe(700);
  });

  it("keeps 12:xx as noon rather than midnight", () => {
    expect(parseTime("12:20")).toBe(740);
  });

  it("resolves 1:00-5:59 as afternoon, since the school day never starts then", () => {
    expect(parseTime("1:20")).toBe(800);
    expect(parseTime("3:00")).toBe(900);
  });
});

describe("formatTime", () => {
  it("renders 12-hour time with no meridiem", () => {
    expect(formatTime(360)).toBe("6:00");
    expect(formatTime(740)).toBe("12:20");
    expect(formatTime(800)).toBe("1:20");
  });

  it("pads minutes to two digits", () => {
    expect(formatTime(370)).toBe("6:10");
  });
});

describe("formatRange", () => {
  it("joins with an en dash", () => {
    expect(formatRange(370, 410)).toBe("6:10 – 6:50");
  });
});

describe("generatePeriodRows", () => {
  it("reproduces the morning grid from the reference document", () => {
    const rows = generatePeriodRows(AM_SHIFT);
    const rendered = rows.map((r) => `${formatRange(r.startMin, r.endMin)} ${r.kind}`);

    expect(rendered).toEqual([
      "6:00 – 6:10 fixed",
      "6:10 – 6:50 teaching",
      "6:50 – 7:30 teaching",
      "7:30 – 8:10 teaching",
      "8:10 – 8:50 teaching",
      "8:50 – 9:00 fixed",
      "9:00 – 9:40 teaching",
      "9:40 – 10:20 teaching",
      "10:20 – 11:00 teaching",
      "11:00 – 11:40 teaching",
      "11:40 – 12:20 fixed",
      "12:20 – 12:30 fixed",
    ]);
  });

  it("numbers teaching periods from 1 and gives every row a stable id", () => {
    const rows = generatePeriodRows(AM_SHIFT);
    const teaching = rows.filter((r) => r.kind === "teaching");

    expect(teaching.map((r) => r.periodNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(teaching.map((r) => r.id)).toEqual([
      "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8",
    ]);
    expect(rows.filter((r) => r.kind === "fixed").map((r) => r.id)).toEqual([
      "F0", "F1", "F2", "F3",
    ]);
  });

  it("emits multiple fixed blocks sharing an afterPeriod in array order", () => {
    const rows = generatePeriodRows(AM_SHIFT);
    const tail = rows.slice(-2);

    expect(tail[0].label).toBe("Aral Program");
    expect(tail[1].label).toBe("Environmental Sanitation");
  });

  it("carries per-weekday label overrides through untouched", () => {
    const rows = generatePeriodRows(AM_SHIFT);
    const aral = rows.find((r) => r.label === "Aral Program");

    expect(aral.labelByDay).toEqual({ fri: "HGP" });
  });

  it("re-flows the whole grid when the subject duration changes", () => {
    const rows = generatePeriodRows({ ...AM_SHIFT, periodDuration: 45 });
    const first = rows.find((r) => r.kind === "teaching");

    expect(formatRange(first.startMin, first.endMin)).toBe("6:10 – 6:55");
  });

  it("re-flows the whole grid when the start time changes", () => {
    const rows = generatePeriodRows({ ...AM_SHIFT, startTime: "6:30" });

    expect(formatTime(rows[0].startMin)).toBe("6:30");
  });
});

describe("mergeRowSets", () => {
  it("returns a single set unchanged", () => {
    const rows = [{ id: "P1", startMin: 360, endMin: 400 }];
    expect(mergeRowSets([rows]).map((s) => [s.startMin, s.endMin])).toEqual([[360, 400]]);
  });

  it("splits overlapping rows at every boundary, which is what produces the irregular teacher rows", () => {
    const am = [{ id: "P1", startMin: 660, endMin: 700 }]; // 11:00 – 11:40
    const pm = [{ id: "P1", startMin: 690, endMin: 750 }]; // 11:30 – 12:30

    const merged = mergeRowSets([am, pm]).map((s) => [s.startMin, s.endMin]);

    expect(merged).toEqual([[660, 690], [690, 700], [700, 750]]);
  });

  it("does not duplicate identical boundaries", () => {
    const a = [{ id: "P1", startMin: 360, endMin: 400 }];
    const b = [{ id: "P1", startMin: 360, endMin: 400 }];

    expect(mergeRowSets([a, b])).toHaveLength(1);
  });

  it("ignores empty sets", () => {
    const rows = [{ id: "P1", startMin: 360, endMin: 400 }];
    expect(mergeRowSets([rows, []])).toHaveLength(1);
  });
});
