// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import Dashboard from "../Dashboard.jsx";
import { getDocs } from "firebase/firestore";

vi.mock("../firebase.js", () => ({
  auth: {},
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ kind: "collection" })),
  getDocs: vi.fn(),
  query: vi.fn((...args) => ({ kind: "query", args })),
  where: vi.fn((...args) => ({ kind: "where", args })),
}));

vi.mock("../hooks/useAcademicCalendar.js", () => ({
  default: () => ({
    calendar: {},
    schoolYears: ["2026-2027", "2025-2026"],
    loading: false,
  }),
}));

function learnerSnapshot(docs) {
  return {
    docs: docs.map((data, i) => ({
      id: `learner-${i}`,
      data: () => data,
    })),
  };
}

function renderDashboard() {
  return render(
    React.createElement(Dashboard, {
      goToSF1: vi.fn(),
      goToSF2: vi.fn(),
      goToViewLearners: vi.fn(),
      goToLardo: vi.fn(),
      userRoles: [],
    })
  );
}

describe("Dashboard live stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders live stats from the learners and attendance collections", async () => {
    vi.mocked(getDocs)
      .mockResolvedValueOnce(
        learnerSnapshot([
          {
            firstName: "Juan",
            lastName: "Dela Cruz",
            gradeLevel: "Grade 7",
            section: "Amancio",
            schoolYear: "2026-2027",
            createdAt: { seconds: 1700000000 },
          },
          {
            firstName: "Maria",
            lastName: "Santos",
            gradeLevel: "Grade 7",
            section: "Amancio",
            schoolYear: "2026-2027",
            createdAt: { seconds: 1700000300 },
          },
          {
            firstName: "Pedro",
            lastName: "Reyes",
            gradeLevel: "Grade 8",
            section: "Kalayaan",
            schoolYear: "2026-2027",
            enrollmentStatus: "transferred-out",
            createdAt: { seconds: 1680000000 },
          },
        ])
      )
      .mockResolvedValueOnce({ size: 4 });

    renderDashboard();

    // Total Learners tile shows the full learner count.
    await waitFor(() => {
      const totalTile = screen.getByText("Total Learners").closest(".flex-1");
      expect(totalTile.textContent).toContain("3");
    });

    // Enrollment counts only active learners (missing status defaults to active).
    expect(screen.getByText("2 active")).toBeTruthy();
    // School Forms tile combines SF1 learner count and SF2 attendance sheets.
    expect(screen.getByText("SF1 3 · SF2 4")).toBeTruthy();
    // Current school year comes from the academic calendar hook.
    expect(screen.getByText("2026-2027")).toBeTruthy();

    // Overview summary tiles.
    expect(screen.getByText("3 learners · 2 grade levels")).toBeTruthy();
    expect(screen.getByText("2 active · 1 transferred out")).toBeTruthy();

    // Recent activity is derived from the newest learner additions.
    expect(screen.getByText("Added Santos, Maria")).toBeTruthy();
    expect(screen.getByText("Added Dela Cruz, Juan")).toBeTruthy();
    expect(screen.getByText("Added Reyes, Pedro")).toBeTruthy();

    // The old placeholder strings are gone.
    expect(screen.queryByText("No data available yet.")).toBeNull();
    expect(screen.queryByText("Recent events will appear here.")).toBeNull();
  });

  it("renders styled empty states when the collections have no data", async () => {
    vi.mocked(getDocs)
      .mockResolvedValueOnce(learnerSnapshot([]))
      .mockResolvedValueOnce({ size: 0 });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("No learners yet.")).toBeTruthy();
    });
    expect(screen.getByText("No enrollment yet.")).toBeTruthy();
    expect(screen.getByText("No forms yet.")).toBeTruthy();
    expect(screen.getByText("2026-2027")).toBeTruthy();

    expect(screen.getByText("0 learners · 0 grade levels")).toBeTruthy();
    expect(screen.getByText("0 active · 0 transferred out")).toBeTruthy();

    expect(
      screen.getByText("No recent activity yet. Add or import learners to see entries here.")
    ).toBeTruthy();
  });

  it("renders styled empty states when the stats query fails", async () => {
    vi.mocked(getDocs)
      .mockRejectedValueOnce(new Error("learners query failed"))
      .mockRejectedValueOnce(new Error("attendance query failed"));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByText("Stats unavailable").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("No forms yet.")).toBeTruthy();
    expect(screen.getByText("Recent activity is unavailable right now.")).toBeTruthy();
  });
});