// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import ConsolidatedGrades from "../ConsolidatedGrades.jsx";
import useTeacherScope from "../hooks/useTeacherScope.js";

const { firestoreFixtures, firestoreDocFixtures, setDocCalls } = vi.hoisted(() => ({
  firestoreFixtures: {},
  firestoreDocFixtures: {},
  setDocCalls: [],
}));

vi.mock("../firebase.js", () => ({ db: {} }));

vi.mock("../hooks/useTeacherScope.js", () => ({ default: vi.fn() }));

vi.mock("../hooks/useAcademicCalendar.js", () => ({
  default: () => ({ calendar: {}, schoolYears: ["2026-2027"], loading: false }),
}));

vi.mock("../hooks/useSchoolConfig.js", () => ({
  default: () => ({ config: { gradeLevelsOffered: ["Grade 7", "Grade 8"] }, loading: false }),
}));

vi.mock("../hooks/useAvailableSections.js", () => ({
  default: () => ({ sections: ["Love", "Hope"], loading: false }),
}));

function collectionNameOf(ref) {
  if (!ref) return null;
  if (ref.kind === "collection") return ref.name;
  if (ref.kind === "query") return collectionNameOf(ref.ref);
  return null;
}

function whereClausesOf(ref) {
  if (!ref || ref.kind !== "query") return [];
  return (ref.clauses || []).filter((c) => c?.kind === "where");
}

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, name) => ({ kind: "collection", name })),
  query: vi.fn((ref, ...clauses) => ({ kind: "query", ref, clauses })),
  where: vi.fn((field, op, value) => ({ kind: "where", field, op, value })),
  doc: vi.fn((_db, name, id) => ({ kind: "doc", name, id })),
  setDoc: vi.fn(async (ref, data) => {
    setDocCalls.push({ ref, data });
  }),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  getDoc: vi.fn(async (ref) => {
    const data = firestoreDocFixtures[`${ref.name}/${ref.id}`];
    return { exists: () => !!data, data: () => data };
  }),
  getDocs: vi.fn(async (ref) => {
    const name = collectionNameOf(ref);
    let docs = firestoreFixtures[name] || [];
    whereClausesOf(ref).forEach((w) => {
      docs = docs.filter((d) => d[w.field] === w.value);
    });
    return { size: docs.length, docs: docs.map((data, i) => ({ id: data.id || `${name}-${i}`, data: () => data })) };
  }),
}));

// Matches the fixture used by gradeComputations.test.js: Core-subject
// weights (20/50/30) yield an Initial Grade of 90 for l1's scores.
function passingMathRecord(overrides = {}) {
  return {
    subject: "MATHEMATICS",
    gradeLevel: "Grade 7",
    section: "Love",
    schoolYear: "2026-2027",
    term: "Term 1",
    wwItems: [{ id: "ww1", hps: 10 }],
    ptItems: [{ id: "pt1", hps: 20 }],
    exHPS: { st1: 10, st2: 10, te: 20 },
    scores: {
      l1: { ww: { ww1: 9 }, pt: { pt1: 18 }, st1: 9, st2: 9, te: 18 },
    },
    ...overrides,
  };
}

function failingScienceRecord(overrides = {}) {
  return {
    subject: "SCIENCE",
    gradeLevel: "Grade 7",
    section: "Love",
    schoolYear: "2026-2027",
    term: "Term 1",
    wwItems: [{ id: "ww1", hps: 10 }],
    ptItems: [{ id: "pt1", hps: 20 }],
    exHPS: { st1: 10, st2: 10, te: 20 },
    scores: {
      l1: { ww: { ww1: 5 }, pt: { pt1: 10 }, st1: 5, st2: 5, te: 10 },
    },
    ...overrides,
  };
}

function teacherScopeFixture(overrides = {}) {
  return { adviser: null, loading: false, ...overrides };
}

function renderPage(userRoles) {
  return render(React.createElement(ConsolidatedGrades, { user: { uid: "u1", email: "adviser@tingub.edu.ph" }, userRoles }));
}

describe("ConsolidatedGrades (adviser-scoped)", () => {
  beforeEach(() => {
    Object.keys(firestoreFixtures).forEach((k) => delete firestoreFixtures[k]);
    Object.keys(firestoreDocFixtures).forEach((k) => delete firestoreDocFixtures[k]);
    setDocCalls.length = 0;
    vi.mocked(useTeacherScope).mockReturnValue(teacherScopeFixture());
  });

  afterEach(() => {
    cleanup();
  });

  it("auto-resolves the adviser's assigned advisory with no manual setup", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" } })
    );
    firestoreFixtures.classRecords = [passingMathRecord()];
    firestoreFixtures.learners = [{ id: "l1", lastName: "Dela Cruz", firstName: "Juan", gradeLevel: "Grade 7", section: "Love", sex: "M" }];

    renderPage(["adviser"]);

    await waitFor(() => expect(screen.getByText("Dela Cruz, Juan")).toBeTruthy());
    expect(screen.getByText("Grade 7 — Love")).toBeTruthy();
    expect(screen.queryByText("Select Section Setup")).toBeNull();
  });

  it("has no Grade/Section selector for adviser", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" } })
    );
    firestoreFixtures.classRecords = [passingMathRecord()];
    firestoreFixtures.learners = [{ id: "l1", lastName: "Dela Cruz", firstName: "Juan", gradeLevel: "Grade 7", section: "Love" }];

    renderPage(["adviser"]);
    await waitFor(() => expect(screen.getByText("Dela Cruz, Juan")).toBeTruthy());
    expect(screen.queryByText("Change Setup")).toBeNull();
    expect(screen.queryByText("Load Consolidated Grades")).toBeNull();
  });

  it("never loads a learner from an unrelated section", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" } })
    );
    firestoreFixtures.classRecords = [passingMathRecord()];
    firestoreFixtures.learners = [
      { id: "l1", lastName: "Dela Cruz", firstName: "Juan", gradeLevel: "Grade 7", section: "Love" },
      { id: "l2", lastName: "Santos", firstName: "Maria", gradeLevel: "Grade 8", section: "Hope" },
    ];

    renderPage(["adviser"]);
    await waitFor(() => expect(screen.getByText("Dela Cruz, Juan")).toBeTruthy());
    expect(screen.queryByText("Santos, Maria")).toBeNull();
  });

  it("aggregates every subject recorded for the advisory, regardless of who taught it", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" } })
    );
    firestoreFixtures.classRecords = [passingMathRecord(), failingScienceRecord()];
    firestoreFixtures.learners = [{ id: "l1", lastName: "Dela Cruz", firstName: "Juan", gradeLevel: "Grade 7", section: "Love" }];

    renderPage(["adviser"]);
    await waitFor(() => expect(screen.getByText("MATHEMATICS")).toBeTruthy());
    expect(screen.getByText("SCIENCE")).toBeTruthy();
  });

  it("a bare subjectTeacher account (no adviser role) has no access", async () => {
    renderPage(["subjectTeacher"]);
    await waitFor(() => expect(screen.getByText("You don't have access to Consolidated Grades.")).toBeTruthy());
  });

  it("preserves the manual Grade/Section/School Year setup for authorized oversight roles", async () => {
    renderPage(["principal"]);
    await waitFor(() => expect(screen.getByText("Select Section Setup")).toBeTruthy());
    expect(screen.getByText("Load Consolidated Grades")).toBeTruthy();
  });

  it("fails closed with no advisory assignment", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(teacherScopeFixture({ adviser: null, loading: false }));
    renderPage(["adviser"]);
    await waitFor(() => expect(screen.getByText("No advisory class assigned.")).toBeTruthy());
    expect(screen.getByText("Contact the ICT Coordinator to update your assignment.")).toBeTruthy();
  });

  it("calculates class summary metrics correctly", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" } })
    );
    firestoreFixtures.classRecords = [passingMathRecord()];
    firestoreFixtures.learners = [{ id: "l1", lastName: "Dela Cruz", firstName: "Juan", gradeLevel: "Grade 7", section: "Love" }];

    renderPage(["adviser"]);
    await waitFor(() => expect(screen.getByText("Learners")).toBeTruthy());
    expect(screen.getByText("Passing Learners")).toBeTruthy();
    expect(screen.getByText("Class General Average")).toBeTruthy();
    // One learner, one subject, passing (IG 90 -> well above 75).
    const learnersValue = screen.getByText("Learners").parentElement.querySelector(".font-tabular");
    expect(learnersValue.textContent).toBe("1");
  });

  it("preserves the learner's real LRN when confirming a LARDO flag from Consolidated Grades", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" } })
    );
    firestoreFixtures.classRecords = [failingScienceRecord()];
    firestoreFixtures.learners = [
      { id: "l1", lastName: "Dela Cruz", firstName: "Juan", lrn: "123456789012", gradeLevel: "Grade 7", section: "Love" },
    ];

    renderPage(["adviser"]);
    await waitFor(() => expect(screen.getByText(/LARDO risk flag/)).toBeTruthy());
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(setDocCalls.length).toBe(1));
    expect(setDocCalls[0].data.learnerLRN).toBe("123456789012");
  });
});
