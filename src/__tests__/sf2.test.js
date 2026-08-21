// @vitest-environment jsdom
// src/__tests__/sf2.test.js
// Covers the SF2 redesign: Daily Attendance as the default view, the
// per-day lock/Edit/Save workflow, Male/Female separation, Mark Everyone
// Present, the Remarks pop-up, Monthly SF2's official Absent+Present split,
// Year Overview, and the unsaved-changes guard.
//
// PRIVACY: every learner below is INVENTED.

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup, waitFor } from "@testing-library/react";
import SF2 from "../SF2.jsx";
import useTeacherScope from "../hooks/useTeacherScope.js";
import { todayDateString } from "../utils/attendanceDates.js";

const { collectionFixtures, docFixtures, savedDocs } = vi.hoisted(() => ({
  collectionFixtures: {}, // name -> array of docs (with `id`)
  docFixtures: {}, // name -> { id: data }
  savedDocs: [], // { collection, id, data, opts }
}));

vi.mock("../firebase.js", () => ({ db: {} }));
vi.mock("../hooks/useTeacherScope.js", () => ({ default: vi.fn() }));
vi.mock("../hooks/useSchoolConfig.js", () => ({
  default: () => ({
    config: {
      schoolId: "312810",
      schoolName: "Tingub National High School",
      principalName: "Lourdes Reyes Mendoza",
    },
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
function makeSnapshot(docs) {
  const wrapped = docs.map((d, i) => ({ id: d.id || `doc-${i}`, data: () => d }));
  return { size: wrapped.length, docs: wrapped, forEach: (cb) => wrapped.forEach(cb) };
}

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, name) => ({ kind: "collection", name })),
  query: vi.fn((ref, ...clauses) => ({ kind: "query", ref, clauses })),
  where: vi.fn((field, op, value) => ({ kind: "where", field, op, value })),
  doc: vi.fn((_db, name, id) => ({ kind: "doc", name, id })),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  getDocs: vi.fn(async (ref) => {
    const name = collectionNameOf(ref);
    let docs = collectionFixtures[name] || [];
    whereClausesOf(ref).forEach((w) => {
      docs = docs.filter((d) => d[w.field] === w.value);
    });
    return makeSnapshot(docs);
  }),
  getDoc: vi.fn(async (ref) => {
    const store = docFixtures[ref.name] || {};
    const data = store[ref.id];
    return { exists: () => Boolean(data), data: () => data, id: ref.id };
  }),
  setDoc: vi.fn(async (ref, data, opts) => {
    savedDocs.push({ collection: ref.name, id: ref.id, data, opts });
    docFixtures[ref.name] = docFixtures[ref.name] || {};
    docFixtures[ref.name][ref.id] = opts?.merge
      ? { ...(docFixtures[ref.name][ref.id] || {}), ...data }
      : data;
  }),
}));

function adviserScopeFixture(overrides = {}) {
  return {
    adviser: { gradeLevel: "Grade 7", section: "FAITH" },
    roles: ["adviser"],
    profile: { fullName: "Juana Cruz Santos" },
    loading: false,
    ...overrides,
  };
}

function renderSF2(userRoles = ["adviser"]) {
  return render(
    React.createElement(SF2, { user: { uid: "u1", email: "adviser@tingub.edu.ph" }, userRoles })
  );
}

const TODAY = todayDateString();

describe("SF2 — Daily Attendance is the default view", () => {
  beforeEach(() => {
    collectionFixtures.learners = [
      { id: "delgado", lastName: "DELGADO", firstName: "RAMON", sex: "M", gradeLevel: "Grade 7", section: "FAITH", lrn: "900000000057" },
      { id: "santiago", lastName: "SANTIAGO", firstName: "MARIA", sex: "F", gradeLevel: "Grade 7", section: "FAITH", lrn: "900000000018" },
    ];
    collectionFixtures.attendance = [];
    docFixtures.attendance = {};
    docFixtures.lardoRecords = {};
    savedDocs.length = 0;
    vi.mocked(useTeacherScope).mockReturnValue(adviserScopeFixture());
  });
  afterEach(() => cleanup());

  it("shows Daily Attendance with Male before Female, no picker needed", async () => {
    renderSF2();
    await waitFor(() => expect(screen.getByText(/Male Learners — 1/)).toBeTruthy());
    expect(screen.getByText(/Female Learners — 1/)).toBeTruthy();
    expect(screen.getByText("Grade 7 - FAITH")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /select class/i })).toBeNull();
  });

  it("today opens unlocked -- Present/Absent/Tardy buttons work without pressing Edit", async () => {
    renderSF2();
    await waitFor(() => expect(screen.getByText(/DELGADO, RAMON/)).toBeTruthy());
    const row = screen.getByText(/DELGADO, RAMON/).closest("li");
    const absentBtn = within(row).getByRole("button", { name: "Absent" });
    expect(absentBtn.disabled).toBe(false);
    fireEvent.click(absentBtn);
    expect(absentBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("Save Attendance writes the correct code and re-locks the day", async () => {
    renderSF2();
    await waitFor(() => expect(screen.getByText(/DELGADO, RAMON/)).toBeTruthy());
    const row = screen.getByText(/DELGADO, RAMON/).closest("li");
    fireEvent.click(within(row).getByRole("button", { name: "Absent" }));

    const saveBtn = screen.getByRole("button", { name: /Save Attendance for/i });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(screen.getByText("Attendance saved.")).toBeTruthy());
    const saved = savedDocs.find((d) => d.collection === "attendance");
    expect(saved.data.records.delgado[TODAY]).toBe("A");
    // Re-locked after save -- the Present/Absent/Tardy buttons are disabled again.
    expect(within(row).getByRole("button", { name: "Absent" }).disabled).toBe(true);
  });

  it("navigating to Previous Day opens it locked, requiring Edit to change", async () => {
    renderSF2();
    await waitFor(() => expect(screen.getByText(/DELGADO, RAMON/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Previous Day/i }));

    const row = await screen.findByText(/DELGADO, RAMON/);
    const li = row.closest("li");
    expect(within(li).getByRole("button", { name: "Absent" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Edit This Day's Attendance/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Edit This Day's Attendance/i }));
    expect(within(li).getByRole("button", { name: "Absent" }).disabled).toBe(false);
  });

  it("Mark Everyone Present asks for confirmation only when there's something to clear", async () => {
    docFixtures.attendance[`Grade_7_FAITH_${TODAY.slice(0, 7)}`] = {
      gradeLevel: "Grade 7",
      section: "FAITH",
      month: TODAY.slice(0, 7),
      records: { delgado: { [TODAY]: "A" } },
      remarks: {},
      summary: {},
    };
    renderSF2();
    await waitFor(() => expect(screen.getByText(/DELGADO, RAMON/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Mark Everyone Present/i }));
    expect(screen.getByText(/currently marked Absent\/Tardy for this date/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Yes, Mark Everyone Present/i }));
    const row = screen.getByText(/DELGADO, RAMON/).closest("li");
    await waitFor(() =>
      expect(within(row).getByRole("button", { name: "Present" }).getAttribute("aria-pressed")).toBe("true")
    );
  });

  it("warns before leaving with unsaved changes, and discards on Leave Without Saving", async () => {
    renderSF2();
    await waitFor(() => expect(screen.getByText(/DELGADO, RAMON/)).toBeTruthy());
    const row = screen.getByText(/DELGADO, RAMON/).closest("li");
    fireEvent.click(within(row).getByRole("button", { name: "Absent" }));

    fireEvent.click(screen.getByRole("button", { name: /Next Day/i }));
    expect(screen.getByText("You have attendance changes that have not been saved.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Leave Without Saving/i }));
    await waitFor(() => expect(screen.queryByText(/have not been saved/i)).toBeNull());
    // The unsaved Absent mark was discarded -- back on Today, learner reads Present.
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    const freshRow = await screen.findByText(/DELGADO, RAMON/);
    expect(within(freshRow.closest("li")).getByRole("button", { name: "Present" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("Remarks pop-up writes the exact stored string for Transferred Out", async () => {
    renderSF2();
    await waitFor(() => expect(screen.getByText(/DELGADO, RAMON/)).toBeTruthy());
    const row = screen.getByText(/DELGADO, RAMON/).closest("li");
    fireEvent.click(within(row).getByRole("button", { name: "Remarks" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Transferred Out"));
    fireEvent.click(within(dialog).getByRole("button", { name: /Save Remarks/i }));

    await waitFor(() => expect(within(row).getByRole("button", { name: "Transferred Out" })).toBeTruthy());
  });
});

describe("SF2 — Monthly SF2 and Year Overview", () => {
  beforeEach(() => {
    collectionFixtures.learners = [
      { id: "delgado", lastName: "DELGADO", firstName: "RAMON", sex: "M", gradeLevel: "Grade 7", section: "FAITH" },
      { id: "santiago", lastName: "SANTIAGO", firstName: "MARIA", sex: "F", gradeLevel: "Grade 7", section: "FAITH" },
    ];
    collectionFixtures.attendance = [];
    docFixtures.attendance = {};
    docFixtures.lardoRecords = {};
    savedDocs.length = 0;
    vi.mocked(useTeacherScope).mockReturnValue(adviserScopeFixture());
  });
  afterEach(() => cleanup());

  it("shows the official ABSENT and PRESENT columns, Male before Female", async () => {
    renderSF2();
    await waitFor(() => expect(screen.getByText(/Male Learners/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Monthly SF2" }));

    await waitFor(() => expect(screen.getByText("School Form 2 (SF2) Daily Attendance Report of Learners")).toBeTruthy());
    expect(screen.getByText("ABSENT")).toBeTruthy();
    expect(screen.getByText("PRESENT")).toBeTruthy();
    const names = screen.getAllByText(/DELGADO, RAMON|SANTIAGO, MARIA/).map((n) => n.textContent);
    expect(names.indexOf("DELGADO, RAMON")).toBeLessThan(names.indexOf("SANTIAGO, MARIA"));
  });

  it("Year Overview shows an empty state with no saved attendance yet", async () => {
    renderSF2();
    await waitFor(() => expect(screen.getByText(/Male Learners/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Year Overview" }));
    await waitFor(() =>
      expect(screen.getByText(/No saved attendance found yet for this class this school year/i)).toBeTruthy()
    );
  });
});

describe("SF2 — authorization", () => {
  afterEach(() => cleanup());

  it("fails closed when the account has no advisory assignment", async () => {
    collectionFixtures.learners = [];
    vi.mocked(useTeacherScope).mockReturnValue(adviserScopeFixture({ adviser: null }));
    renderSF2();
    await waitFor(() =>
      expect(screen.getByText(/No advisory class is assigned to your account/i)).toBeTruthy()
    );
  });
});
