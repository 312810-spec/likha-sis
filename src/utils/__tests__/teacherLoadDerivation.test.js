import { describe, it, expect } from "vitest";
import { DUTY_ROTATION, deriveTeacherLoad } from "../teacherLoadDerivation";

const AM_SHIFT = {
  id: "AM",
  label: "Morning",
  startTime: "6:00",
  periodDuration: 40,
  periodsPerDay: 4,
  fixedBlocks: [{ afterPeriod: 0, label: "Flag Ceremony", duration: 10 }],
};

const PM_SHIFT = {
  id: "PM",
  label: "Afternoon",
  startTime: "12:30",
  periodDuration: 40,
  periodsPerDay: 2,
  fixedBlocks: [],
};

const SHIFTS = { AM: AM_SHIFT, PM: PM_SHIFT };

const CAMPOSO = {
  id: "delacruz",
  displayName: "Mrs. Dela Cruz",
  handles: ["Math 7"],
  designations: ["Grade 7 Adviser"],
  dutySlots: {},
};

// Dela Cruz teaches Math 7 to LOVE at P1 and to HOPE at P3, every day.
function amSections() {
  const daily = (subject, teacherId) => ({
    mon: { subject, teacherId },
    tue: { subject, teacherId },
    wed: { subject, teacherId },
    thu: { subject, teacherId },
    fri: { subject, teacherId },
  });

  return [
    {
      id: "love",
      gradeLevel: "7",
      name: "LOVE",
      shiftId: "AM",
      subjects: [{ subject: "Math 7", teacherId: "delacruz", sessionsPerWeek: 5 }],
      cells: { P1: daily("Math 7", "delacruz") },
    },
    {
      id: "hope",
      gradeLevel: "7",
      name: "HOPE",
      shiftId: "AM",
      subjects: [{ subject: "Math 7", teacherId: "delacruz", sessionsPerWeek: 5 }],
      cells: { P3: daily("Math 7", "delacruz") },
    },
  ];
}

describe("DUTY_ROTATION", () => {
  it("is the three-way cycle from the reference document, in order", () => {
    expect(DUTY_ROTATION).toEqual([
      "IMs Preparation",
      "Checking & Monitoring of Outputs",
      "Lesson Planning",
    ]);
  });
});

describe("deriveTeacherLoad", () => {
  it("places each taught section as SUBJECT / SECTION", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    const p1 = load.rows.find((r) => r.timeLabel === "6:10 – 6:50");
    expect(p1.byDay.mon.kind).toBe("teaching");
    expect(p1.byDay.mon.text).toBe("Math 7\nLOVE");
  });

  it("carries fixed blocks straight through", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    const flag = load.rows[0];
    expect(flag.byDay.mon.kind).toBe("fixed");
    expect(flag.byDay.mon.text).toBe("Flag Ceremony");
  });

  it("fills gap rows with the rotation from the reference document", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    // P2 is the first gap row, P4 the second.
    const gap1 = load.rows.find((r) => r.timeLabel === "6:50 – 7:30");
    const gap2 = load.rows.find((r) => r.timeLabel === "8:10 – 8:50");

    expect([
      gap1.byDay.mon.text,
      gap1.byDay.tue.text,
      gap1.byDay.wed.text,
      gap1.byDay.thu.text,
      gap1.byDay.fri.text,
    ]).toEqual([
      "IMs Preparation",
      "Checking & Monitoring of Outputs",
      "Lesson Planning",
      "IMs Preparation",
      "Checking & Monitoring of Outputs",
    ]);

    // Second gap row starts one step further into the cycle.
    expect([
      gap2.byDay.mon.text,
      gap2.byDay.tue.text,
      gap2.byDay.wed.text,
    ]).toEqual([
      "Checking & Monitoring of Outputs",
      "Lesson Planning",
      "IMs Preparation",
    ]);
  });

  it("is deterministic - the same input renders the same sheet", () => {
    const args = { teacher: CAMPOSO, sections: amSections(), shiftsById: SHIFTS };
    expect(deriveTeacherLoad(args)).toEqual(deriveTeacherLoad(args));
  });

  it("lets a dutySlots override win over the rotation", () => {
    const teacher = {
      ...CAMPOSO,
      dutySlots: { "6:50 – 7:30": { mon: "Advisory Functions" } },
    };

    const load = deriveTeacherLoad({
      teacher,
      sections: amSections(),
      shiftsById: SHIFTS,
    });
    const gap = load.rows.find((r) => r.timeLabel === "6:50 – 7:30");

    expect(gap.byDay.mon.kind).toBe("duty");
    expect(gap.byDay.mon.text).toBe("Advisory Functions");
    expect(gap.byDay.tue.text).toBe("Checking & Monitoring of Outputs");
  });

  it("counts distinct subject and grade pairs as preparations", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    // Math 7 to two sections is still one preparation.
    expect(load.totals.preparations).toBe(1);
  });

  it("counts a second grade level as a second preparation", () => {
    const sections = amSections();
    sections.push({
      id: "obedience",
      gradeLevel: "10",
      name: "OBEDIENCE",
      shiftId: "AM",
      subjects: [{ subject: "Math 10", teacherId: "delacruz", sessionsPerWeek: 5 }],
      cells: { P2: { mon: { subject: "Math 10", teacherId: "delacruz" } } },
    });

    const load = deriveTeacherLoad({ teacher: CAMPOSO, sections, shiftsById: SHIFTS });
    expect(load.totals.preparations).toBe(2);
  });

  it("reports counted minutes per week with a verifiable breakdown", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    // 2 teaching slots x 40 min x 5 days = 400 minutes.
    expect(load.totals.countedMinutesPerWeek).toBe(400);
    expect(load.totals.countedLabel).toBe("6h 40m");

    const teaching = load.totals.breakdown.find((b) => b.label === "Teaching load");
    expect(teaching.minutesPerWeek).toBe(400);
  });

  it("counts tagged duties but never breaks or rotation filler", () => {
    const teacher = {
      ...CAMPOSO,
      dutySlots: { "6:50 – 7:30": { mon: "Advisory Functions" } },
    };

    const load = deriveTeacherLoad({
      teacher,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    // 400 teaching + one 40-minute tagged duty.
    expect(load.totals.countedMinutesPerWeek).toBe(440);
    const duties = load.totals.breakdown.find((b) => b.label === "Ancillary duties");
    expect(duties.minutesPerWeek).toBe(40);
  });

  it("builds an irregular row set for a teacher straddling both shifts", () => {
    const sections = amSections();
    sections.push({
      id: "justice",
      gradeLevel: "9",
      name: "JUSTICE",
      shiftId: "PM",
      subjects: [{ subject: "Math 7", teacherId: "delacruz", sessionsPerWeek: 1 }],
      cells: { P1: { mon: { subject: "Math 7", teacherId: "delacruz" } } },
    });

    const load = deriveTeacherLoad({ teacher: CAMPOSO, sections, shiftsById: SHIFTS });
    const labels = load.rows.map((r) => r.timeLabel);

    // Morning rows still present, and the afternoon shift is appended.
    expect(labels).toContain("6:10 – 6:50");
    expect(labels).toContain("12:30 – 1:10");
  });

  it("returns an empty grid for a teacher with no assignments", () => {
    const load = deriveTeacherLoad({
      teacher: { id: "ghost", displayName: "Teacher A", handles: [], dutySlots: {} },
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    expect(load.rows).toEqual([]);
    expect(load.totals.preparations).toBe(0);
    expect(load.totals.countedMinutesPerWeek).toBe(0);
    expect(load.totals.uncountedMinutesPerWeek).toBe(0);
  });

  describe("uncountedMinutesPerWeek (N7)", () => {
    it("accumulates the rotation-filler gap-row minutes, excluded from the counted total", () => {
      const load = deriveTeacherLoad({
        teacher: CAMPOSO,
        sections: amSections(),
        shiftsById: SHIFTS,
      });

      // P2 and P4 are gap rows (rotation filler), 40 min x 5 days each = 400.
      expect(load.totals.uncountedMinutesPerWeek).toBe(400);
      // The counted total must not include it.
      expect(load.totals.countedMinutesPerWeek).toBe(400);
    });

    it("excludes a tagged dutySlots override from the uncounted total", () => {
      const teacher = {
        ...CAMPOSO,
        dutySlots: { "6:50 – 7:30": { mon: "Advisory Functions" } },
      };

      const load = deriveTeacherLoad({
        teacher,
        sections: amSections(),
        shiftsById: SHIFTS,
      });

      // One of the ten 40-minute rotation-filler slots became a tagged (counted)
      // duty instead, so uncounted drops by 40: 400 - 40 = 360.
      expect(load.totals.uncountedMinutesPerWeek).toBe(360);
    });

    it("is zero for a teacher with no assignments", () => {
      const load = deriveTeacherLoad({
        teacher: { id: "ghost", displayName: "Teacher A", handles: [], dutySlots: {} },
        sections: amSections(),
        shiftsById: SHIFTS,
      });

      expect(load.totals.uncountedMinutesPerWeek).toBe(0);
    });
  });

  describe("ancillaryLoad (Fix A)", () => {
    it("counts an ancillary designation's minutes into the total and its own breakdown line", () => {
      const teacher = {
        ...CAMPOSO,
        ancillaryLoad: [
          { label: "Test Coordinator", meetingsPerWeek: 5, minutesPerMeeting: 40 },
        ],
      };

      const load = deriveTeacherLoad({
        teacher,
        sections: amSections(),
        shiftsById: SHIFTS,
      });

      // 400 teaching minutes (from the base fixture) + 5 x 40 = 200 ancillary.
      expect(load.totals.countedMinutesPerWeek).toBe(600);

      const line = load.totals.breakdown.find((b) => b.label === "Test Coordinator");
      expect(line).toBeDefined();
      expect(line.minutesPerWeek).toBe(200);
    });

    it("ignores a malformed ancillary entry without producing NaN", () => {
      const teacher = {
        ...CAMPOSO,
        ancillaryLoad: [
          { label: "Missing meetings", minutesPerMeeting: 40 },
          { label: "Zero meetings", meetingsPerWeek: 0, minutesPerMeeting: 40 },
          { label: "Non-numeric", meetingsPerWeek: "five", minutesPerMeeting: 40 },
        ],
      };

      const load = deriveTeacherLoad({
        teacher,
        sections: amSections(),
        shiftsById: SHIFTS,
      });

      // None of the malformed entries should contribute; the base teaching
      // total (400) is unaffected and nothing is NaN.
      expect(load.totals.countedMinutesPerWeek).toBe(400);
      expect(Number.isNaN(load.totals.countedMinutesPerWeek)).toBe(false);
      expect(
        load.totals.breakdown.some((b) =>
          ["Missing meetings", "Zero meetings", "Non-numeric"].includes(b.label)
        )
      ).toBe(false);
    });

    it("counts an ancillary entry with no grid placement at all via the empty-grid path", () => {
      const teacher = {
        id: "coordinator-only",
        displayName: "Teacher B",
        handles: [],
        dutySlots: {},
        ancillaryLoad: [
          { label: "Committee Head", meetingsPerWeek: 1, minutesPerMeeting: 5 },
        ],
      };

      const load = deriveTeacherLoad({
        teacher,
        sections: amSections(),
        shiftsById: SHIFTS,
      });

      expect(load.totals.countedMinutesPerWeek).toBe(5);
      // Single-digit minute, not zero-padded.
      expect(load.totals.countedLabel).toBe("0h 5m");
    });
  });

  describe("row duration drives teaching minutes, not a hardcoded meeting length", () => {
    it("counts a 60-minute row as 60, not 40", () => {
      const LONG_SHIFT = {
        id: "LONG",
        label: "Long Period",
        startTime: "2:00",
        periodDuration: 60,
        periodsPerDay: 1,
        fixedBlocks: [],
      };

      const section = {
        id: "civics",
        gradeLevel: "11",
        name: "CIVICS",
        shiftId: "LONG",
        subjects: [{ subject: "Phil.Pol.", teacherId: "delacruz", sessionsPerWeek: 1 }],
        cells: { P1: { mon: { subject: "Phil.Pol.", teacherId: "delacruz" } } },
      };

      const load = deriveTeacherLoad({
        teacher: CAMPOSO,
        sections: [section],
        shiftsById: { ...SHIFTS, LONG: LONG_SHIFT },
      });

      expect(load.totals.countedMinutesPerWeek).toBe(60);
    });
  });

  describe("formatDuration shape (Fix C)", () => {
    it("renders Xh Ym with a single-digit minute left unpadded", () => {
      const teacher = {
        id: "format-check",
        displayName: "Teacher C",
        handles: [],
        dutySlots: {},
        // 1 x 65 = 65 minutes -> 1h 5m. A bare MOD (as in the workbook's own
        // formula) never zero-pads, so this must read "5m", not "05m".
        ancillaryLoad: [
          { label: "Short Meeting", meetingsPerWeek: 1, minutesPerMeeting: 65 },
        ],
      };

      const load = deriveTeacherLoad({
        teacher,
        sections: amSections(),
        shiftsById: SHIFTS,
      });

      expect(load.totals.countedLabel).toBe("1h 5m");

      // The workbook's own zero-minutes case, e.g. "20h 0m" -- still not
      // zero-padded to "00m".
      const ghost = deriveTeacherLoad({
        teacher: { id: "ghost2", displayName: "Teacher D", handles: [], dutySlots: {} },
        sections: amSections(),
        shiftsById: SHIFTS,
      });
      expect(ghost.totals.countedLabel).toBe("0h 0m");
    });
  });
});
