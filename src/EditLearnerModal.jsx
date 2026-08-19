// src/EditLearnerModal.jsx
// A popup form for editing one existing learner's data.
// Appears on top of ViewLearners.jsx when the teacher clicks "Edit" on a row.
// Features field-level validation and Firestore audit trail logging.

import { useState } from "react";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { resizeImageToCanvas } from "./utils/resizeImage.js";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { validateLearnerField, validateLearnerForm, computeLearnerChanges } from "./utils/learnerValidation.js";
import { X, AlertCircle, User, Upload } from "lucide-react";

const MAX_PHOTO_SOURCE_BYTES = 15 * 1024 * 1024; // sanity cap on the original file before resizing

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
const inputErrorClass = "w-full px-3 py-2 text-sm border border-red-500 dark:border-red-500 rounded-lg bg-red-50/20 dark:bg-red-950/20 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-500 transition-colors";
const labelClass = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300";

// Props:
// - learner: the current learner object (must include its Firestore "id")
// - currentUser: current logged-in user object (for audit logging)
// - onClose: function to call to close the modal without saving
// - onSaved: function to call after a successful save, passing back the updated learner
function EditLearnerModal({ learner, currentUser, onClose, onSaved }) {
  const [formData, setFormData] = useState({ ...learner });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { config } = useSchoolConfig();
  const isSHS = formData.gradeLevel === "Grade 11" || formData.gradeLevel === "Grade 12";
  const electiveClusters = config?.shs?.electiveClusters || [];
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  function updateField(field, value) {
    const updated = { ...formData, [field]: value };
    setFormData(updated);

    // Dynamic field-level validation feedback
    const err = validateLearnerField(field, value, updated);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  }

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

  async function handleSave() {
    const validation = validateLearnerForm(formData);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setErrorMessage(validation.firstError || "Please check all required fields.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const learnerRef = doc(db, "learners", learner.id);
      const updatedAge = calculateAge(formData.birthDate);
      const updatedFields = {
        ...formData,
        age: updatedAge,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || "unknown",
        updatedByEmail: currentUser?.email || "unknown",
      };

      // Calculate changed fields for the audit trail
      const fieldChanges = computeLearnerChanges(learner, updatedFields);
      delete updatedFields.id;

      // 1. Update learner document in Firestore
      await updateDoc(learnerRef, updatedFields);

      // 2. If changes exist, write an audit log entry in "auditLogs" collection
      if (Object.keys(fieldChanges).length > 0) {
        try {
          await addDoc(collection(db, "auditLogs"), {
            action: "EDIT_LEARNER",
            entityType: "learner",
            entityId: learner.id,
            learnerLRN: formData.lrn || learner.lrn || "",
            learnerName: `${formData.lastName || ""}, ${formData.firstName || ""}`.trim(),
            changes: fieldChanges,
            performedByUid: currentUser?.uid || "unknown",
            performedByEmail: currentUser?.email || "unknown",
            timestamp: serverTimestamp(),
          });
        } catch (auditErr) {
          // Log audit failure to console without failing the learner update
          console.warn("Failed to write audit log entry:", auditErr);
        }
      }

      onSaved({ ...updatedFields, id: learner.id, age: updatedAge });
    } catch (err) {
      console.error("Failed to update learner:", err);
      setErrorMessage("Failed to save changes. Please check your connection and try again.");
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-[1000] px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Learner Record</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Update learner profile with field-level validation and Firestore audit trail.
            </p>
          </div>
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
                <span className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-fit">
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
              <span>LRN (12 digits) *</span>
              <input
                className={fieldErrors.lrn ? inputErrorClass : inputClass}
                value={formData.lrn || ""}
                maxLength={12}
                onChange={(e) => updateField("lrn", e.target.value.replace(/\D/g, ""))}
              />
              {fieldErrors.lrn && <span className="text-[11px] text-red-500">{fieldErrors.lrn}</span>}
            </label>

            <label className={labelClass}>
              <span>Sex *</span>
              <select
                className={fieldErrors.sex ? inputErrorClass : inputClass}
                value={formData.sex || ""}
                onChange={(e) => updateField("sex", e.target.value)}
              >
                <option value="">-- Select Sex --</option>
                <option value="M">M (Male)</option>
                <option value="F">F (Female)</option>
              </select>
              {fieldErrors.sex && <span className="text-[11px] text-red-500">{fieldErrors.sex}</span>}
            </label>

            <label className={labelClass}>
              <span>Last Name *</span>
              <input
                className={fieldErrors.lastName ? inputErrorClass : inputClass}
                value={formData.lastName || ""}
                onChange={(e) => updateField("lastName", e.target.value)}
              />
              {fieldErrors.lastName && <span className="text-[11px] text-red-500">{fieldErrors.lastName}</span>}
            </label>

            <label className={labelClass}>
              <span>First Name *</span>
              <input
                className={fieldErrors.firstName ? inputErrorClass : inputClass}
                value={formData.firstName || ""}
                onChange={(e) => updateField("firstName", e.target.value)}
              />
              {fieldErrors.firstName && <span className="text-[11px] text-red-500">{fieldErrors.firstName}</span>}
            </label>

            <label className={labelClass}>
              <span>Middle Name</span>
              <input
                className={inputClass}
                value={formData.middleName || ""}
                onChange={(e) => updateField("middleName", e.target.value)}
              />
            </label>

            <label className={labelClass}>
              <span>Birth Date *</span>
              <input
                className={fieldErrors.birthDate ? inputErrorClass : inputClass}
                type="date"
                value={formData.birthDate || ""}
                onChange={(e) => updateField("birthDate", e.target.value)}
              />
              {fieldErrors.birthDate && <span className="text-[11px] text-red-500">{fieldErrors.birthDate}</span>}
            </label>

            <label className={labelClass}>
              <span>Grade Level *</span>
              <input
                className={fieldErrors.gradeLevel ? inputErrorClass : inputClass}
                value={formData.gradeLevel || ""}
                onChange={(e) => updateField("gradeLevel", e.target.value)}
              />
              {fieldErrors.gradeLevel && <span className="text-[11px] text-red-500">{fieldErrors.gradeLevel}</span>}
            </label>

            <label className={labelClass}>
              <span>Section *</span>
              <input
                className={fieldErrors.section ? inputErrorClass : inputClass}
                value={formData.section || ""}
                onChange={(e) => updateField("section", e.target.value)}
              />
              {fieldErrors.section && <span className="text-[11px] text-red-500">{fieldErrors.section}</span>}
            </label>

            <label className={labelClass}>
              <span>Contact Number</span>
              <input
                className={fieldErrors.contactNumber ? inputErrorClass : inputClass}
                placeholder="e.g. 09171234567"
                value={formData.contactNumber || ""}
                onChange={(e) => updateField("contactNumber", e.target.value)}
              />
              {fieldErrors.contactNumber && <span className="text-[11px] text-red-500">{fieldErrors.contactNumber}</span>}
            </label>

            <label className={labelClass}>
              <span>Learning Modality</span>
              <select
                className={inputClass}
                value={formData.learningModality || "Face to Face"}
                onChange={(e) => updateField("learningModality", e.target.value)}
              >
                <option>Face to Face</option>
                <option>Blended</option>
                <option>Online</option>
                <option>Modular</option>
              </select>
            </label>

            {isSHS && (
              <>
                <label className={labelClass}>
                  <span>Track *</span>
                  <select
                    className={fieldErrors.track ? inputErrorClass : inputClass}
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
                  {fieldErrors.track && <span className="text-[11px] text-red-500">{fieldErrors.track}</span>}
                </label>
                <label className={labelClass}>
                  <span>Elective Cluster</span>
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

          <fieldset className="mt-5 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <legend className="px-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Address</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelClass}>
                <span>House / Street / Sitio</span>
                <input className={inputClass} value={formData.houseStreetSitio || ""} onChange={(e) => updateField("houseStreetSitio", e.target.value)} />
              </label>
              <label className={labelClass}>
                <span>Barangay</span>
                <input className={inputClass} value={formData.barangay || ""} onChange={(e) => updateField("barangay", e.target.value)} />
              </label>
              <label className={labelClass}>
                <span>Municipality / City</span>
                <input className={inputClass} value={formData.municipalityCity || ""} onChange={(e) => updateField("municipalityCity", e.target.value)} />
              </label>
              <label className={labelClass}>
                <span>Province</span>
                <input className={inputClass} value={formData.province || ""} onChange={(e) => updateField("province", e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-5 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <legend className="px-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Parents / Guardian</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelClass}>
                <span>Father's Name</span>
                <input className={inputClass} value={formData.fathersName || ""} onChange={(e) => updateField("fathersName", e.target.value)} />
              </label>
              <label className={labelClass}>
                <span>Mother's Maiden Name</span>
                <input className={inputClass} value={formData.mothersMaidenName || ""} onChange={(e) => updateField("mothersMaidenName", e.target.value)} />
              </label>
              <label className={labelClass}>
                <span>Guardian Name</span>
                <input className={inputClass} value={formData.guardianName || ""} onChange={(e) => updateField("guardianName", e.target.value)} />
              </label>
              <label className={labelClass}>
                <span>Relationship to Learner</span>
                <input className={inputClass} value={formData.guardianRelationship || ""} onChange={(e) => updateField("guardianRelationship", e.target.value)} />
              </label>
            </div>
          </fieldset>

          <label className={`${labelClass} mt-5`}>
            <span>Remarks</span>
            <textarea
              className={`${inputClass} min-h-[70px] resize-y`}
              value={formData.remarks || ""}
              onChange={(e) => updateField("remarks", e.target.value)}
            />
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
            disabled={isSaving || isProcessingPhoto}
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
