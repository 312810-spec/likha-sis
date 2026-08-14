// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import useAvailableSections from "../useAvailableSections.js";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => mocks);
vi.mock("../../firebase", () => ({ db: {} }));

function makeSnapshot(sectionValues) {
  const docs = sectionValues.map((section, i) => ({
    id: `doc${i}`,
    data: () => ({ section }),
  }));
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
    mocks.query.mockImplementation((ref, ...constraints) => ({
      kind: "query",
      ref,
      constraints,
    }));
    mocks.where.mockImplementation((field, op, value) => ({ field, op, value }));
  });

  it("returns distinct sorted sections for the given grade and year", async () => {
    mocks.getDocs.mockResolvedValueOnce(
      makeSnapshot(["Section 2", "Section 1", "Section 1"])
    );

    const { result } = renderHook(() => useAvailableSections("Grade 4", "2026-2027"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sections).toEqual(["Section 1", "Section 2"]);
    expect(mocks.where).toHaveBeenCalledWith("gradeLevel", "==", "Grade 4");
    expect(mocks.where).toHaveBeenCalledWith("schoolYear", "==", "2026-2027");
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
      makeSnapshot(["", "   ", "Section 1", "  Section 1  ", "Section 2"])
    );

    const { result } = renderHook(() => useAvailableSections("Grade 5", "2026-2027"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sections).toEqual(["Section 1", "Section 2"]);
  });
});