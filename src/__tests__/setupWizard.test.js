// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import SetupWizard from "../SetupWizard.jsx";

// Mock Firebase Auth & Firestore
vi.mock("../firebase.js", () => ({
  auth: { currentUser: { uid: "test-uid-123", email: "ict@school.edu" } },
  db: {},
}));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(() =>
    Promise.resolve({
      user: { uid: "test-uid-123", email: "ict@school.edu" },
    })
  ),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, ...path) => ({ path: path.join("/") })),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => "MOCK_TIMESTAMP"),
}));

vi.mock("../hooks/useSchoolConfig.js", () => ({
  default: () => ({
    config: {
      schoolName: "Test High School",
      principalName: "Principal Test",
      gradeLevelsOffered: ["Grade 7", "Grade 8"],
    },
    loading: false,
  }),
}));

vi.mock("../pages/SF1Importer.jsx", () => ({
  default: () => React.createElement("div", { "data-testid": "sf1-importer-component" }, "SF1 Importer Component"),
}));

vi.mock("../pages/SF10Importer.jsx", () => ({
  default: () => React.createElement("div", { "data-testid": "sf10-importer-component" }, "SF10 Importer Component"),
}));

describe("SetupWizard 4-step flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Step 1 of 4 with initial school details", () => {
    render(React.createElement(SetupWizard));
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(screen.getByText("LIKHA-SIS Setup")).toBeTruthy();
    expect(screen.getByDisplayValue("Test High School")).toBeTruthy();
    expect(screen.getByDisplayValue("Principal Test")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });

  it("advances from Step 1 to Step 2 when validation passes", async () => {
    render(React.createElement(SetupWizard));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(screen.getByText("Step 2 of 4")).toBeTruthy();
    });
    expect(screen.getByText(/ICT Coordinator access/i)).toBeTruthy();
  });

  it("validates Step 2 and advances to Step 3 upon account creation", async () => {
    const { setDoc } = await import("firebase/firestore");
    const { container } = render(React.createElement(SetupWizard));

    // Advance to step 2
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.getByText("Step 2 of 4")).toBeTruthy();
    });

    // Fill in Step 2 fields
    const textInputs = container.querySelectorAll("input:not([type='password']):not([type='checkbox'])");
    fireEvent.change(textInputs[0], { target: { value: "Juan Dela Cruz" } });
    fireEvent.change(textInputs[1], { target: { value: "juan@school.edu" } });

    const passwordInputs = container.querySelectorAll("input[type='password']");
    fireEvent.change(passwordInputs[0], { target: { value: "password123" } });
    fireEvent.change(passwordInputs[1], { target: { value: "password123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    await waitFor(() => {
      expect(screen.getByText("Step 3 of 4")).toBeTruthy();
    });

    expect(setDoc).toHaveBeenCalled();
    expect(screen.getByText("School Logo")).toBeTruthy();
    expect(screen.getByText("Brand Theme")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip for Now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save and Continue" })).toBeTruthy();
  });

  it("allows skipping Step 3 and advances to Step 4 (Import Learners)", async () => {
    const { container } = render(React.createElement(SetupWizard));

    // Advance to Step 2
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText("Step 2 of 4")).toBeTruthy());

    // Fill Step 2
    const textInputs = container.querySelectorAll("input:not([type='password']):not([type='checkbox'])");
    fireEvent.change(textInputs[0], { target: { value: "Juan Dela Cruz" } });
    fireEvent.change(textInputs[1], { target: { value: "juan@school.edu" } });

    const passwordInputs = container.querySelectorAll("input[type='password']");
    fireEvent.change(passwordInputs[0], { target: { value: "password123" } });
    fireEvent.change(passwordInputs[1], { target: { value: "password123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    // Wait for Step 3
    await waitFor(() => expect(screen.getByText("Step 3 of 4")).toBeTruthy());

    // Click Skip for Now in Step 3
    fireEvent.click(screen.getByRole("button", { name: "Skip for Now" }));

    // Should now be on Step 4
    await waitFor(() => {
      expect(screen.getByText("Step 4 of 4")).toBeTruthy();
    });

    expect(screen.getByText("SF1 Bulk Import")).toBeTruthy();
    expect(screen.getByText("SF10 Import")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finish Setup" })).toBeTruthy();
  });

  it("embeds SF1 and SF10 importers in Step 4 and calls onComplete on Finish Setup", async () => {
    const handleComplete = vi.fn();
    const { container } = render(React.createElement(SetupWizard, { onComplete: handleComplete }));

    // Advance Step 1 -> Step 2
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText("Step 2 of 4")).toBeTruthy());

    // Step 2 -> Step 3
    const textInputs = container.querySelectorAll("input:not([type='password']):not([type='checkbox'])");
    fireEvent.change(textInputs[0], { target: { value: "Juan Dela Cruz" } });
    fireEvent.change(textInputs[1], { target: { value: "juan@school.edu" } });

    const passwordInputs = container.querySelectorAll("input[type='password']");
    fireEvent.change(passwordInputs[0], { target: { value: "password123" } });
    fireEvent.change(passwordInputs[1], { target: { value: "password123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));
    await waitFor(() => expect(screen.getByText("Step 3 of 4")).toBeTruthy());

    // Step 3 -> Step 4
    fireEvent.click(screen.getByRole("button", { name: "Skip for Now" }));
    await waitFor(() => expect(screen.getByText("Step 4 of 4")).toBeTruthy());

    // Click SF1 Bulk Import card
    fireEvent.click(screen.getByText("SF1 Bulk Import"));
    expect(screen.getByTestId("sf1-importer-component")).toBeTruthy();

    // Click Back to Importer Options
    fireEvent.click(screen.getByRole("button", { name: /Back to Importer Options/i }));
    expect(screen.getByText("SF10 Import")).toBeTruthy();

    // Click SF10 Import card
    fireEvent.click(screen.getByText("SF10 Import"));
    expect(screen.getByTestId("sf10-importer-component")).toBeTruthy();

    // Click Finish Setup
    fireEvent.click(screen.getByRole("button", { name: "Finish Setup" }));
    expect(handleComplete).toHaveBeenCalledTimes(1);
  });
});
