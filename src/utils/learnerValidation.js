// src/utils/learnerValidation.js
// Field-level and form-level validation for learner records in LIKHA-SIS.

/**
 * Validates a single field of a learner record.
 * Returns an error string if invalid, or "" if valid.
 */
export function validateLearnerField(field, value, formData = {}) {
  const val = String(value ?? "").trim();

  switch (field) {
    case "lrn":
      if (!val) return "LRN is required.";
      if (!/^\d{12}$/.test(val)) return "LRN must be exactly 12 digits.";
      return "";

    case "lastName":
      if (!val) return "Last Name is required.";
      return "";

    case "firstName":
      if (!val) return "First Name is required.";
      return "";

    case "sex":
      if (!val) return "Sex is required.";
      if (!["M", "F", "Male", "Female"].includes(val)) return "Sex must be Male (M) or Female (F).";
      return "";

    case "birthDate":
      if (!val) return "Birth Date is required.";
      if (isNaN(new Date(val).getTime())) return "Invalid date format.";
      if (new Date(val) > new Date()) return "Birth Date cannot be in the future.";
      return "";

    case "gradeLevel":
      if (!val) return "Grade Level is required.";
      return "";

    case "section":
      if (!val) return "Section is required.";
      return "";

    case "contactNumber":
      if (val && !/^[0-9+\-\s()]{7,20}$/.test(val)) {
        return "Invalid contact number format.";
      }
      return "";

    case "track": {
      const isSHS = formData.gradeLevel === "Grade 11" || formData.gradeLevel === "Grade 12";
      if (isSHS && !val) return "Track is required for SHS (Grade 11/12).";
      return "";
    }

    default:
      return "";
  }
}

/**
 * Validates the entire learner form object.
 * Returns an object containing { isValid: boolean, errors: { [field]: string }, firstError: string }.
 */
export function validateLearnerForm(formData) {
  const errors = {};
  const requiredFields = ["lrn", "lastName", "firstName", "sex", "birthDate", "gradeLevel", "section"];

  for (const field of requiredFields) {
    const err = validateLearnerField(field, formData[field], formData);
    if (err) {
      errors[field] = err;
    }
  }

  // Optional / contextual field checks
  if (formData.contactNumber) {
    const contactErr = validateLearnerField("contactNumber", formData.contactNumber, formData);
    if (contactErr) errors.contactNumber = contactErr;
  }

  const isSHS = formData.gradeLevel === "Grade 11" || formData.gradeLevel === "Grade 12";
  if (isSHS && !formData.track?.trim()) {
    errors.track = "Track is required for SHS (Grade 11/12).";
  }

  const errorKeys = Object.keys(errors);
  const isValid = errorKeys.length === 0;
  const firstError = isValid ? "" : errors[errorKeys[0]];

  return {
    isValid,
    errors,
    firstError,
  };
}

/**
 * Compares old learner data against updated learner data to compute changed fields for audit trails.
 * Excludes transient or non-data properties like `id`, `_rowIndex`, `createdAt`, `updatedAt`.
 */
export function computeLearnerChanges(originalData = {}, updatedData = {}) {
  const ignoredKeys = new Set(["id", "_rowIndex", "createdAt", "updatedAt", "updatedBy", "updatedByEmail"]);
  const changes = {};

  const allKeys = new Set([...Object.keys(originalData), ...Object.keys(updatedData)]);

  for (const key of allKeys) {
    if (ignoredKeys.has(key)) continue;

    const oldVal = originalData[key] !== undefined && originalData[key] !== null ? String(originalData[key]).trim() : "";
    const newVal = updatedData[key] !== undefined && updatedData[key] !== null ? String(updatedData[key]).trim() : "";

    if (oldVal !== newVal) {
      changes[key] = {
        oldValue: originalData[key] ?? null,
        newValue: updatedData[key] ?? null,
      };
    }
  }

  return changes;
}
