import { describe, it, expect } from "vitest";
import {
  isAccountActive,
  isEditableUserRow,
  validateUserEditForm,
  validateSelfRoleEdit,
  reconcileAdviserAssignments,
  findAdviserAssignmentConflict,
  canDeactivateAccount,
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

  describe("validateSelfRoleEdit", () => {
    it("blocks removing your own ictCoordinator role", () => {
      expect(validateSelfRoleEdit(["principal"])).toEqual({
        valid: false,
        error: "You can't remove your own ICT Coordinator role.",
      });
      expect(validateSelfRoleEdit([])).toEqual({
        valid: false,
        error: "You can't remove your own ICT Coordinator role.",
      });
      expect(validateSelfRoleEdit(null)).toEqual({
        valid: false,
        error: "You can't remove your own ICT Coordinator role.",
      });
    });

    it("allows keeping ictCoordinator alongside other roles", () => {
      expect(validateSelfRoleEdit(["ictCoordinator"])).toEqual({ valid: true, error: "" });
      expect(validateSelfRoleEdit(["ictCoordinator", "principal"])).toEqual({
        valid: true,
        error: "",
      });
    });
  });

  describe("reconcileAdviserAssignments", () => {
    it("strips a stale adviser assignment when the adviser role is removed", () => {
      const assignments = [
        { role: "adviser", gradeLevel: "8", section: "LOVE" },
        { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "HOPE" },
      ];
      const result = reconcileAdviserAssignments(assignments, ["subjectTeacher"]);
      expect(result.error).toBe("");
      expect(result.assignments).toEqual([
        { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "HOPE" },
      ]);
    });

    it("blocks when the adviser role is checked but no adviser assignment exists", () => {
      const result = reconcileAdviserAssignments([], ["adviser"]);
      expect(result.error).toBe("Add exactly one advisory class assignment for this Adviser.");
    });

    it("blocks when the adviser role is checked with more than one adviser assignment", () => {
      const assignments = [
        { role: "adviser", gradeLevel: "8", section: "LOVE" },
        { role: "adviser", gradeLevel: "9", section: "HOPE" },
      ];
      const result = reconcileAdviserAssignments(assignments, ["adviser"]);
      expect(result.error).not.toBe("");
    });

    it("passes through unchanged with exactly one adviser assignment", () => {
      const assignments = [{ role: "adviser", gradeLevel: "8", section: "LOVE" }];
      const result = reconcileAdviserAssignments(assignments, ["adviser"]);
      expect(result).toEqual({ assignments, error: "" });
    });
  });

  describe("findAdviserAssignmentConflict", () => {
    const userList = [
      { id: "uid-1", fullName: "Maria Santos", assignments: [{ role: "adviser", gradeLevel: "8", section: "LOVE" }] },
      { id: "uid-2", fullName: "Juan Cruz", assignments: [{ role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "HOPE" }] },
    ];

    it("finds another user already advising the same grade + section", () => {
      const conflict = findAdviserAssignmentConflict(userList, "Grade 8", "LOVE", "uid-2");
      expect(conflict?.fullName).toBe("Maria Santos");
    });

    it("matches '8' against 'Grade 8' (normalized grade level)", () => {
      const conflict = findAdviserAssignmentConflict(userList, "8", "LOVE", "uid-2");
      expect(conflict?.fullName).toBe("Maria Santos");
    });

    it("excludes the given uid so editing your own assignment isn't a self-conflict", () => {
      expect(findAdviserAssignmentConflict(userList, "Grade 8", "LOVE", "uid-1")).toBeNull();
    });

    it("returns null when no other user advises that grade + section", () => {
      expect(findAdviserAssignmentConflict(userList, "Grade 9", "FAITH", "uid-2")).toBeNull();
    });
  });

  describe("ICT Coordinator row management", () => {
    it("an ICT Coordinator row is still editable by another manager, same as any other user", () => {
      // isEditableUserRow only checks self vs. other -- it is not role-gated,
      // so Edit / Reset Password / assignment editing stay available for an
      // ICT Coordinator row exactly as they do for any other managed user.
      expect(isEditableUserRow("uid-admin", "uid-other-ict-coordinator")).toBe(true);
    });

    it("editing an ICT Coordinator's profile still passes normal edit-form validation", () => {
      expect(validateUserEditForm({ fullName: "IT Admin", roles: ["ictCoordinator"] })).toEqual({
        valid: true,
        error: "",
      });
    });

    it("blocks deactivation for an ICT Coordinator account", () => {
      expect(canDeactivateAccount(["ictCoordinator"])).toBe(false);
    });

    it("blocks deactivation for a multi-role account that includes ictCoordinator", () => {
      expect(canDeactivateAccount(["ictCoordinator", "adviser"])).toBe(false);
    });

    it("allows deactivation for normal (non-ICT-Coordinator) accounts", () => {
      expect(canDeactivateAccount(["adviser"])).toBe(true);
      expect(canDeactivateAccount(["principal"])).toBe(true);
      expect(canDeactivateAccount(["subjectTeacher"])).toBe(true);
    });

    it("defaults to allowing deactivation when roles is missing or empty", () => {
      expect(canDeactivateAccount([])).toBe(true);
      expect(canDeactivateAccount(null)).toBe(true);
      expect(canDeactivateAccount(undefined)).toBe(true);
    });
  });
});
