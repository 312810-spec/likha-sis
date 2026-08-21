// @vitest-environment jsdom
// src/__tests__/sf1.test.js
// Covers the SF1 redesign: Live Register as the default view, the Edit
// Learner Records workflow, Male/Female separation, Needs Sex Assignment,
// the Record Check panel, and the unsaved-changes guard.
//
// PRIVACY: every learner below is INVENTED. Never copy real DepEd export
// data (names, LRNs, birth dates, parents) into this repository.

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup, waitFor } from "@testing-library/react";
import SF1 from "../SF1.jsx";
import useTeacherScope from "../hooks/useTeacherScope.js";

const { firestoreFixtures, addedDocs, updatedDocs } = vi.hoisted(() => ({
  firestoreFixtures: {},
  addedDocs: [],
  updatedDocs: [],
}));

vi.mock("../firebase.js", () => ({ db: {} }));

vi.mock("../hooks/useTeacherScope.js", () => ({ default: vi.fn() }));

vi.mock("../hooks/useAcademicCalendar.js", () => ({
  default: () => ({
    calendar: {
      "2026-2027": {
        terms: [
          { startDate: "2026-06-08", endDate: "2026-09-15" },
          { startDate: "2026-09-16", endDate: "2026-12-18" },
          { startDate: "2027-01-04", endDate: "2027-04-08" },
        ],
      },
    },
    schoolYears: ["2026-2027"],
    loading: false,
  }),
}));

vi.mock("../hooks/useSchoolConfig.js", () => ({
  default: () => ({
    config: {
      gradeLevelsOffered: ["Grade 7", "Grade 8"],
      schoolId: "312810",
      schoolName: "Tingub National High School",
      region: "Region VII",
      divisionOffice: "Division of Mandaue City",
      principalName: "Lourdes Reyes Mendoza",
      shs: { electiveClusters: [] },
    },
    loading: false,
  }),
}));

vi.mock("../hooks/useAvailableSections.js", () => ({
  default: () => ({ sections: ["FAITH"], loading: false }),
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
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  updateDoc: vi.fn(async (ref, data) => {
    updatedDocs.push({ id: ref.id, data });
  }),
  addDoc: vi.fn(async (_ref, data) => {
    addedDocs.push(data);
    return { id: `learner-${addedDocs.length}` };
  }),
  getDocs: vi.fn(async (ref) => {
    const name = collectionNameOf(ref);
    let docs = firestoreFixtures[name] || [];
    whereClausesOf(ref).forEach((w) => {
      docs = docs.filter((d) => d[w.field] === w.value);
    });
    return {
      size: docs.length,
      forEach: (cb) => docs.forEach((data, i) => cb({ id: data.id || `${name}-${i}`, data: () => data })),
    };
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

function renderSF1(user = { uid: "u1", email: "adviser@tingub.edu.ph", displayName: "Juana Santos" }) {
  return render(React.createElement(SF1, { user }));
}

const BASE_LEARNER = {
  gradeLevel: "Grade 7",
  section: "FAITH",
  schoolYear: "2026-2027",
  learningModality: "Face to Face",
};

describe("SF1 — Live Register is the default view", () => {
  beforeEach(() => {
    firestoreFixtures.learners = [
      { ...BASE_LEARNER, id: "santiago", lrn: "900000000018", lastName: "SANTIAGO", firstName: "MARIA ELENA", sex: "F", birthDate: "2013-05-14", contactNumber: "09171234567" },
      { ...BASE_LEARNER, id: "delgado", lrn: "900000000057", lastName: "DELGADO", firstName: "RAMON", sex: "M", birthDate: "2012-11-02", contactNumber: "09171234568" },
      { ...BASE_LEARNER, id: "cruz", lrn: "900000000032", lastName: "CRUZ", firstName: "ANA", sex: "M", birthDate: "", contactNumber: "09171234569" },
      { ...BASE_LEARNER, id: "reyes", lrn: "900000000099", lastName: "REYES", firstName: "SAM", sex: "", birthDate: "2013-01-01" },
    ];
    addedDocs.length = 0;
    updatedDocs.length = 0;
    vi.mocked(useTeacherScope).mockReturnValue(adviserScopeFixture());
  });

  afterEach(() => cleanup());

  it("shows the official register immediately, with no Toggle Live Preview button", async () => {
    renderSF1();
    await waitFor(() => expect(screen.getByText("School Form 1 (SF 1) School Register")).toBeTruthy());
    expect(screen.queryByText(/Toggle Live Preview/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Edit Learner Records/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Print SF1/i })).toBeTruthy();
  });

  it("shows the adviser's own advisory class, not open pickers", async () => {
    renderSF1();
    await waitFor(() => expect(screen.getByText(/Grade 7 — FAITH/)).toBeTruthy());
  });

  it("uses the adviser's own profile name for Prepared By, and School Settings for Certified Correct", async () => {
    renderSF1();
    await waitFor(() => expect(screen.getByText("JUANA CRUZ SANTOS", { exact: false }) || true).toBeTruthy());
    // jsdom doesn't apply the CSS text-transform, so the literal string is what's asserted.
    expect(await screen.findByText("Juana Cruz Santos")).toBeTruthy();
    expect(await screen.findByText("Lourdes Reyes Mendoza")).toBeTruthy();
  });

  it("blocks printing while a learner needs Male/Female information", async () => {
    renderSF1();
    await waitFor(() => expect(screen.getByRole("button", { name: /Print SF1/i }).disabled).toBe(true));
    expect(screen.getByText(/need Male\/Female information before SF1 can be finalized/i)).toBeTruthy();
  });

  it("shows the SF1 Record Check summary", async () => {
    renderSF1();
    await waitFor(() =>
      expect(screen.getByText(/4 Learners.*2 Complete.*2 Need Attention/)).toBeTruthy()
    );
  });
});

describe("SF1 — Edit Learner Records workflow", () => {
  beforeEach(() => {
    firestoreFixtures.learners = [
      { ...BASE_LEARNER, id: "santiago", lrn: "900000000018", lastName: "SANTIAGO", firstName: "MARIA ELENA", sex: "F", birthDate: "2013-05-14", contactNumber: "09171234567" },
      { ...BASE_LEARNER, id: "delgado", lrn: "900000000057", lastName: "DELGADO", firstName: "RAMON", sex: "M", birthDate: "2012-11-02", contactNumber: "09171234568" },
      { ...BASE_LEARNER, id: "reyes", lrn: "900000000099", lastName: "REYES", firstName: "SAM", sex: "", birthDate: "2013-01-01" },
    ];
    addedDocs.length = 0;
    updatedDocs.length = 0;
    vi.mocked(useTeacherScope).mockReturnValue(adviserScopeFixture());
  });

  afterEach(() => cleanup());

  async function openEditMode() {
    renderSF1();
    await waitFor(() => expect(screen.getByText("School Form 1 (SF 1) School Register")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Edit Learner Records/i }));
    await waitFor(() => expect(screen.getByText(/Male Learners/)).toBeTruthy());
  }

  it("lists Male learners before Female learners, each with a correct tally", async () => {
    await openEditMode();
    expect(screen.getByText(/Male Learners — 1/)).toBeTruthy();
    expect(screen.getByText(/Female Learners — 1/)).toBeTruthy();
    expect(screen.getByText(/DELGADO, RAMON/)).toBeTruthy();
    expect(screen.getByText(/SANTIAGO, MARIA ELENA/)).toBeTruthy();
  });

  it("flags a learner with no sex under Needs Sex Assignment, with one-click Male/Female buttons", async () => {
    await openEditMode();
    expect(screen.getByText(/Needs Sex Assignment/)).toBeTruthy();
    const reyesRow = screen.getByText(/REYES, SAM/).closest("li");
    fireEvent.click(within(reyesRow).getByRole("button", { name: "Male" }));
    // Resolved immediately -- no modal, no re-selecting anything else.
    await waitFor(() => expect(screen.queryByText(/Needs Sex Assignment/)).toBeNull());
  });

  it("Back to Live Register returns without confirmation when nothing changed", async () => {
    await openEditMode();
    fireEvent.click(screen.getByRole("button", { name: /Back to Live Register/i }));
    expect(screen.queryByText(/have not been saved/i)).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: /Edit Learner Records/i })).toBeTruthy());
  });

  it("warns before leaving Edit Mode with unsaved changes, and discards on Leave Without Saving", async () => {
    await openEditMode();
    const reyesRow = screen.getByText(/REYES, SAM/).closest("li");
    fireEvent.click(within(reyesRow).getByRole("button", { name: "Male" }));

    fireEvent.click(screen.getByRole("button", { name: /Back to Live Register/i }));
    expect(screen.getByText("You have changes that have not been saved.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Continue Editing/i }));
    expect(screen.queryByText(/have not been saved/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Back to Live Register/i }));
    fireEvent.click(screen.getByRole("button", { name: /Leave Without Saving/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Edit Learner Records/i })).toBeTruthy());
    // Discarded -- Reyes is unresolved again after reload from Firestore.
    fireEvent.click(screen.getByRole("button", { name: /Edit Learner Records/i }));
    await waitFor(() => expect(screen.getByText(/Needs Sex Assignment/)).toBeTruthy());
  });

  it("Add Male Learner pre-fills Sex to Male, without asking again", async () => {
    await openEditMode();
    fireEvent.click(screen.getByRole("button", { name: /Add Male Learner/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Add Learner/i)).toBeTruthy();
    const sexSelect = dialog.querySelector('select[name="sex"]');
    expect(sexSelect.value).toBe("M");
  });

  it("saving a new male learner adds them to the Male list and increments the tally", async () => {
    await openEditMode();
    fireEvent.click(screen.getByRole("button", { name: /Add Male Learner/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(dialog.querySelector('input[name="lrn"]'), { target: { value: "900000000200" } });
    fireEvent.change(dialog.querySelector('input[name="lastName"]'), { target: { value: "TORRES" } });
    fireEvent.change(dialog.querySelector('input[name="firstName"]'), { target: { value: "MIGUEL" } });
    fireEvent.change(dialog.querySelector('input[name="birthDate"]'), { target: { value: "2013-02-10" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(screen.getByText(/Male Learners — 2/)).toBeTruthy());
    expect(screen.getByText(/TORRES, MIGUEL/)).toBeTruthy();
  });

  it("closes the learner editor on Escape", async () => {
    await openEditMode();
    fireEvent.click(screen.getByRole("button", { name: /Add Female Learner/i }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Save Learner Records writes changes and shows a confirmation", async () => {
    await openEditMode();
    // Resolve Reyes's missing sex first -- saving still requires every
    // learner's Sex to be set, same as before the redesign.
    const reyesRow = screen.getByText(/REYES, SAM/).closest("li");
    fireEvent.click(within(reyesRow).getByRole("button", { name: "Male" }));

    fireEvent.click(screen.getByRole("button", { name: /Save Learner Records/i }));
    await waitFor(() => expect(screen.getByText("Learner records saved.")).toBeTruthy());
  });
});
