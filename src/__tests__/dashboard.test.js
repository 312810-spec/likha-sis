// @vitest-environment jsdom
//
// Dashboard is now a role-aware hub: both what renders AND what Firestore
// collections are queried must be scoped to the signed-in user's role(s).
// The firebase/firestore mock below dispatches getDocs/getDoc by collection
// name against test-seeded fixtures, and applies any equality `where`
// clauses client-side, so a test can assert that e.g. an adviser's learners
// query only ever "sees" docs matching their own gradeLevel/section, and
// that a stakeholder never triggers a learners/attendance/LARDO query at all.

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import Dashboard from "../Dashboard.jsx";
import useTeacherScope from "../hooks/useTeacherScope.js";

const { firestoreFixtures, firestoreDocFixtures, firestoreErrors, queriedCollections } = vi.hoisted(() => ({
  firestoreFixtures: {},
  firestoreDocFixtures: {},
  firestoreErrors: new Set(),
  queriedCollections: [],
}));

vi.mock("../firebase.js", () => ({
  auth: {},
  db: {},
}));

vi.mock("../hooks/useTeacherScope.js", () => ({
  default: vi.fn(),
}));

vi.mock("../hooks/useAcademicCalendar.js", () => ({
  default: () => ({
    calendar: {
      "2026-2027": {
        schoolYearLabel: "2026-2027",
        terms: [
          { id: "term-1", label: "Term 1", startDate: "2026-06-08", endDate: "2026-09-15" },
          { id: "term-2", label: "Term 2", startDate: "2026-09-16", endDate: "2026-12-18" },
          { id: "term-3", label: "Term 3", startDate: "2027-01-04", endDate: "2027-04-08" },
        ],
      },
    },
    schoolYears: ["2026-2027"],
    loading: false,
  }),
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
  limit: vi.fn((n) => ({ kind: "limit", n })),
  orderBy: vi.fn((field, dir) => ({ kind: "orderBy", field, dir })),
  doc: vi.fn((_db, name, id) => ({ kind: "doc", name, id })),
  getDocs: vi.fn(async (ref) => {
    const name = collectionNameOf(ref);
    queriedCollections.push(name);
    if (firestoreErrors.has(name)) throw new Error(`mock failure: ${name}`);
    let docs = firestoreFixtures[name] || [];
    whereClausesOf(ref).forEach((w) => {
      docs = docs.filter((d) => d[w.field] === w.value);
    });
    return {
      size: docs.length,
      docs: docs.map((data, i) => ({ id: data.id || `${name}-${i}`, data: () => data })),
    };
  }),
  getDoc: vi.fn(async (ref) => {
    queriedCollections.push(ref.name);
    if (firestoreErrors.has(ref.name)) throw new Error(`mock failure: ${ref.name}`);
    const data = firestoreDocFixtures[`${ref.name}/${ref.id}`];
    return { exists: () => !!data, data: () => data };
  }),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => false, data: () => ({}) });
    return () => {};
  }),
}));

function teacherScopeFixture(overrides = {}) {
  return {
    adviser: null,
    subjectMap: new Map(),
    classRecordCombos: [],
    classRecordHierarchy: {},
    allowedSectionKeys: new Set(),
    isAdviser: false,
    isSubjectTeacher: false,
    advisorySection: null,
    roles: [],
    profile: { fullName: "Juan Dela Cruz" },
    loading: false,
    ...overrides,
  };
}

function renderDashboard(props = {}) {
  return render(
    React.createElement(Dashboard, {
      user: { uid: "u1", email: "juan@tingub.edu.ph" },
      userRoles: [],
      goToSF1: vi.fn(),
      goToSF2: vi.fn(),
      goToViewLearners: vi.fn(),
      goToLardo: vi.fn(),
      goToSchoolSettings: vi.fn(),
      onNavigate: vi.fn(),
      ...props,
    })
  );
}

function noQueryFrom(names) {
  names.forEach((name) => expect(queriedCollections).not.toContain(name));
}

describe("Dashboard (role-aware)", () => {
  beforeEach(() => {
    Object.keys(firestoreFixtures).forEach((k) => delete firestoreFixtures[k]);
    Object.keys(firestoreDocFixtures).forEach((k) => delete firestoreDocFixtures[k]);
    firestoreErrors.clear();
    queriedCollections.length = 0;
    vi.mocked(useTeacherScope).mockReturnValue(teacherScopeFixture());
  });

  afterEach(() => {
    cleanup();
  });

  it("adviser sees advisory-scoped metrics and never queries school-wide learners", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" }, isAdviser: true })
    );
    firestoreFixtures.learners = [
      { gradeLevel: "Grade 7", section: "Love", sex: "M", enrollmentStatus: "active" },
      { gradeLevel: "Grade 7", section: "Love", sex: "F", enrollmentStatus: "active" },
      // A different section's learners must never be counted into the adviser's tile.
      { gradeLevel: "Grade 8", section: "Hope", sex: "M", enrollmentStatus: "active" },
    ];

    renderDashboard({ userRoles: ["adviser"] });

    await waitFor(() => {
      expect(screen.getByText("2 active learners")).toBeTruthy();
    });
    expect(screen.getByText("1 Male · 1 Female")).toBeTruthy();
  });

  it("adviser sees School Forms quick actions and LARDO scoped to their own section", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" }, isAdviser: true })
    );
    firestoreFixtures.lardoRecords = [
      { gradeLevel: "Grade 7", section: "Love", status: "monitoring" },
      { gradeLevel: "Grade 8", section: "Hope", status: "monitoring" }, // different section, must not count
    ];

    renderDashboard({ userRoles: ["adviser"] });

    await waitFor(() => {
      expect(screen.getByText("1 learner under monitoring")).toBeTruthy();
    });
    expect(screen.getByText("SF1")).toBeTruthy();
    expect(screen.getByText("SF2")).toBeTruthy();
  });

  it("subjectTeacher without adviser sees teaching widgets but no School Forms, and never queries learners/attendance", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        isSubjectTeacher: true,
        subjectMap: new Map([["Mathematics 7", [{ gradeLevel: "Grade 7", section: "Love", terms: null }]]]),
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Mathematics 7", section: "Love", terms: null }],
        classRecordHierarchy: { "Grade 7": { "Mathematics 7": [{ section: "Love", terms: null }] } },
      })
    );

    renderDashboard({ userRoles: ["subjectTeacher"] });

    await waitFor(() => {
      expect(screen.getByText("Mathematics 7")).toBeTruthy();
    });
    expect(screen.queryByText("SF1")).toBeNull();
    expect(screen.queryByText("SF2")).toBeNull();
    noQueryFrom(["learners", "attendance", "lardoRecords", "nutritionRecords"]);
  });

  it("principal sees school-level metrics without any gradeLevel/section scoping", async () => {
    firestoreFixtures.learners = [
      { gradeLevel: "Grade 7", section: "Love", schoolYear: "2026-2027", enrollmentStatus: "active" },
      { gradeLevel: "Grade 8", section: "Hope", schoolYear: "2026-2027", enrollmentStatus: "active" },
      { gradeLevel: "Grade 8", section: "Hope", schoolYear: "2026-2027", enrollmentStatus: "transferred-out" },
    ];
    firestoreFixtures.lardoRecords = [{ schoolYear: "2026-2027", status: "monitoring" }];

    renderDashboard({ userRoles: ["principal"] });

    await waitFor(() => {
      expect(screen.getByText("Active Enrollment")).toBeTruthy();
    });
    const enrollmentTile = screen.getByText("Active Enrollment").closest(".flex-1");
    expect(enrollmentTile.textContent).toContain("2");
    expect(screen.getByText("Learners at Risk")).toBeTruthy();
  });

  it("ictCoordinator sees system/user info and never queries LARDO, nutrition, or disciplinary data", async () => {
    firestoreFixtures.users = [
      { roles: ["adviser"], assignments: [{ role: "adviser", gradeLevel: "7", section: "Love" }], active: true },
      { roles: ["subjectTeacher"], assignments: [], active: false }, // missing subject assignment, deactivated
    ];

    renderDashboard({ userRoles: ["ictCoordinator"] });

    await waitFor(() => {
      expect(screen.getByText("Total Users")).toBeTruthy();
    });
    expect(screen.getByText("Assignment Health")).toBeTruthy();
    noQueryFrom(["lardoRecords", "nutritionRecords", "disciplinaryRecords", "learners"]);
  });

  it("smeaCoordinator sees monitoring/evaluation info", async () => {
    firestoreFixtures.learners = [{ gradeLevel: "Grade 7", section: "Love", schoolYear: "2026-2027", enrollmentStatus: "active" }];
    firestoreFixtures.lardoRecords = [{ schoolYear: "2026-2027", status: "monitoring" }];
    firestoreFixtures.nutritionRecords = [{ schoolYear: "2026-2027", nutritionalStatus: "Wasted" }];

    renderDashboard({ userRoles: ["smeaCoordinator"] });

    await waitFor(() => {
      expect(screen.getByText("LARDO Monitoring")).toBeTruthy();
    });
    expect(screen.getByText("Nutrition Follow-up")).toBeTruthy();
  });

  it("guidance sees learner-support info without ICT/enrollment-management widgets", async () => {
    firestoreFixtures.lardoRecords = [{ schoolYear: "2026-2027", status: "monitoring", riskFactors: ["Bullying/peer issues"] }];
    firestoreFixtures.disciplinaryRecords = [{ schoolYear: "2026-2027", status: "open" }];

    renderDashboard({ userRoles: ["guidance"] });

    await waitFor(() => {
      expect(screen.getByText("Under Monitoring")).toBeTruthy();
    });
    expect(screen.getByText("Disciplinary Cases")).toBeTruthy();
    expect(screen.queryByText("Total Users")).toBeNull();
    noQueryFrom(["users", "importBatches"]);
  });

  it("stakeholder sees no learner/private widgets and triggers zero private-data queries", async () => {
    renderDashboard({ userRoles: ["stakeholder"] });

    await waitFor(() => {
      expect(screen.getByText("Upcoming")).toBeTruthy();
    });
    expect(screen.queryByText("Active Enrollment")).toBeNull();
    expect(screen.queryByText("Total Users")).toBeNull();
    expect(screen.queryByText("SF1")).toBeNull();
    noQueryFrom(["learners", "attendance", "lardoRecords", "nutritionRecords", "disciplinaryRecords", "users", "importBatches"]);
  });

  it("multi-role adviser+subjectTeacher gets the union of widgets without duplicating School Forms", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        adviser: { gradeLevel: "Grade 7", section: "Love" },
        isAdviser: true,
        isSubjectTeacher: true,
        subjectMap: new Map([["Mathematics 7", [{ gradeLevel: "Grade 7", section: "Love", terms: null }]]]),
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Mathematics 7", section: "Love", terms: null }],
        classRecordHierarchy: { "Grade 7": { "Mathematics 7": [{ section: "Love", terms: null }] } },
      })
    );
    firestoreFixtures.learners = [{ gradeLevel: "Grade 7", section: "Love", sex: "M", enrollmentStatus: "active" }];

    renderDashboard({ userRoles: ["adviser", "subjectTeacher"] });

    await waitFor(() => {
      expect(screen.getByText("Mathematics 7")).toBeTruthy();
    });
    expect(screen.getByText("1 active learner")).toBeTruthy();
    // SF1 appears exactly once (School Forms card), not duplicated into Quick Actions too.
    expect(screen.getAllByText("SF1")).toHaveLength(1);
  });

  it("quick actions never include a page the role cannot access", async () => {
    renderDashboard({ userRoles: ["guidance"] });

    await waitFor(() => {
      expect(screen.getByText("Under Monitoring")).toBeTruthy();
    });
    expect(screen.queryByText("SF1")).toBeNull();
    expect(screen.queryByText("User Management")).toBeNull();
  });

  it("a failed adviser widget query does not blank the header or the common panel", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({ adviser: { gradeLevel: "Grade 7", section: "Love" }, isAdviser: true })
    );
    firestoreErrors.add("learners");

    renderDashboard({ userRoles: ["adviser"] });

    await waitFor(() => {
      expect(screen.getByText("Unable to load learners.")).toBeTruthy();
    });
    expect(screen.getByText(/Good (morning|afternoon|evening), /)).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
  });

  it("missing roles fail closed to the common panel only", async () => {
    renderDashboard({ userRoles: [] });

    await waitFor(() => {
      expect(screen.getByText("Upcoming")).toBeTruthy();
    });
    expect(
      screen.getByText("No dashboard content is available for your account yet. Contact your ICT Coordinator if this seems wrong.")
    ).toBeTruthy();
  });

  it("keeps the responsive/dark-mode container structure", async () => {
    const { container } = renderDashboard({ userRoles: ["stakeholder"] });
    await waitFor(() => {
      expect(screen.getByText("Upcoming")).toBeTruthy();
    });
    expect(container.querySelector(".dark\\:text-gray-100")).toBeTruthy();
    expect(container.querySelector(".lg\\:grid-cols-\\[1fr_320px\\]")).toBeTruthy();
  });
});
