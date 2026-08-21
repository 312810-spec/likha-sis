// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import AccountSettings from "../AccountSettings.jsx";
import { getDoc, updateDoc } from "firebase/firestore";

vi.mock("../firebase.js", () => ({
  auth: { currentUser: { uid: "u1" } },
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({ kind: "doc" })),
  getDoc: vi.fn(),
  updateDoc: vi.fn(async () => {}),
}));

vi.mock("firebase/auth", () => ({
  updateProfile: vi.fn(async () => {}),
  reauthenticateWithCredential: vi.fn(async () => {}),
  updatePassword: vi.fn(async () => {}),
  EmailAuthProvider: { credential: vi.fn() },
}));

function profileSnapshot(data) {
  return { exists: () => true, data: () => data };
}

function renderAccountSettings() {
  return render(React.createElement(AccountSettings, { user: { uid: "u1", email: "teacher@tingub.edu.ph" } }));
}

describe("AccountSettings profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("lets an ordinary staff member edit their own professional profile fields", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      profileSnapshot({ fullName: "Juan Dela Cruz", roles: ["subjectTeacher"], employeeNumber: "", position: "", mobileNumber: "", birthdate: "" })
    );

    renderAccountSettings();
    await waitFor(() => expect(screen.getByDisplayValue("Juan Dela Cruz")).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText("e.g. 6113070"), { target: { value: "123456" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 09171234567"), { target: { value: "09171234567" } });
    fireEvent.click(screen.getByText("Save Profile"));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const payload = vi.mocked(updateDoc).mock.calls[0][1];
    expect(payload.employeeNumber).toBe("123456");
    expect(payload.mobileNumber).toBe("09171234567");
    expect(payload.roles).toBeUndefined(); // ordinary user's update never includes roles
  });

  it("keeps email read-only", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(profileSnapshot({ fullName: "Juan Dela Cruz", roles: ["adviser"] }));
    renderAccountSettings();
    await waitFor(() => expect(screen.getByDisplayValue("teacher@tingub.edu.ph")).toBeTruthy());
    expect(screen.getByDisplayValue("teacher@tingub.edu.ph").disabled).toBe(true);
  });

  it("does not let a normal (non-ICT) user edit roles", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(profileSnapshot({ fullName: "Juan Dela Cruz", roles: ["adviser"] }));
    renderAccountSettings();
    await waitFor(() => expect(screen.getByDisplayValue("Adviser")).toBeTruthy());
    // Role(s) renders as a disabled text field, not the ICT-only checkbox grid.
    expect(screen.queryByText("Principal")).toBeNull();
    expect(screen.getByDisplayValue("Adviser").disabled).toBe(true);
  });

  it("shows read-only assignment summary for an adviser", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      profileSnapshot({
        fullName: "Juan Dela Cruz",
        roles: ["adviser"],
        assignments: [{ role: "adviser", gradeLevel: "7", section: "Love" }],
      })
    );
    renderAccountSettings();
    await waitFor(() => expect(screen.getByText("Assigned Responsibilities")).toBeTruthy());
    expect(screen.getByText("Grade 7 — Love")).toBeTruthy();
  });

  it("uses the shared position dropdown options", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(profileSnapshot({ fullName: "Juan Dela Cruz", roles: ["adviser"], position: "" }));
    renderAccountSettings();
    await waitFor(() => expect(screen.getByText("Position / Designation")).toBeTruthy());
    const select = screen.getByText("Position / Designation").closest("label").querySelector("select");
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain("Teacher III");
    expect(optionValues).toContain("Master Teacher I");
  });

  it("preserves an existing unknown stored position instead of dropping it", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      profileSnapshot({ fullName: "Juan Dela Cruz", roles: ["adviser"], position: "Senior High School Coordinator" })
    );
    renderAccountSettings();
    await waitFor(() => expect(screen.getByDisplayValue("Senior High School Coordinator")).toBeTruthy());
  });

  it("saves birthdate, mobile number, and employee number to the existing user document", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      profileSnapshot({ fullName: "Juan Dela Cruz", roles: ["adviser"], employeeNumber: "", position: "", mobileNumber: "", birthdate: "" })
    );
    renderAccountSettings();
    await waitFor(() => expect(screen.getByDisplayValue("Juan Dela Cruz")).toBeTruthy());

    const birthdateInput = screen.getByText("Birthdate").closest("label").querySelector("input");
    fireEvent.change(birthdateInput, { target: { value: "1990-05-14" } });
    fireEvent.click(screen.getByText("Save Profile"));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const payload = vi.mocked(updateDoc).mock.calls[0][1];
    expect(payload.birthdate).toBe("1990-05-14");
  });
});
