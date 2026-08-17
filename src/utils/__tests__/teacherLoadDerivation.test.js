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
  id: "camposo",
  displayName: "Mrs. Camposo",
  handles: ["Math 7"],
  designations: ["Grade 7 Adviser"],
  dutySlots: {},
};

// Camposo teaches Math 7 to LOVE at P1 and to HOPE at P3, every day.
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
      subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 }],
      cells: { P1: daily("Math 7", "camposo") },
    },
    {
      id: "hope",
      gradeLevel: "7",
      name: "HOPE",
      shiftId: "AM",
      subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 }],
      cells: { P3: daily("Math 7", "camposo") },
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
      subjects: [{ subject: "Math 10", teacherId: "camposo", sessionsPerWeek: 5 }],
      cells: { P2: { mon: { subject: "Math 10", teacherId: "camposo" } } },
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
      subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 1 }],
      cells: { P1: { mon: { subject: "Math 7", teacherId: "camposo" } } },
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
  });
});
