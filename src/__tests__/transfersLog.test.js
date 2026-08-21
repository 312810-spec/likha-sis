// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import TransfersLog from "../TransfersLog.jsx";
import useTeacherScope from "../hooks/useTeacherScope.js";

const { firestoreFixtures, addedDocs } = vi.hoisted(() => ({
  firestoreFixtures: {},
  addedDocs: [],
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
  updateDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  addDoc: vi.fn(async (_ref, data) => {
    addedDocs.push(data);
    return { id: `transfer-${addedDocs.length}` };
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

function teacherScopeFixture(overrides = {}) {
  return {
    adviser: null,
    subjectMap: new Map(),
    classRecordCombos: [],
    classRecordHierarchy: {},
    isAdviser: false,
    isSubjectTeacher: false,
    profile: {},
    loading: false,
    ...overrides,
  };
}

function renderTransfers(userRoles) {
  return render(React.createElement(TransfersLog, { user: { uid: "u1", email: "adviser@tingub.edu.ph" }, userRoles }));
}

describe("TransfersLog (adviser-scoped)", () => {
  beforeEach(() => {
    Object.keys(firestoreFixtures).forEach((k) => delete firestoreFixtures[k]);
    addedDocs.length = 0;
    vi.mocked(useTeacherScope).mockReturnValue(teacherScopeFixture());
  });

  afterEach(() => {
    cleanup();
  });

  it("adviser sees only their advisory's transfer records", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" }, isAdviser: true })
    );
    firestoreFixtures.transfers = [
      { gradeLevel: "Grade 7", section: "Love", schoolYear: "2026-2027", transferType: "in", learnerName: "Dela Cruz, Juan" },
      { gradeLevel: "Grade 8", section: "Hope", schoolYear: "2026-2027", transferType: "out", learnerName: "Santos, Maria" },
    ];

    renderTransfers(["adviser"]);

    await waitFor(() => expect(screen.getByText("Dela Cruz, Juan")).toBeTruthy());
    expect(screen.queryByText("Santos, Maria")).toBeNull();
  });

  it("adviser fails closed with no advisory assignment", async () => {
    renderTransfers(["adviser"]);
    await waitFor(() => expect(screen.getByText("No advisory class assigned.")).toBeTruthy());
    expect(screen.getByText("Contact the ICT Coordinator to update your assignment.")).toBeTruthy();
    expect(screen.queryByText("Record a Transfer")).toBeNull();
  });

  it("adviser has no Grade/Section selector, only their advisory shown", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" }, isAdviser: true })
    );
    renderTransfers(["adviser"]);
    await waitFor(() => expect(screen.getByText("Grade 7 — Love")).toBeTruthy());
    expect(screen.queryByLabelText("Grade Level")).toBeNull();
    expect(screen.queryByText("Select a section")).toBeNull();
  });

  it("computes Transferred In/Out/Net counts correctly", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" }, isAdviser: true })
    );
    firestoreFixtures.transfers = [
      { gradeLevel: "Grade 7", section: "Love", schoolYear: "2026-2027", transferType: "in", learnerName: "A" },
      { gradeLevel: "Grade 7", section: "Love", schoolYear: "2026-2027", transferType: "in", learnerName: "B" },
      { gradeLevel: "Grade 7", section: "Love", schoolYear: "2026-2027", transferType: "in", learnerName: "C" },
      { gradeLevel: "Grade 7", section: "Love", schoolYear: "2026-2027", transferType: "out", learnerName: "D" },
      { gradeLevel: "Grade 7", section: "Love", schoolYear: "2026-2027", transferType: "out", learnerName: "E" },
    ];
    renderTransfers(["adviser"]);
    await waitFor(() => expect(screen.getAllByText("Transferred In").length).toBeGreaterThan(0));
    // The summary card label is the first "Transferred In"/"Transferred Out"
    // occurrence in DOM order; the table's per-row badges come after it.
    const inValue = screen.getAllByText("Transferred In")[0].closest("div").parentElement.querySelector(".font-tabular");
    const outValue = screen.getAllByText("Transferred Out")[0].closest("div").parentElement.querySelector(".font-tabular");
    const netValue = screen.getByText("Net Movement").closest("div").parentElement.querySelector(".font-tabular");
    const totalValue = screen.getByText("Total Records").closest("div").parentElement.querySelector(".font-tabular");
    expect(inValue.textContent).toBe("3");
    expect(outValue.textContent).toBe("2");
    expect(netValue.textContent).toBe("+1"); // 3 in - 2 out
    expect(totalValue.textContent).toBe("5");
  });

  it("renders legacy transfer records that still carry otherSchool without breaking", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" }, isAdviser: true })
    );
    firestoreFixtures.transfers = [
      {
        gradeLevel: "Grade 7",
        section: "Love",
        schoolYear: "2026-2027",
        transferType: "out",
        learnerName: "Legacy Learner",
        otherSchool: "Central High School",
      },
    ];
    renderTransfers(["adviser"]);
    await waitFor(() => expect(screen.getByText("Legacy Learner")).toBeTruthy());
    // The Other School column/value is no longer shown, but rendering doesn't break.
    expect(screen.queryByText("Central High School")).toBeNull();
    expect(screen.queryByText("Other School")).toBeNull();
  });

  it("oversight-only role (no adviser) cannot record a transfer", async () => {
    renderTransfers(["principal"]);
    await waitFor(() => expect(screen.getByText("School-wide Transfers (Read-only)")).toBeTruthy());
    expect(screen.queryByText("Record a Transfer")).toBeNull();
  });

  it("Record Transfer form does not require or collect Other School information", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" }, isAdviser: true })
    );
    firestoreFixtures.learners = [
      { id: "l1", lastName: "Dela Cruz", firstName: "Juan", lrn: "123456789012", gradeLevel: "Grade 7", section: "Love" },
    ];

    renderTransfers(["adviser"]);
    await waitFor(() => expect(screen.getByText("Grade 7 — Love")).toBeTruthy());
    fireEvent.click(screen.getByText("Record a Transfer"));

    await waitFor(() => expect(screen.getByText("Transfer Type *")).toBeTruthy());
    expect(screen.queryByText("Other School")).toBeNull();
    expect(screen.queryByText("Other School *")).toBeNull();

    // Select the learner and save without ever touching an "other school" field.
    const learnerSelect = screen.getByText(/Choose a Learner/).closest("select");
    fireEvent.change(learnerSelect, { target: { value: "l1" } });
    fireEvent.click(screen.getByText("Save Transfer"));

    await waitFor(() => expect(addedDocs.length).toBe(1));
    const saved = addedDocs[0];
    expect(saved.otherSchool).toBeUndefined();
    expect(saved.learnerId).toBe("l1");
    expect(saved.learnerLRN).toBe("123456789012");
    expect(saved.gradeLevel).toBe("Grade 7");
    expect(saved.section).toBe("Love");
    expect(saved.previousEnrollmentStatus).toBe("active");
    expect(saved.newEnrollmentStatus).toBe("active");
    expect(saved.recordedByUid).toBe("u1");
  });

  it("scopes the learner picker to the adviser's own advisory section", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" }, isAdviser: true })
    );
    firestoreFixtures.learners = [
      { id: "l1", lastName: "Dela Cruz", firstName: "Juan", gradeLevel: "Grade 7", section: "Love" },
      { id: "l2", lastName: "Reyes", firstName: "Pedro", gradeLevel: "Grade 8", section: "Hope" },
    ];
    renderTransfers(["adviser"]);
    await waitFor(() => expect(screen.getByText("Grade 7 — Love")).toBeTruthy());
    fireEvent.click(screen.getByText("Record a Transfer"));

    await waitFor(() => expect(screen.getByText(/Choose a Learner \(1 available\)/)).toBeTruthy());
  });
});
