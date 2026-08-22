// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import ClassRecord from "../ClassRecord.jsx";
import useTeacherScope from "../hooks/useTeacherScope.js";
import useSchoolConfig from "../hooks/useSchoolConfig.js";
import { getDoc, getDocs, setDoc } from "firebase/firestore";
import { buildClassRecordId } from "../utils/classRecordId.js";

const { firestoreFixtures, firestoreDocFixtures, setDocCalls } = vi.hoisted(() => ({
  firestoreFixtures: {},
  firestoreDocFixtures: {},
  setDocCalls: [],
}));

vi.mock("../firebase.js", () => ({ db: {} }));

vi.mock("../hooks/useTeacherScope.js", () => ({ default: vi.fn() }));

vi.mock("../hooks/useSchoolConfig.js", () => ({ default: vi.fn() }));

vi.mock("../hooks/useAcademicCalendar.js", () => ({
  default: () => ({ calendar: {}, schoolYears: ["2026-2027"], loading: false }),
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

// Matches the Core-weighted (20/50/30) fixture shape used by
// gradeComputations.test.js / consolidatedGrades.test.js: this scoring
// yields an Initial Grade of 90 (passing) for learner l1.
function passingRecord(overrides = {}) {
  return {
    wwItems: [{ id: "ww1", hps: 10 }],
    ptItems: [{ id: "pt1", hps: 20 }],
    exHPS: { st1: 10, st2: 10, te: 20 },
    scores: {
      l1: { ww: { ww1: 9 }, pt: { pt1: 18 }, st1: 9, st2: 9, te: 18 },
    },
    tleMajor: "",
    ...overrides,
  };
}

// Same shape, scored at 50% everywhere -> Initial Grade 50, well below the
// DO 15 s.2026 70-point intervention threshold.
function failingRecord(overrides = {}) {
  return {
    wwItems: [{ id: "ww1", hps: 10 }],
    ptItems: [{ id: "pt1", hps: 20 }],
    exHPS: { st1: 10, st2: 10, te: 20 },
    scores: {
      l1: { ww: { ww1: 5 }, pt: { pt1: 10 }, st1: 5, st2: 5, te: 10 },
    },
    tleMajor: "",
    ...overrides,
  };
}

function soleLearner(overrides = {}) {
  return {
    id: "l1",
    lastName: "Dela Cruz",
    firstName: "Juan",
    gradeLevel: "Grade 7",
    section: "Love",
    sex: "Male",
    lrn: "123456789012",
    ...overrides,
  };
}

function teacherScopeFixture(overrides = {}) {
  return { classRecordCombos: [], loading: false, ...overrides };
}

function renderClassRecord({ initialSelection } = {}) {
  return render(
    React.createElement(ClassRecord, {
      user: { uid: "u1", email: "teacher@tingub.edu.ph" },
      initialSelection,
    })
  );
}

describe("ClassRecord (tabbed workspace)", () => {
  beforeEach(() => {
    Object.keys(firestoreFixtures).forEach((k) => delete firestoreFixtures[k]);
    Object.keys(firestoreDocFixtures).forEach((k) => delete firestoreDocFixtures[k]);
    setDocCalls.length = 0;
    vi.mocked(getDocs).mockClear();
    vi.mocked(getDoc).mockClear();
    vi.mocked(setDoc).mockClear();
    vi.mocked(useTeacherScope).mockReturnValue(teacherScopeFixture());
    vi.mocked(useSchoolConfig).mockReturnValue({
      config: { tleMajors: [], shs: { subjects: [], electiveClusters: [] } },
      loading: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("fails closed with the existing message and makes no Firestore calls when the selection doesn't match an assignment", async () => {
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Science", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "Mathematics", section: "Love" } });

    expect(await screen.findByText("You are not assigned to this class record.")).toBeTruthy();
    expect(getDocs).not.toHaveBeenCalled();
    expect(getDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("loads the roster and record for a valid assignment, defaulting to Written Works, and switches tabs", async () => {
    const docId = buildClassRecordId({
      gradeLevel: "Grade 7",
      section: "Love",
      subject: "Mathematics",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${docId}`] = passingRecord();
    firestoreFixtures.learners = [soleLearner()];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Mathematics", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "Mathematics", section: "Love" } });

    expect(await screen.findByText("Written Works — 20%")).toBeTruthy();
    expect(screen.getByLabelText("Dela Cruz, Juan — WW1")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    expect(screen.getByText("Term 1 Results")).toBeTruthy();
  });

  it("starts a brand-new (never-saved) class record with 3 Written Works and 3 Performance Task columns", async () => {
    // No firestoreDocFixtures entry for this docId -- getDoc resolves to a
    // non-existent snapshot, exercising the "no record yet" default path.
    firestoreFixtures.learners = [soleLearner()];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Mathematics", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "Mathematics", section: "Love" } });
    await screen.findByText("Written Works — 20%");

    expect(screen.getByLabelText("Dela Cruz, Juan — WW1")).toBeTruthy();
    expect(screen.getByLabelText("Dela Cruz, Juan — WW2")).toBeTruthy();
    expect(screen.getByLabelText("Dela Cruz, Juan — WW3")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Performance Tasks" }));
    expect(screen.getByLabelText("Dela Cruz, Juan — PT1")).toBeTruthy();
    expect(screen.getByLabelText("Dela Cruz, Juan — PT2")).toBeTruthy();
    expect(screen.getByLabelText("Dela Cruz, Juan — PT3")).toBeTruthy();
  });

  it("rejects a score above the item's HPS without applying it, and Undo restores the previous value", async () => {
    const docId = buildClassRecordId({
      gradeLevel: "Grade 7",
      section: "Love",
      subject: "Mathematics",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${docId}`] = {
      wwItems: [{ id: "ww1", hps: 10 }],
      ptItems: [{ id: "pt1", hps: 20 }],
      exHPS: { st1: 10, st2: 10, te: 20 },
      scores: {},
      tleMajor: "",
    };
    firestoreFixtures.learners = [soleLearner()];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Mathematics", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "Mathematics", section: "Love" } });
    await screen.findByText("Written Works — 20%");

    const input = screen.getByLabelText("Dela Cruz, Juan — WW1");

    fireEvent.change(input, { target: { value: "15" } });
    expect(screen.getByText("Score cannot be higher than the Highest Possible Score of 10.")).toBeTruthy();
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { value: "8" } });
    expect(input.value).toBe("8");

    expect(screen.getByRole("button", { name: "Redo" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(input.value).toBe("");

    // Redo restores what Undo just reverted...
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(input.value).toBe("8");
    expect(screen.getByRole("button", { name: "Redo" }).disabled).toBe(true);

    // ...but a new edit after Undo clears Redo instead of leaving it valid,
    // since the timeline has branched.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.change(input, { target: { value: "6" } });
    expect(screen.getByRole("button", { name: "Redo" }).disabled).toBe(true);
  });

  it("prompts confirm only when removing an assessment that already has learner scores", async () => {
    const docId = buildClassRecordId({
      gradeLevel: "Grade 7",
      section: "Love",
      subject: "Mathematics",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${docId}`] = {
      wwItems: [
        { id: "ww1", hps: 10 },
        { id: "ww2", hps: 10 },
        { id: "ww3", hps: 10 },
      ],
      ptItems: [{ id: "pt1", hps: 20 }],
      exHPS: { st1: 10, st2: 10, te: 20 },
      scores: { l1: { ww: { ww1: 8 } } },
      tleMajor: "",
    };
    firestoreFixtures.learners = [soleLearner()];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Mathematics", section: "Love", terms: null }],
      })
    );
    const confirmSpy = vi.spyOn(window, "confirm");

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "Mathematics", section: "Love" } });
    await screen.findByText("Written Works — 20%");

    // WW3 has no scores -- removed immediately, no confirm prompt.
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[2]);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Dela Cruz, Juan — WW3")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);

    // WW1 has a score -- prompts; cancelling leaves it intact.
    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/WW1/);
    expect(screen.getByLabelText("Dela Cruz, Juan — WW1")).toBeTruthy();

    // Confirming removes it. (The one remaining item, formerly WW2, now
    // renders as "WW1" since ScoreEntryTable labels items by position, not
    // by item id -- so only the button count is asserted here, not a label.)
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("autosaves the classRecords doc after the debounce window without ever touching lardoRecords", async () => {
    const docId = buildClassRecordId({
      gradeLevel: "Grade 7",
      section: "Love",
      subject: "Mathematics",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${docId}`] = passingRecord();
    firestoreFixtures.learners = [soleLearner()];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Mathematics", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "Mathematics", section: "Love" } });
    await screen.findByText("Written Works — 20%");

    vi.useFakeTimers();
    const input = screen.getByLabelText("Dela Cruz, Juan — WW1");
    fireEvent.change(input, { target: { value: "7" } });

    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    expect(setDocCalls.length).toBe(0);

    await vi.advanceTimersByTimeAsync(3000);
    vi.useRealTimers();

    await waitFor(() => expect(setDocCalls.some((c) => c.ref.name === "classRecords")).toBe(true));
    expect(setDocCalls.some((c) => c.ref.name === "lardoRecords")).toBe(false);
  });

  it("Save Class Record persists the record and runs the LARDO check, offering to flag a failing learner", async () => {
    const docId = buildClassRecordId({
      gradeLevel: "Grade 7",
      section: "Love",
      subject: "Science",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${docId}`] = failingRecord();
    firestoreFixtures.learners = [soleLearner()];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Science", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "Science", section: "Love" } });
    await screen.findByText("Written Works — 20%");

    fireEvent.click(screen.getByRole("button", { name: "Save Class Record" }));

    await waitFor(() => expect(setDocCalls.some((c) => c.ref.name === "classRecords")).toBe(true));
    expect(await screen.findByText(/LARDO risk flag/)).toBeTruthy();

    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(setDocCalls.some((c) => c.ref.name === "lardoRecords")).toBe(true));
    const lardoCall = setDocCalls.find((c) => c.ref.name === "lardoRecords");
    expect(lardoCall.data.learnerLRN).toBe("123456789012");
  });

  it("shows the TLE Major dropdown only for a Grade 9/10 TLE assignment with configured majors", async () => {
    vi.mocked(useSchoolConfig).mockReturnValue({
      config: { tleMajors: ["ICT", "Cookery"], shs: { subjects: [], electiveClusters: [] } },
      loading: false,
    });
    const docId = buildClassRecordId({
      gradeLevel: "Grade 9",
      section: "Love",
      subject: "TLE",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${docId}`] = {
      wwItems: [{ id: "ww1", hps: 10 }],
      ptItems: [{ id: "pt1", hps: 20 }],
      exHPS: { st1: 10, st2: 10, te: 20 },
      scores: {},
      tleMajor: "",
    };
    firestoreFixtures.learners = [soleLearner({ gradeLevel: "Grade 9" })];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 9", subject: "TLE", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 9", subject: "TLE", section: "Love" } });
    await screen.findByText("Written Works — 20%");

    expect(screen.getByLabelText("TLE Major (this term)")).toBeTruthy();
  });

  it("hides the TLE Major dropdown for Grade 7 TLE and for Grade 9 Math", async () => {
    vi.mocked(useSchoolConfig).mockReturnValue({
      config: { tleMajors: ["ICT", "Cookery"], shs: { subjects: [], electiveClusters: [] } },
      loading: false,
    });

    const gradeSevenTleDocId = buildClassRecordId({
      gradeLevel: "Grade 7",
      section: "Love",
      subject: "TLE",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${gradeSevenTleDocId}`] = {
      wwItems: [{ id: "ww1", hps: 10 }],
      ptItems: [{ id: "pt1", hps: 20 }],
      exHPS: { st1: 10, st2: 10, te: 20 },
      scores: {},
      tleMajor: "",
    };
    firestoreFixtures.learners = [soleLearner()];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "TLE", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "TLE", section: "Love" } });
    await screen.findByText("Written Works — 20%");
    expect(screen.queryByLabelText("TLE Major (this term)")).toBeNull();
    cleanup();

    const gradeNineMathDocId = buildClassRecordId({
      gradeLevel: "Grade 9",
      section: "Love",
      subject: "Mathematics",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${gradeNineMathDocId}`] = passingRecord();
    firestoreFixtures.learners = [soleLearner({ gradeLevel: "Grade 9" })];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 9", subject: "Mathematics", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 9", subject: "Mathematics", section: "Love" } });
    await screen.findByText("Written Works — 20%");
    expect(screen.queryByLabelText("TLE Major (this term)")).toBeNull();
  });

  it("shows the weight-fallback banner only when the subject's weights can't be resolved", async () => {
    const unknownDocId = buildClassRecordId({
      gradeLevel: "Grade 7",
      section: "Love",
      subject: "Made Up Subject",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${unknownDocId}`] = {
      wwItems: [{ id: "ww1", hps: 10 }],
      ptItems: [{ id: "pt1", hps: 20 }],
      exHPS: { st1: 10, st2: 10, te: 20 },
      scores: {},
      tleMajor: "",
    };
    firestoreFixtures.learners = [soleLearner()];
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Made Up Subject", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "Made Up Subject", section: "Love" } });

    expect(await screen.findByText(/could not be determined automatically/)).toBeTruthy();
    // Still functions, falling back to the Core (20/50/30) weighting.
    expect(screen.getByText("Written Works — 20%")).toBeTruthy();
    cleanup();

    const mathDocId = buildClassRecordId({
      gradeLevel: "Grade 7",
      section: "Love",
      subject: "Mathematics",
      term: "Term 1",
      schoolYear: "2026-2027",
    });
    firestoreDocFixtures[`classRecords/${mathDocId}`] = passingRecord();
    vi.mocked(useTeacherScope).mockReturnValue(
      teacherScopeFixture({
        classRecordCombos: [{ gradeLevel: "Grade 7", subject: "Mathematics", section: "Love", terms: null }],
      })
    );

    renderClassRecord({ initialSelection: { gradeLevel: "Grade 7", subject: "Mathematics", section: "Love" } });
    await screen.findByText("Written Works — 20%");
    expect(screen.queryByText(/could not be determined automatically/)).toBeNull();
  });
});
