import { describe, it, expect } from "vitest";
import {
  buildTeacherRoster,
  subjectsForTeacher,
  teachersForSubject,
} from "../schedulePalette";

const USERS = [
  {
    id: "u1",
    fullName: "Ana B. Dela Cruz",
    roles: ["adviser", "subjectTeacher"],
    assignments: [
      { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "LOVE" },
      { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "HOPE" },
      { role: "adviser", gradeLevel: "7", section: "LOVE" },
    ],
  },
  {
    id: "u2",
    fullName: "Karla P. Villanueva",
    roles: ["subjectTeacher"],
    assignments: [
      { role: "subjectTeacher", subject: "AP 7", gradeLevel: "7", section: "FAITH" },
    ],
  },
];

describe("buildTeacherRoster", () => {
  it("seeds handles from distinct subjects in the user's assignments", () => {
    const roster = buildTeacherRoster({ users: USERS, adhocTeachers: [] });
    const delacruz = roster.find((t) => t.displayName === "Ana B. Dela Cruz");

    expect(delacruz.handles).toEqual(["Math 7"]);
    expect(delacruz.source).toBe("user");
    expect(delacruz.userId).toBe("u1");
  });

  it("ignores adviser assignments, which carry no subject", () => {
    const roster = buildTeacherRoster({ users: USERS, adhocTeachers: [] });
    const delacruz = roster.find((t) => t.displayName === "Ana B. Dela Cruz");

    expect(delacruz.handles).not.toContain(undefined);
    expect(delacruz.handles).toHaveLength(1);
  });

  it("includes ad-hoc teachers for staff with no account", () => {
    const roster = buildTeacherRoster({
      users: USERS,
      adhocTeachers: [
        { id: "a1", displayName: "Teacher A", handles: ["ESP 7"] },
      ],
    });
    const adhoc = roster.find((t) => t.displayName === "Teacher A");

    expect(adhoc.source).toBe("adhoc");
    expect(adhoc.handles).toEqual(["ESP 7"]);
  });

  it("lets a stored handles override win over the seeded assignments", () => {
    const roster = buildTeacherRoster({
      users: USERS,
      adhocTeachers: [],
      storedHandles: { u1: ["Math 7", "Math 8"] },
    });
    const delacruz = roster.find((t) => t.userId === "u1");

    expect(delacruz.handles).toEqual(["Math 7", "Math 8"]);
  });

  it("tolerates users with no assignments array", () => {
    const roster = buildTeacherRoster({
      users: [{ id: "u9", fullName: "New Teacher", roles: ["subjectTeacher"] }],
      adhocTeachers: [],
    });

    expect(roster[0].handles).toEqual([]);
  });
});

describe("buildTeacherRoster storedTeachers fallback (N1)", () => {
  it("falls back to storedTeachers for names and handles when users is empty", () => {
    const roster = buildTeacherRoster({
      users: [],
      adhocTeachers: [],
      storedTeachers: [
        { id: "u1", source: "user", displayName: "Ana B. Dela Cruz", handles: ["Math 7"] },
        // An adhoc-sourced stored doc must NOT surface through storedTeachers --
        // that source is the adhocTeachers param's job.
        { id: "a1", source: "adhoc", displayName: "Teacher A", handles: ["ESP 7"] },
      ],
    });

    expect(roster).toHaveLength(1);
    const delacruz = roster.find((t) => t.id === "u1");
    expect(delacruz.displayName).toBe("Ana B. Dela Cruz");
    expect(delacruz.handles).toEqual(["Math 7"]);
    expect(delacruz.source).toBe("user");
  });

  it("does not duplicate a row when users already has the id -- merges instead", () => {
    const roster = buildTeacherRoster({
      users: USERS,
      adhocTeachers: [],
      storedTeachers: [
        { id: "u1", source: "user", displayName: "Stale Name", handles: ["Stale Subject"] },
      ],
    });

    const matches = roster.filter((t) => t.id === "u1");
    expect(matches).toHaveLength(1);
    // users stays the primary source, so nothing changes for editing roles.
    expect(matches[0].displayName).toBe("Ana B. Dela Cruz");
    expect(matches[0].handles).toEqual(["Math 7"]);
  });

  it("falls back to the stored doc id as displayName when the doc has none", () => {
    const roster = buildTeacherRoster({
      users: [],
      adhocTeachers: [],
      storedTeachers: [{ id: "u5", source: "user", handles: [] }],
    });

    expect(roster[0].displayName).toBe("u5");
  });

  it("lets storedHandles override a stored doc's own handles, same as the users path", () => {
    const roster = buildTeacherRoster({
      users: [],
      adhocTeachers: [],
      storedHandles: { u1: ["Math 7", "Math 8"] },
      storedTeachers: [{ id: "u1", source: "user", displayName: "Ann", handles: ["Old"] }],
    });

    expect(roster[0].handles).toEqual(["Math 7", "Math 8"]);
  });
});

describe("subjectsForTeacher", () => {
  it("returns the handles list", () => {
    expect(subjectsForTeacher({ handles: ["Math 7", "Math 8"] })).toEqual([
      "Math 7",
      "Math 8",
    ]);
  });

  it("returns an empty list when handles is missing", () => {
    expect(subjectsForTeacher({})).toEqual([]);
  });
});

describe("teachersForSubject", () => {
  it("narrows to teachers who handle the subject", () => {
    const teachers = [
      { id: "a", displayName: "A", handles: ["Math 7"] },
      { id: "b", displayName: "B", handles: ["AP 7"] },
    ];

    expect(teachersForSubject(teachers, "Math 7").map((t) => t.id)).toEqual(["a"]);
  });

  it("returns every teacher when no subject is selected", () => {
    const teachers = [{ id: "a", handles: ["Math 7"] }];
    expect(teachersForSubject(teachers, "")).toHaveLength(1);
  });
});
