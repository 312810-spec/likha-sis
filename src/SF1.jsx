// src/SF1.jsx
// School Form 1 — Learner's Information Sheet (core fields version).
// Teachers can add multiple learners in a table, then save the whole class list at once.

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// Calculates age from a birth date string (YYYY-MM-DD), as of today.
// Note: official DepEd age is "as of 1st Friday of June" — we're using today's date
// as a simple starting point; we can refine this exact rule later if needed.
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

// One empty learner row, used whenever we add a new blank row to the table.
function createBlankLearner() {
  return {
    lrn: "",
    lastName: "",
    firstName: "",
    middleName: "",
    sex: "",
    birthDate: "",
    learningModality: "Face to Face",
  };
}

function SF1({ user, goBack }) {
  const [gradeLevel, setGradeLevel] = useState("");
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [learners, setLearners] = useState([createBlankLearner()]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Updates one field in one row, without touching the others.
  function updateLearner(index, field, value) {
    const updated = [...learners];
    updated[index] = { ...updated[index], [field]: value };
    setLearners(updated);
  }

  function addRow() {
    setLearners([...learners, createBlankLearner()]);
  }

  function removeRow(index) {
    setLearners(learners.filter((_, i) => i !== index));
  }

  // Checks everything is filled in correctly before we try saving to Firebase.
  function validateLearners() {
    if (!gradeLevel.trim() || !section.trim()) {
      return "Please fill in Grade Level and Section before saving.";
    }
    for (let i = 0; i < learners.length; i++) {
      const l = learners[i];
      if (!l.lrn.trim() || !l.lastName.trim() || !l.firstName.trim() || !l.sex || !l.birthDate) {
        return `Row ${i + 1}: LRN, Last Name, First Name, Sex, and Birth Date are all required.`;
      }
      if (!/^\d{12}$/.test(l.lrn.trim())) {
        return `Row ${i + 1}: LRN must be exactly 12 digits.`;
      }
    }
    // Check for duplicate LRNs within this batch
    const lrns = learners.map((l) => l.lrn.trim());
    const hasDuplicates = new Set(lrns).size !== lrns.length;
    if (hasDuplicates) {
      return "Two or more rows have the same LRN. Each learner needs a unique LRN.";
    }
    return null; // no errors
  }

  async function handleSaveAll() {
    const validationError = validateLearners();
    if (validationError) {
      setStatusMessage(validationError);
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      // Save each learner as its own document in the "learners" collection.
      for (const learner of learners) {
        await addDoc(collection(db, "learners"), {
          ...learner,
          age: calculateAge(learner.birthDate),
          gradeLevel,
          section,
          schoolYear,
          addedByTeacherEmail: user.email,
          createdAt: serverTimestamp(), // Firebase stamps the exact save time automatically
        });
      }
      setStatusMessage(`Successfully saved ${learners.length} learner(s)!`);
      setLearners([createBlankLearner()]); // reset the table after a successful save
    } catch (error) {
      console.error("Error saving learners:", error);
      setStatusMessage("Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "1000px", margin: "30px auto", padding: "0 16px" }}>
      <button onClick={goBack} style={{ marginBottom: "12px" }}>← Back to Dashboard</button>
      <h1>School Form 1 — Learner's Information Sheet</h1>

      <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
        <div>
          <label>Grade Level</label><br />
          <input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="e.g. Grade 10" />
        </div>
        <div>
          <label>Section</label><br />
          <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Kindness" />
        </div>
        <div>
          <label>School Year</label><br />
          <input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} placeholder="e.g. 2026-2027" />
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={cellStyle}>LRN (12 digits)</th>
            <th style={cellStyle}>Last Name</th>
            <th style={cellStyle}>First Name</th>
            <th style={cellStyle}>Middle Name</th>
            <th style={cellStyle}>Sex</th>
            <th style={cellStyle}>Birth Date</th>
            <th style={cellStyle}>Age</th>
            <th style={cellStyle}>Learning Modality</th>
            <th style={cellStyle}></th>
          </tr>
        </thead>
        <tbody>
          {learners.map((learner, index) => (
            <tr key={index}>
              <td style={cellStyle}>
                <input style={inputStyle} value={learner.lrn} maxLength={12}
                  onChange={(e) => updateLearner(index, "lrn", e.target.value.replace(/\D/g, ""))} />
              </td>
              <td style={cellStyle}>
                <input style={inputStyle} value={learner.lastName}
                  onChange={(e) => updateLearner(index, "lastName", e.target.value)} />
              </td>
              <td style={cellStyle}>
                <input style={inputStyle} value={learner.firstName}
                  onChange={(e) => updateLearner(index, "firstName", e.target.value)} />
              </td>
              <td style={cellStyle}>
                <input style={inputStyle} value={learner.middleName}
                  onChange={(e) => updateLearner(index, "middleName", e.target.value)} />
              </td>
              <td style={cellStyle}>
                <select style={inputStyle} value={learner.sex}
                  onChange={(e) => updateLearner(index, "sex", e.target.value)}>
                  <option value="">--</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </td>
              <td style={cellStyle}>
                <input style={inputStyle} type="date" value={learner.birthDate}
                  onChange={(e) => updateLearner(index, "birthDate", e.target.value)} />
              </td>
              <td style={cellStyle}>{calculateAge(learner.birthDate)}</td>
              <td style={cellStyle}>
                <select style={inputStyle} value={learner.learningModality}
                  onChange={(e) => updateLearner(index, "learningModality", e.target.value)}>
                  <option>Face to Face</option>
                  <option>Blended</option>
                  <option>Online</option>
                  <option>Modular</option>
                </select>
              </td>
              <td style={cellStyle}>
                <button onClick={() => removeRow(index)} disabled={learners.length === 1}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
        <button onClick={addRow}>+ Add Learner Row</button>
        <button onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save All to Database"}
        </button>
      </div>

      {statusMessage && (
        <p style={{ marginTop: "12px", color: statusMessage.startsWith("Successfully") ? "green" : "red" }}>
          {statusMessage}
        </p>
      )}
    </div>
  );
}

const cellStyle = { border: "1px solid #ccc", padding: "6px", textAlign: "left" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "4px" };

export default SF1;