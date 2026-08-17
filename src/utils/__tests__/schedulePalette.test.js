import { describe, it, expect } from "vitest";
import {
  buildTeacherRoster,
  subjectsForTeacher,
  teachersForSubject,
} from "../schedulePalette";

const USERS = [
  {
    id: "u1",
    fullName: "Ann A. Camposo",
    roles: ["adviser", "subjectTeacher"],
    assignments: [
      { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "LOVE" },
      { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "HOPE" },
      { role: "adviser", gradeLevel: "7", section: "LOVE" },
    ],
  },
  {
    id: "u2",
    fullName: "Karen Mae P. Cabahug",
    roles: ["subjectTeacher"],
    assignments: [
      { role: "subjectTeacher", subject: "AP 7", gradeLevel: "7", section: "FAITH" },
    ],
  },
];

describe("buildTeacherRoster", () => {
  it("seeds handles from distinct subjects in the user's assignments", () => {
    const roster = buildTeacherRoster({ users: USERS, adhocTeachers: [] });
    const camposo = roster.find((t) => t.displayName === "Ann A. Camposo");

    expect(camposo.handles).toEqual(["Math 7"]);
    expect(camposo.source).toBe("user");
    expect(camposo.userId).toBe("u1");
  });

  it("ignores adviser assignments, which carry no subject", () => {
    const roster = buildTeacherRoster({ users: USERS, adhocTeachers: [] });
    const camposo = roster.find((t) => t.displayName === "Ann A. Camposo");

    expect(camposo.handles).not.toContain(undefined);
    expect(camposo.handles).toHaveLength(1);
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
    const camposo = roster.find((t) => t.userId === "u1");

    expect(camposo.handles).toEqual(["Math 7", "Math 8"]);
  });

  it("tolerates users with no assignments array", () => {
    const roster = buildTeacherRoster({
      users: [{ id: "u9", fullName: "New Teacher", roles: ["subjectTeacher"] }],
      adhocTeachers: [],
    });

    expect(roster[0].handles).toEqual([]);
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
