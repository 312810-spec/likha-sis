import { describe, it, expect } from "vitest";
import { findConflicts } from "../scheduleConflicts";

const TEACHERS = {
  camposo: { id: "camposo", displayName: "Mrs. Camposo", handles: ["Math 7"] },
  hermoso: { id: "hermoso", displayName: "Mr. Hermoso", handles: ["TLE 7"] },
};

// Minimal section: one subject meeting once a week, on Monday only.
function sectionWith(cells, overrides = {}) {
  return {
    id: "s7love",
    gradeLevel: "7",
    name: "LOVE",
    shiftId: "AM",
    subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 1 }],
    cells,
    ...overrides,
  };
}

describe("findConflicts", () => {
  it("returns nothing for a clean single-section schedule", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "camposo" } } }),
    ];

    expect(findConflicts({ sections, teachersById: TEACHERS })).toEqual([]);
  });

  it("flags a teacher booked in two sections at the same period and day, once per section", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "camposo" } } }),
      sectionWith(
        { P1: { mon: { subject: "Math 7", teacherId: "camposo" } } },
        { id: "s7hope", name: "HOPE" }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    const doubled = conflicts.filter((c) => c.type === "teacherDoubleBooked");

    // One conflict per involved section (FIX-11) -- not one shared conflict --
    // so ScheduleGrid can scope the red cell to the sections actually involved
    // and an unrelated section's grid stays clean.
    expect(doubled).toHaveLength(2);
    expect(doubled.map((c) => c.sectionId).sort()).toEqual(["s7hope", "s7love"]);
    doubled.forEach((c) => {
      expect(c.teacherId).toBe("camposo");
      expect(c.periodId).toBe("P1");
      expect(c.day).toBe("mon");
      expect(c.message).toContain("Mrs. Camposo");
    });
  });

  it("does not flag the same teacher in two sections on different days", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "camposo" } } }),
      sectionWith(
        { P1: { tue: { subject: "Math 7", teacherId: "camposo" } } },
        { id: "s7hope", name: "HOPE" }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    expect(conflicts.filter((c) => c.type === "teacherDoubleBooked")).toEqual([]);
  });

  it("flags a placed subject with no teacher", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "" } } }),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    const unstaffed = conflicts.filter((c) => c.type === "unstaffed");

    expect(unstaffed).toHaveLength(1);
    expect(unstaffed[0].subject).toBe("Math 7");
  });

  it("flags a subject placed fewer times than its sessionsPerWeek", () => {
    const sections = [
      sectionWith(
        { P1: { mon: { subject: "Math 7", teacherId: "camposo" } } },
        { subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 }] }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    const mismatch = conflicts.find((c) => c.type === "sessionCountMismatch");

    expect(mismatch.subject).toBe("Math 7");
    expect(mismatch.message).toContain("1");
    expect(mismatch.message).toContain("5");
  });

  it("flags a subject placed more times than its sessionsPerWeek", () => {
    const sections = [
      sectionWith(
        {
          P1: {
            mon: { subject: "Math 7", teacherId: "camposo" },
            tue: { subject: "Math 7", teacherId: "camposo" },
          },
        },
        { subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 1 }] }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    expect(conflicts.some((c) => c.type === "sessionCountMismatch")).toBe(true);
  });

  it("warns when a teacher is assigned outside their handles list", () => {
    const sections = [
      sectionWith(
        { P1: { mon: { subject: "TLE 7", teacherId: "camposo" } } },
        { subjects: [{ subject: "TLE 7", teacherId: "camposo", sessionsPerWeek: 1 }] }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    const outOfQual = conflicts.filter((c) => c.type === "outOfQualification");

    expect(outOfQual).toHaveLength(1);
    expect(outOfQual[0].teacherId).toBe("camposo");
    expect(outOfQual[0].subject).toBe("TLE 7");
  });

  it("does not warn for an unknown teacher id, which unstaffed already covers", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "" } } }),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    expect(conflicts.some((c) => c.type === "outOfQualification")).toBe(false);
  });

  it("flags a cell whose teacherId no longer matches any known teacher", () => {
    const sections = [
      sectionWith(
        { P1: { mon: { subject: "Math 7", teacherId: "deleted-uid" } } },
        { subjects: [{ subject: "Math 7", teacherId: "deleted-uid", sessionsPerWeek: 1 }] }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    const unknown = conflicts.filter((c) => c.type === "unknownTeacher");

    expect(unknown).toHaveLength(1);
    expect(unknown[0].sectionId).toBe("s7love");
    expect(unknown[0].periodId).toBe("P1");
    expect(unknown[0].day).toBe("mon");
    expect(unknown[0].subject).toBe("Math 7");
    expect(unknown[0].teacherId).toBe("deleted-uid");
    expect(unknown[0].message).toContain("LOVE");
    expect(unknown[0].message).toContain("deleted-uid");
  });

  it("does not flag unknownTeacher for a blank teacherId, which unstaffed already covers", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "" } } }),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    expect(conflicts.some((c) => c.type === "unknownTeacher")).toBe(false);
  });

  it("tolerates missing cells and missing subjects arrays", () => {
    const sections = [{ id: "empty", gradeLevel: "7", name: "PEACE", shiftId: "AM" }];
    expect(findConflicts({ sections, teachersById: TEACHERS })).toEqual([]);
  });
});
