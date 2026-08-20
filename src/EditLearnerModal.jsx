// src/EditLearnerModal.jsx
// A popup form for editing one existing learner's data.
// Appears on top of ViewLearners.jsx when the teacher clicks "Edit" on a row.

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { resizeImageToCanvas } from "./utils/resizeImage.js";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { X, User, Upload } from "lucide-react";
import Button from "./components/ui/Button";
import Alert from "./components/ui/Alert";

const MAX_PHOTO_SOURCE_BYTES = 15 * 1024 * 1024; // sanity cap on the original file before resizing

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

const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";
const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300";

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

  // DO 017 SHS: track/cluster only apply to Grade 11/12 learners.
  const { config } = useSchoolConfig();
  const isSHS = formData.gradeLevel === "Grade 11" || formData.gradeLevel === "Grade 12";
  const electiveClusters = config?.shs?.electiveClusters || [];
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // Resizes the picked photo down to a small JPEG data URL (same technique
  // BrandingSettings.jsx uses for the school logo) and stores it directly on
  // formData.photoURL — no file-storage service needed, so it works on
  // Firebase's free Spark plan.
  async function handlePhotoPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please choose an image file for the photo.");
      return;
    }
    if (file.size > MAX_PHOTO_SOURCE_BYTES) {
      setErrorMessage("That image is too large. Please choose a file under 15MB.");
      return;
    }

    setErrorMessage("");
    setIsProcessingPhoto(true);
    try {
      const dataUrl = await resizeImageToCanvas(file, 240, 300, 0.75);
      updateField("photoURL", dataUrl);
    } catch (err) {
      console.error("Failed to process photo:", err);
      setErrorMessage("Could not process the selected image. Please try another file.");
    } finally {
      setIsProcessingPhoto(false);
    }
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
        className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-800 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Learner</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {errorMessage && (
            <Alert variant="error" className="mb-4">
              {errorMessage}
            </Alert>
          )}

          <div className="flex items-center gap-4 mb-5">
            <div className="w-20 h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
              {formData.photoURL ? (
                <img src={formData.photoURL} alt="Learner" className="w-full h-full object-cover" />
              ) : (
                <User size={28} strokeWidth={1.2} className="text-gray-300 dark:text-gray-600" />
              )}
            </div>
            <div>
              <label className={labelClass}>
                Photo (for School ID)
                <span className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-fit">
                  <Upload size={13} />
                  {isProcessingPhoto ? "Processing..." : formData.photoURL ? "Change Photo" : "Upload Photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} disabled={isProcessingPhoto} />
                </span>
              </label>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">JPG or PNG. Resized automatically.</p>
            </div>
          </div>

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
            {isSHS && (
              <>
                <label className={labelClass}>
                  Track
                  <select
                    className={inputClass}
                    value={formData.track || ""}
                    onChange={(e) => {
                      updateField("track", e.target.value);
                      if (e.target.value !== "techPro") updateField("cluster", null);
                    }}
                  >
                    <option value="">Select a track</option>
                    <option value="academic">Academic Track</option>
                    <option value="techPro">Tech-Pro Track</option>
                  </select>
                </label>
                <label className={labelClass}>
                  Elective Cluster
                  <select
                    className={inputClass}
                    value={formData.cluster || ""}
                    onChange={(e) => updateField("cluster", e.target.value)}
                    disabled={formData.track !== "techPro"}
                  >
                    <option value="">{formData.track === "techPro" ? "Select a cluster" : "N/A (Academic Track)"}</option>
                    {electiveClusters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>

          <fieldset className="mt-5 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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

          <fieldset className="mt-5 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900 rounded-b-lg">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving || isProcessingPhoto}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default EditLearnerModal;
