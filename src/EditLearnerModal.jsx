// src/EditLearnerModal.jsx
// A popup form for editing one existing learner's data.
// Appears on top of ViewLearners.jsx when the teacher clicks "Edit" on a row.

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

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

  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "6px", fontSize: "14px" };
  const labelStyle = { display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px", fontWeight: "bold" };

  return (
    // Full-screen semi-transparent backdrop, with the form centered on top.
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "white", borderRadius: "8px", padding: "24px",
          width: "90%", maxWidth: "600px", maxHeight: "85vh", overflowY: "auto",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Edit Learner</h2>

        {errorMessage && (
          <p style={{ color: "red", marginBottom: "12px" }}>{errorMessage}</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label style={labelStyle}>
            LRN (12 digits)
            <input style={inputStyle} value={formData.lrn || ""} maxLength={12}
              onChange={(e) => updateField("lrn", e.target.value.replace(/\D/g, ""))} />
          </label>
          <label style={labelStyle}>
            Sex
            <select style={inputStyle} value={formData.sex || ""} onChange={(e) => updateField("sex", e.target.value)}>
              <option value="">--</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </label>
          <label style={labelStyle}>
            Last Name
            <input style={inputStyle} value={formData.lastName || ""} onChange={(e) => updateField("lastName", e.target.value)} />
          </label>
          <label style={labelStyle}>
            First Name
            <input style={inputStyle} value={formData.firstName || ""} onChange={(e) => updateField("firstName", e.target.value)} />
          </label>
          <label style={labelStyle}>
            Middle Name
            <input style={inputStyle} value={formData.middleName || ""} onChange={(e) => updateField("middleName", e.target.value)} />
          </label>
          <label style={labelStyle}>
            Birth Date
            <input style={inputStyle} type="date" value={formData.birthDate || ""} onChange={(e) => updateField("birthDate", e.target.value)} />
          </label>
          <label style={labelStyle}>
            Grade Level
            <input style={inputStyle} value={formData.gradeLevel || ""} onChange={(e) => updateField("gradeLevel", e.target.value)} />
          </label>
          <label style={labelStyle}>
            Section
            <input style={inputStyle} value={formData.section || ""} onChange={(e) => updateField("section", e.target.value)} />
          </label>
          <label style={labelStyle}>
            Learning Modality
            <select style={inputStyle} value={formData.learningModality || "Face to Face"}
              onChange={(e) => updateField("learningModality", e.target.value)}>
              <option>Face to Face</option>
              <option>Blended</option>
              <option>Online</option>
              <option>Modular</option>
            </select>
          </label>
        </div>

        <fieldset style={{ marginTop: "16px", border: "1px solid #ddd", borderRadius: "4px", padding: "8px" }}>
          <legend style={{ fontWeight: "bold" }}>Address</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={labelStyle}>
              House / Street / Sitio
              <input style={inputStyle} value={formData.houseStreetSitio || ""} onChange={(e) => updateField("houseStreetSitio", e.target.value)} />
            </label>
            <label style={labelStyle}>
              Barangay
              <input style={inputStyle} value={formData.barangay || ""} onChange={(e) => updateField("barangay", e.target.value)} />
            </label>
            <label style={labelStyle}>
              Municipality / City
              <input style={inputStyle} value={formData.municipalityCity || ""} onChange={(e) => updateField("municipalityCity", e.target.value)} />
            </label>
            <label style={labelStyle}>
              Province
              <input style={inputStyle} value={formData.province || ""} onChange={(e) => updateField("province", e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset style={{ marginTop: "16px", border: "1px solid #ddd", borderRadius: "4px", padding: "8px" }}>
          <legend style={{ fontWeight: "bold" }}>Parents / Guardian</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={labelStyle}>
              Father's Name
              <input style={inputStyle} value={formData.fathersName || ""} onChange={(e) => updateField("fathersName", e.target.value)} />
            </label>
            <label style={labelStyle}>
              Mother's Maiden Name
              <input style={inputStyle} value={formData.mothersMaidenName || ""} onChange={(e) => updateField("mothersMaidenName", e.target.value)} />
            </label>
            <label style={labelStyle}>
              Guardian Name
              <input style={inputStyle} value={formData.guardianName || ""} onChange={(e) => updateField("guardianName", e.target.value)} />
            </label>
            <label style={labelStyle}>
              Relationship to Learner
              <input style={inputStyle} value={formData.guardianRelationship || ""} onChange={(e) => updateField("guardianRelationship", e.target.value)} />
            </label>
          </div>
        </fieldset>

        <label style={{ ...labelStyle, marginTop: "16px" }}>
          Remarks
          <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }}
            value={formData.remarks || ""} onChange={(e) => updateField("remarks", e.target.value)} />
        </label>

        <div style={{ marginTop: "20px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={isSaving} style={{ padding: "8px 16px", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ padding: "8px 16px", cursor: "pointer", background: "#1976d2", color: "white", border: "none", borderRadius: "4px" }}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditLearnerModal;