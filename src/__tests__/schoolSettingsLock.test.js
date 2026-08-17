// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import SchoolSettings from "../SchoolSettings.jsx";
import { hashSettingsKey } from "../utils/settingsLock.js";

vi.mock("../firebase.js", () => ({
  auth: { currentUser: { uid: "ict-uid", email: "ict@school.edu" } },
  db: {},
}));

// Firestore stand-in keyed by document path, so the lock screen and the tabs
// can be answered independently.
const docs = new Map();
const setDocSpy = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, ...path) => ({ path: path.join("/") })),
  getDoc: vi.fn((ref) =>
    Promise.resolve({
      exists: () => docs.has(ref.path),
      data: () => docs.get(ref.path),
    })
  ),
  setDoc: vi.fn((ref, payload) => {
    setDocSpy(ref.path, payload);
    docs.set(ref.path, payload);
    return Promise.resolve();
  }),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteField: vi.fn(),
  serverTimestamp: vi.fn(() => "MOCK_TIMESTAMP"),
}));

const CORRECT_KEY = "tingub-key-2026";

function renderSettings() {
  return render(
    React.createElement(SchoolSettings, { user: { email: "ict@school.edu" }, goBack: undefined })
  );
}

describe("School Settings lock", () => {
  beforeEach(() => {
    docs.clear();
    docs.set("settings/schoolConfig", { schoolName: "Tingub NHS", principalName: "P. Cruz" });
    setDocSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("hides every settings tab until the key is entered", async () => {
    docs.set("settings/security", await hashSettingsKey(CORRECT_KEY));
    renderSettings();

    await waitFor(() => expect(screen.getByText("School Settings are locked")).toBeTruthy());

    expect(screen.queryByRole("tab", { name: "School Identity" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Academic Calendar" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Branding & Theme" })).toBeNull();
  });

  it("rejects a wrong key and stays locked", async () => {
    docs.set("settings/security", await hashSettingsKey(CORRECT_KEY));
    renderSettings();

    await waitFor(() => expect(screen.getByText("School Settings are locked")).toBeTruthy());

    fireEvent.change(document.querySelector("input[type='password']"), {
      target: { value: "not-the-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Unlock Settings/i }));

    await waitFor(() => expect(screen.getByText(/Incorrect School Settings key/i)).toBeTruthy());
    expect(screen.queryByRole("tab", { name: "School Identity" })).toBeNull();
  });

  it("reveals the tabs once the correct key is entered", async () => {
    docs.set("settings/security", await hashSettingsKey(CORRECT_KEY));
    renderSettings();

    await waitFor(() => expect(screen.getByText("School Settings are locked")).toBeTruthy());

    fireEvent.change(document.querySelector("input[type='password']"), {
      target: { value: CORRECT_KEY },
    });
    fireEvent.click(screen.getByRole("button", { name: /Unlock Settings/i }));

    await waitFor(() => expect(screen.getByRole("tab", { name: "School Identity" })).toBeTruthy());
    expect(screen.getByRole("tab", { name: "Grade Levels & SHS" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Branding & Theme" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Academic Calendar" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Security" })).toBeTruthy();
  });

  it("re-locks when the Lock button is pressed", async () => {
    docs.set("settings/security", await hashSettingsKey(CORRECT_KEY));
    renderSettings();

    await waitFor(() => expect(screen.getByText("School Settings are locked")).toBeTruthy());
    fireEvent.change(document.querySelector("input[type='password']"), {
      target: { value: CORRECT_KEY },
    });
    fireEvent.click(screen.getByRole("button", { name: /Unlock Settings/i }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "School Identity" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^Lock$/ }));

    await waitFor(() => expect(screen.getByText("School Settings are locked")).toBeTruthy());
    expect(screen.queryByRole("tab", { name: "School Identity" })).toBeNull();
  });

  it("asks a school with no key yet to create one instead of locking it out", async () => {
    renderSettings();

    await waitFor(() => expect(screen.getByText("Create your School Settings key")).toBeTruthy());
    expect(screen.queryByRole("tab", { name: "School Identity" })).toBeNull();

    const passwordInputs = document.querySelectorAll("input[type='password']");
    fireEvent.change(passwordInputs[0], { target: { value: CORRECT_KEY } });
    fireEvent.change(passwordInputs[1], { target: { value: CORRECT_KEY } });
    fireEvent.click(screen.getByRole("button", { name: /Set Key & Continue/i }));

    await waitFor(() => expect(screen.getByRole("tab", { name: "School Identity" })).toBeTruthy());

    const [path, payload] = setDocSpy.mock.calls.at(-1);
    expect(path).toBe("settings/security");
    expect(payload.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(payload)).not.toContain(CORRECT_KEY);
  });

  it("refuses a too-short key when creating one", async () => {
    renderSettings();

    await waitFor(() => expect(screen.getByText("Create your School Settings key")).toBeTruthy());

    const passwordInputs = document.querySelectorAll("input[type='password']");
    fireEvent.change(passwordInputs[0], { target: { value: "short" } });
    fireEvent.change(passwordInputs[1], { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /Set Key & Continue/i }));

    await waitFor(() =>
      expect(screen.getByText(/must be at least 8 characters/i)).toBeTruthy()
    );
    expect(setDocSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("tab", { name: "School Identity" })).toBeNull();
  });

  it("stays locked when the security check cannot be read (fails closed)", async () => {
    const { getDoc } = await import("firebase/firestore");
    getDoc.mockImplementationOnce(() => Promise.reject(new Error("permission-denied")));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderSettings();

    await waitFor(() =>
      expect(screen.getByText(/Could not check the School Settings lock/i)).toBeTruthy()
    );
    expect(screen.queryByRole("tab", { name: "School Identity" })).toBeNull();

    consoleError.mockRestore();
  });
});
