// src/EditLearnerModal.jsx
// A popup form for editing one existing learner's data.
// Appears on top of ViewLearners.jsx when the teacher clicks "Edit" on a row.

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { X, AlertCircle } from "lucide-react";

// Same age calculator used in SF1.jsx and ViewLearners.jsx, kept consistent.
function calculateAge(birthDateString) {
  if (!birthDateString) return "";
  const birthDate = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors";
const labelClass = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300";

// Props:
// - learner: the current learner object (must include its Firestore "id")
// - onClose: function to call to close the modal without saving
// - onSaved: function to call after a successful save, passing back the updated learner
function EditLearnerModal({ learner, onClose, onSaved }) {
  // formData holds a working COPY of the learner's fields, so we don't
  // accidentally change the original list on screen while typing.
  const [formData, setFormData] = useState({ ...learner });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // Same validation rules as SF1.jsx, applied to a single learner.
  function validate() {
    if (!formData.lrn?.trim() || !formData.lastName?.trim() || !formData.firstName?.trim() ||
        !formData.sex || !formData.birthDate) {
      return "LRN, Last Name, First Name, Sex, and Birth Date are all required.";
    }
    if (!/^\d{12}$/.test(formData.lrn.trim())) {
      return "LRN must be exactly 12 digits.";
    }
    if (!formData.gradeLevel?.trim() || !formData.section?.trim()) {
      return "Grade Level and Section are required.";
    }
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const learnerRef = doc(db, "learners", learner.id);
      const updatedFields = {
        ...formData,
        age: calculateAge(formData.birthDate),
      };
      // Remove "id" before saving — it's not a real Firestore field, just how we track the doc.
      delete updatedFields.id;

      await updateDoc(learnerRef, updatedFields);

      // Tell the parent screen (ViewLearners) what changed, so it can update the table
      // without needing to re-fetch everything from Firestore.
      onSaved({ ...updatedFields, id: learner.id });
    } catch (err) {
      console.error("Failed to update learner:", err);
      setErrorMessage("Failed to save changes. Please check your connection and try again.");
      setIsSaving(false);
    }
  }

  return (
    // Full-screen semi-transparent backdrop, with the form centered on top.
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-[1000] px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Learner</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 animate-fade-in">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={labelClass}>
              LRN (12 digits)
              <input className={inputClass} value={formData.lrn || ""} maxLength={12}
                onChange={(e) => updateField("lrn", e.target.value.replace(/\D/g, ""))} />
            </label>
            <label className={labelClass}>
              Sex
              <select className={inputClass} value={formData.sex || ""} onChange={(e) => updateField("sex", e.target.value)}>
                <option value="">--</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>
            <label className={labelClass}>
              Last Name
              <input className={inputClass} value={formData.lastName || ""} onChange={(e) => updateField("lastName", e.target.value)} />
            </label>
            <label className={labelClass}>
              First Name
              <input className={inputClass} value={formData.firstName || ""} onChange={(e) => updateField("firstName", e.target.value)} />
            </label>
            <label className={labelClass}>
              Middle Name
              <input className={inputClass} value={formData.middleName || ""} onChange={(e) => updateField("middleName", e.target.value)} />
            </label>
            <label className={labelClass}>
              Birth Date
              <input className={inputClass} type="date" value={formData.birthDate || ""} onChange={(e) => updateField("birthDate", e.target.value)} />
            </label>
            <label className={labelClass}>
              Grade Level
              <input className={inputClass} value={formData.gradeLevel || ""} onChange={(e) => updateField("gradeLevel", e.target.value)} />
            </label>
            <label className={labelClass}>
              Section
              <input className={inputClass} value={formData.section || ""} onChange={(e) => updateField("section", e.target.value)} />
            </label>
            <label className={labelClass}>
              Learning Modality
              <select className={inputClass} value={formData.learningModality || "Face to Face"}
                onChange={(e) => updateField("learningModality", e.target.value)}>
                <option>Face to Face</option>
                <option>Blended</option>
                <option>Online</option>
                <option>Modular</option>
              </select>
            </label>
          </div>

          <fieldset className="mt-5 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <legend className="px-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Address</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelClass}>
                House / Street / Sitio
                <input className={inputClass} value={formData.houseStreetSitio || ""} onChange={(e) => updateField("houseStreetSitio", e.target.value)} />
              </label>
              <label className={labelClass}>
                Barangay
                <input className={inputClass} value={formData.barangay || ""} onChange={(e) => updateField("barangay", e.target.value)} />
              </label>
              <label className={labelClass}>
                Municipality / City
                <input className={inputClass} value={formData.municipalityCity || ""} onChange={(e) => updateField("municipalityCity", e.target.value)} />
              </label>
              <label className={labelClass}>
                Province
                <input className={inputClass} value={formData.province || ""} onChange={(e) => updateField("province", e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-5 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <legend className="px-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Parents / Guardian</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelClass}>
                Father's Name
                <input className={inputClass} value={formData.fathersName || ""} onChange={(e) => updateField("fathersName", e.target.value)} />
              </label>
              <label className={labelClass}>
                Mother's Maiden Name
                <input className={inputClass} value={formData.mothersMaidenName || ""} onChange={(e) => updateField("mothersMaidenName", e.target.value)} />
              </label>
              <label className={labelClass}>
                Guardian Name
                <input className={inputClass} value={formData.guardianName || ""} onChange={(e) => updateField("guardianName", e.target.value)} />
              </label>
              <label className={labelClass}>
                Relationship to Learner
                <input className={inputClass} value={formData.guardianRelationship || ""} onChange={(e) => updateField("guardianRelationship", e.target.value)} />
              </label>
            </div>
          </fieldset>

          <label className={`${labelClass} mt-5`}>
            Remarks
            <textarea className={`${inputClass} min-h-[70px] resize-y`}
              value={formData.remarks || ""} onChange={(e) => updateField("remarks", e.target.value)} />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm hover:bg-primary-light active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditLearnerModal;
