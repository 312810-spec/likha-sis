// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import useAvailableSections from "../useAvailableSections.js";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => mocks);
vi.mock("../../firebase", () => ({ db: {} }));

// Build a snapshot of learner docs. A plain string entry is shorthand for a
// learner in the given grade/school-year whose only relevant field is a section.
// An object entry is a full learner doc (used to model other grade levels or
// school years, as produced by an SF1 bulk import).
function makeSnapshot(learners, { gradeLevel = "Grade 4", schoolYear = "2026-2027" } = {}) {
  const docs = learners.map((entry, i) => {
    const doc =
      typeof entry === "string" ? { gradeLevel, schoolYear, section: entry } : entry;
    return {
      id: `doc${i}`,
      data: () => doc,
    };
  });
  return {
    docs,
    forEach(callback) {
      docs.forEach(callback);
    },
  };
}

describe("useAvailableSections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collection.mockImplementation(() => ({ ref: "learners" }));
  });

  it("derives distinct sorted sections for the given grade and year, filtering client-side", async () => {
    mocks.getDocs.mockResolvedValueOnce(
      makeSnapshot(["Section 2", "Section 1", "Section 1"])
    );

    const { result } = renderHook(() => useAvailableSections("Grade 4", "2026-2027"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sections).toEqual(["Section 1", "Section 2"]);
    // Reads the whole learners collection once — no compound `where` query.
    expect(mocks.collection).toHaveBeenCalledTimes(1);
    expect(mocks.getDocs).toHaveBeenCalledTimes(1);
  });

  it("reflects a section that was just created by an SF1 bulk import for the matching class", async () => {
    // These are the learner docs an SF1 import writes to Firestore: each carries
    // the section plus the workbook-derived grade level and school year.
    mocks.getDocs.mockResolvedValueOnce(
      makeSnapshot([
        { gradeLevel: "Grade 10", schoolYear: "2026-2027", section: "Rizal" },
        // A different grade is filtered OUT even though it uses the same name.
        { gradeLevel: "Grade 7", schoolYear: "2026-2027", section: "Malayang" },
        // A different school year is filtered OUT too.
        { gradeLevel: "Grade 10", schoolYear: "2025-2026", section: "Bonifacio" },
      ])
    );

    const { result } = renderHook(() => useAvailableSections("Grade 10", "2026-2027"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Only the Grade 10 / 2026-2027 class is surfaced.
    expect(result.current.sections).toEqual(["Rizal"]);
  });

  it("returns an empty array without querying when gradeLevel is missing", () => {
    const { result } = renderHook(() => useAvailableSections("", "2026-2027"));
    expect(result.current.sections).toEqual([]);
    expect(mocks.getDocs).not.toHaveBeenCalled();
  });

  it("returns an empty array without querying when schoolYear is missing", () => {
    const { result } = renderHook(() => useAvailableSections("Grade 4", ""));
    expect(result.current.sections).toEqual([]);
    expect(mocks.getDocs).not.toHaveBeenCalled();
  });

  it("ignores empty and blank section values", async () => {
    mocks.getDocs.mockResolvedValueOnce(
      makeSnapshot(["", "   ", "Section 1", "  Section 1  ", "Section 2"], {
        gradeLevel: "Grade 5",
      })
    );

    const { result } = renderHook(() => useAvailableSections("Grade 5", "2026-2027"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sections).toEqual(["Section 1", "Section 2"]);
  });
});