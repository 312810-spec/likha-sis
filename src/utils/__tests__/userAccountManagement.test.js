import { describe, it, expect } from "vitest";
import {
  isAccountActive,
  isEditableUserRow,
  validateUserEditForm,
} from "../userAccountManagement.js";

describe("userAccountManagement", () => {
  describe("isAccountActive", () => {
    it("treats a profile with no active field as active (default for existing users)", () => {
      expect(isAccountActive({ fullName: "Maria Santos" })).toBe(true);
    });

    it("treats active: true as active", () => {
      expect(isAccountActive({ active: true })).toBe(true);
    });

    it("treats active: false as inactive", () => {
      expect(isAccountActive({ active: false })).toBe(false);
    });

    it("treats a null or missing profile as active (still loading, don't force sign-out)", () => {
      expect(isAccountActive(null)).toBe(true);
      expect(isAccountActive(undefined)).toBe(true);
    });
  });

  describe("isEditableUserRow", () => {
    it("returns false when the row belongs to the currently signed-in user", () => {
      expect(isEditableUserRow("uid-1", "uid-1")).toBe(false);
    });

    it("returns true when the row belongs to a different user", () => {
      expect(isEditableUserRow("uid-1", "uid-2")).toBe(true);
    });

    it("returns false when the current uid is missing", () => {
      expect(isEditableUserRow(null, "uid-2")).toBe(false);
      expect(isEditableUserRow(undefined, "uid-2")).toBe(false);
    });
  });

  describe("validateUserEditForm", () => {
    it("requires a non-blank full name", () => {
      expect(validateUserEditForm({ fullName: "", roles: ["adviser"] })).toEqual({
        valid: false,
        error: "Full Name is required.",
      });
      expect(validateUserEditForm({ fullName: "   ", roles: ["adviser"] })).toEqual({
        valid: false,
        error: "Full Name is required.",
      });
    });

    it("requires at least one role", () => {
      expect(validateUserEditForm({ fullName: "Maria Santos", roles: [] })).toEqual({
        valid: false,
        error: "Please select at least one role for the user.",
      });
    });

    it("passes for a valid full name and at least one role", () => {
      expect(
        validateUserEditForm({ fullName: "Maria Santos", roles: ["adviser"] })
      ).toEqual({ valid: true, error: "" });
    });
  });
});
