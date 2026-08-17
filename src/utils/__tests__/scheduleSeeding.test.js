import { describe, it, expect } from "vitest";
import { spreadPattern, seedSectionCells } from "../scheduleSeeding";

const ROWS = [
  { id: "F0", kind: "fixed" },
  { id: "P1", kind: "teaching" },
  { id: "P2", kind: "teaching" },
  { id: "P3", kind: "teaching" },
];

describe("spreadPattern", () => {
  it("spreads five sessions across every weekday", () => {
    expect(spreadPattern(5)).toEqual(["mon", "tue", "wed", "thu", "fri"]);
  });

  it("spreads four sessions leaving Wednesday free", () => {
    expect(spreadPattern(4)).toEqual(["mon", "tue", "thu", "fri"]);
  });

  it("spreads three sessions as Monday, Wednesday, Friday", () => {
    expect(spreadPattern(3)).toEqual(["mon", "wed", "fri"]);
  });

  it("spreads two sessions as Tuesday and Thursday", () => {
    expect(spreadPattern(2)).toEqual(["tue", "thu"]);
  });

  it("places a single session on Monday", () => {
    expect(spreadPattern(1)).toEqual(["mon"]);
  });

  it("returns nothing for zero or negative counts", () => {
    expect(spreadPattern(0)).toEqual([]);
    expect(spreadPattern(-1)).toEqual([]);
  });

  it("caps at five, since the week has five teaching days", () => {
    expect(spreadPattern(9)).toEqual(["mon", "tue", "wed", "thu", "fri"]);
  });
});

describe("seedSectionCells", () => {
  it("gives each subject its own period row, spread by sessions per week", () => {
    const section = {
      subjects: [
        { subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 },
        { subject: "MAPEH 7", teacherId: "eredera", sessionsPerWeek: 3 },
      ],
    };

    const cells = seedSectionCells({ section, rows: ROWS });

    expect(Object.keys(cells.P1)).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(cells.P1.mon).toEqual({ subject: "Math 7", teacherId: "camposo" });
    expect(Object.keys(cells.P2)).toEqual(["mon", "wed", "fri"]);
    expect(cells.P2.wed).toEqual({ subject: "MAPEH 7", teacherId: "eredera" });
  });

  it("never seeds into a fixed row", () => {
    const section = {
      subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 }],
    };

    expect(seedSectionCells({ section, rows: ROWS }).F0).toBeUndefined();
  });

  it("stops when it runs out of teaching rows", () => {
    const section = {
      subjects: [
        { subject: "A", teacherId: "t", sessionsPerWeek: 1 },
        { subject: "B", teacherId: "t", sessionsPerWeek: 1 },
        { subject: "C", teacherId: "t", sessionsPerWeek: 1 },
        { subject: "D", teacherId: "t", sessionsPerWeek: 1 },
      ],
    };

    const cells = seedSectionCells({ section, rows: ROWS });
    expect(Object.keys(cells)).toEqual(["P1", "P2", "P3"]);
  });

  it("returns an empty object for a section with no subjects", () => {
    expect(seedSectionCells({ section: {}, rows: ROWS })).toEqual({});
  });
});
