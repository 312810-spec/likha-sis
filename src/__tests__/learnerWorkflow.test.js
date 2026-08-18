import { describe, it, expect } from "vitest";
import {
  validateLearnerField,
  validateLearnerForm,
  computeLearnerChanges,
} from "../utils/learnerValidation.js";

describe("learnerValidation utils", () => {
  describe("validateLearnerField", () => {
    it("validates LRN format", () => {
      expect(validateLearnerField("lrn", "")).toBe("LRN is required.");
      expect(validateLearnerField("lrn", "123")).toBe("LRN must be exactly 12 digits.");
      expect(validateLearnerField("lrn", "123456789012")).toBe("");
    });

    it("validates sex field", () => {
      expect(validateLearnerField("sex", "")).toBe("Sex is required.");
      expect(validateLearnerField("sex", "M")).toBe("");
      expect(validateLearnerField("sex", "Female")).toBe("");
      expect(validateLearnerField("sex", "Other")).toBe("Sex must be Male (M) or Female (F).");
    });

    it("validates birthDate field", () => {
      expect(validateLearnerField("birthDate", "")).toBe("Birth Date is required.");
      expect(validateLearnerField("birthDate", "2010-05-15")).toBe("");
      expect(validateLearnerField("birthDate", "2099-01-01")).toBe("Birth Date cannot be in the future.");
    });

    it("validates track for SHS grades", () => {
      expect(validateLearnerField("track", "", { gradeLevel: "Grade 7" })).toBe("");
      expect(validateLearnerField("track", "", { gradeLevel: "Grade 11" })).toBe("Track is required for SHS (Grade 11/12).");
      expect(validateLearnerField("track", "academic", { gradeLevel: "Grade 11" })).toBe("");
    });
  });

  describe("validateLearnerForm", () => {
    it("returns isValid true for valid learner form", () => {
      const validForm = {
        lrn: "123456789012",
        lastName: "Dela Cruz",
        firstName: "Juan",
        sex: "M",
        birthDate: "2012-08-10",
        gradeLevel: "Grade 7",
        section: "Diamond",
      };

      const res = validateLearnerForm(validForm);
      expect(res.isValid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
      expect(res.firstError).toBe("");
    });

    it("returns errors when required fields are missing", () => {
      const invalidForm = {
        lrn: "123",
        lastName: "",
        firstName: "Juan",
        sex: "",
        birthDate: "",
        gradeLevel: "",
        section: "",
      };

      const res = validateLearnerForm(invalidForm);
      expect(res.isValid).toBe(false);
      expect(res.errors.lrn).toBe("LRN must be exactly 12 digits.");
      expect(res.errors.lastName).toBe("Last Name is required.");
      expect(res.errors.sex).toBe("Sex is required.");
      expect(res.firstError).toBeTruthy();
    });
  });

  describe("computeLearnerChanges", () => {
    it("identifies changed fields while ignoring internal tracking properties", () => {
      const original = {
        id: "doc123",
        _rowIndex: 5,
        lrn: "123456789012",
        lastName: "Dela Cruz",
        firstName: "Juan",
        section: "Diamond",
        gradeLevel: "Grade 7",
      };

      const updated = {
        id: "doc123",
        _rowIndex: 5,
        lrn: "123456789012",
        lastName: "Dela Cruz",
        firstName: "Juan",
        section: "Emerald", // changed
        gradeLevel: "Grade 8", // changed
        updatedBy: "teacher@school.edu",
      };

      const changes = computeLearnerChanges(original, updated);
      expect(Object.keys(changes)).toEqual(["section", "gradeLevel"]);
      expect(changes.section).toEqual({ oldValue: "Diamond", newValue: "Emerald" });
      expect(changes.gradeLevel).toEqual({ oldValue: "Grade 7", newValue: "Grade 8" });
    });

    it("returns empty object if no fields changed", () => {
      const data = {
        id: "doc123",
        lrn: "123456789012",
        lastName: "Dela Cruz",
      };

      const changes = computeLearnerChanges(data, { ...data });
      expect(Object.keys(changes).length).toBe(0);
    });
  });
});
