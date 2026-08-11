# LIKHA-SIS — Full Project Export
**Learner Information & Knowledge Hub Administrative System — Tingub National High School**

> Exported for import into another AI tool. Generated from an active Claude conversation on 2026-08-11.
> ⚠️ See the "Reconstruction Notice" flags below — some files were written directly by Cline (a VS Code coding agent) and were never pasted back into this chat verbatim. Those are reconstructed from task instructions and should be verified against the actual repo before trusting them as ground truth.

---

## 1. System / Custom Instructions

> These are the active guidelines that should govern how an AI assistant behaves in this project.

### 1.1 Assistant Role
- Acts as **dual Product Manager + System Architect**.
- The human (FranzShin) is a **beginner developer with no prior coding experience**. Explanations should avoid overwhelming jargon and use simple analogies when introducing new concepts.
- The assistant guides decisions AND implementation, but actual code generation is delegated to **Cline** (a VS Code AI coding extension), not typed manually by the human.

### 1.2 Code Output Rules (original ground rules for this project)
1. **Modular & Complete** — provide complete, runnable code, not placeholder comments like `// insert logic here`.
2. **Explain the "Why"** — briefly explain what code does and where it goes.
3. **One Step at a Time** — one feature/file per response, not a whole multi-file project at once.
4. **Error Prevention** — basic error handling and input validation included by default.

### 1.3 Cline Workflow Rules (added later, supersedes manual code-pasting)
> These are the current standard operating rules for this project going forward.

- For LIKHA-SIS coding tasks, **write task prompts formatted for Cline** (concise, structured, copy-paste ready) instead of writing out full code directly in chat — this saves tokens.
- Cline task prompts should **always be formatted as plain text in a single code block** (no markdown bold/headers inside the block itself) so the user can easily copy-paste the whole thing.
- Standard Cline prompt structure: **Goal** (one line) → **File(s)** (exact paths) → **Instructions** (numbered steps) → **Constraints** (explicit things NOT to change).
- **Auto-approve must stay OFF in Cline** — every diff must be reviewed before approval, especially since Cline runs on a free/less predictable model (`nvidia/nemotron-3-ultra-550b-a55b:free` via OpenRouter).
- Git commit checkpoints after every completed, tested feature — non-negotiable safety net for a beginner solo dev.

### 1.4 Domain/Authenticity Rule
- All official DepEd form fields (e.g. School Form 1) must match the **official DepEd template exactly** — reference real templates directly rather than guessing field names/layout.
- Certificates (Certificate of Enrollment, Good Moral) do **not** have one single rigid DepEd-mandated template — schools customize wording on their own letterhead. Standard "This is to certify that..." convention is used, meant to be edited later to match the school registrar's actual phrasing.

---

## 2. Core Artifacts & Code

> Full file contents as of the latest point in this conversation. Files marked 🟢 **VERIFIED** were pasted back into the chat after being built/edited. Files marked 🟡 **RECONSTRUCTED** were written by Cline directly in the project and are rebuilt here from the task instructions given to it — confirm against the real repo before relying on these.

### 2.1 🟢 VERIFIED — `src/SF1.jsx`
School Form 1 — Learner's Information Sheet, core + expandable extended fields.

```jsx
// src/SF1.jsx
// School Form 1 — Learner's Information Sheet (core fields version).
// Teachers can add multiple learners in a table, then save the whole class list at once.

import { useState } from "react";
import { Fragment } from "react";
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
    // Extended fields for learner details (expandable section)
    houseStreetSitio: "",
    barangay: "",
    municipalityCity: "",
    province: "",
    fathersName: "",
    mothersMaidenName: "",
    guardianName: "",
    guardianRelationship: "",
    remarks: "",
  };
}

function SF1({ user, goBack }) {
  const [gradeLevel, setGradeLevel] = useState("");
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [learners, setLearners] = useState([createBlankLearner()]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

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

  function toggleExpand(index) {
    const next = new Set(expandedRows);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setExpandedRows(next);
  }

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
    const lrns = learners.map((l) => l.lrn.trim());
    const hasDuplicates = new Set(lrns).size !== lrns.length;
    if (hasDuplicates) {
      return "Two or more rows have the same LRN. Each learner needs a unique LRN.";
    }
    return null;
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
      for (const learner of learners) {
        await addDoc(collection(db, "learners"), {
          ...learner,
          age: calculateAge(learner.birthDate),
          gradeLevel,
          section,
          schoolYear,
          addedByTeacherEmail: user.email,
          createdAt: serverTimestamp(),
        });
      }
      setStatusMessage(`Successfully saved ${learners.length} learner(s)!`);
      setLearners([createBlankLearner()]);
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
            <th style={cellStyle}>▼</th>
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
            <Fragment key={index}>
              <tr>
                <td style={cellStyle}>
                  <button
                    style={{ padding: "2px 8px", fontSize: "12px", cursor: "pointer" }}
                    onClick={() => toggleExpand(index)}
                    aria-label={expandedRows.has(index) ? "Collapse details" : "Expand details"}
                  >
                    {expandedRows.has(index) ? "▼" : "▶"}
                  </button>
                </td>
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

              {expandedRows.has(index) && (
                <tr style={{ background: "#f7fafd" }}>
                  <td style={cellStyle}></td>
                  <td colSpan={9} style={{ ...cellStyle, padding: "12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>

                      <fieldset style={{ flex: "1 1 300px", minWidth: "280px", border: "1px solid #ddd", borderRadius: "4px", padding: "8px" }}>
                        <legend style={{ fontWeight: "bold", color: "#333" }}>Address</legend>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" }}>
                            House / Street / Sitio
                            <input style={inputStyle} value={learner.houseStreetSitio}
                              onChange={(e) => updateLearner(index, "houseStreetSitio", e.target.value)} />
                          </label>
                          <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" }}>
                            Barangay
                            <input style={inputStyle} value={learner.barangay}
                              onChange={(e) => updateLearner(index, "barangay", e.target.value)} />
                          </label>
                          <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" }}>
                            Municipality / City
                            <input style={inputStyle} value={learner.municipalityCity}
                              onChange={(e) => updateLearner(index, "municipalityCity", e.target.value)} />
                          </label>
                          <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" }}>
                            Province
                            <input style={inputStyle} value={learner.province}
                              onChange={(e) => updateLearner(index, "province", e.target.value)} />
                          </label>
                        </div>
                      </fieldset>

                      <fieldset style={{ flex: "1 1 280px", minWidth: "260px", border: "1px solid #ddd", borderRadius: "4px", padding: "8px" }}>
                        <legend style={{ fontWeight: "bold", color: "#333" }}>Parents</legend>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" }}>
                            Father's Name
                            <input style={inputStyle} value={learner.fathersName}
                              onChange={(e) => updateLearner(index, "fathersName", e.target.value)} />
                          </label>
                          <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" }}>
                            Mother's Maiden Name
                            <input style={inputStyle} value={learner.mothersMaidenName}
                              onChange={(e) => updateLearner(index, "mothersMaidenName", e.target.value)} />
                          </label>
                        </div>
                      </fieldset>

                      <fieldset style={{ flex: "1 1 280px", minWidth: "260px", border: "1px solid #ddd", borderRadius: "4px", padding: "8px" }}>
                        <legend style={{ fontWeight: "bold", color: "#333" }}>Guardian (if not parent)</legend>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" }}>
                            Guardian Name
                            <input style={inputStyle} value={learner.guardianName}
                              onChange={(e) => updateLearner(index, "guardianName", e.target.value)} />
                          </label>
                          <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" }}>
                            Relationship to Learner
                            <input style={inputStyle} value={learner.guardianRelationship}
                              onChange={(e) => updateLearner(index, "guardianRelationship", e.target.value)} />
                          </label>
                        </div>
                      </fieldset>

                      <fieldset style={{ flex: "1 1 280px", minWidth: "260px", border: "1px solid #ddd", borderRadius: "4px", padding: "8px" }}>
                        <legend style={{ fontWeight: "bold", color: "#333" }}>Remarks</legend>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" }}>
                            Remarks (indicator codes, notes, etc.)
                            <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={learner.remarks}
                              onChange={(e) => updateLearner(index, "remarks", e.target.value)} />
                          </label>
                        </div>
                      </fieldset>

                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
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
```

---

### 2.2 🟡 RECONSTRUCTED — `src/ViewLearners.jsx`
Base version was verified in chat; the Edit button + modal wiring were applied by Cline per task instructions and NOT pasted back. This reconstruction merges the verified base with the described diff.

```jsx
// src/ViewLearners.jsx
// Read-only view screen for saved learners from Firestore.
// Teachers can see all learners, filter by Grade & Section, edit, and delete entries.

import { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import EditLearnerModal from "./EditLearnerModal";

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

function ViewLearners({ user, goBack }) {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState("All");
  const [errorMessage, setErrorMessage] = useState("");
  // editingLearner: holds the learner object currently open in the Edit modal.
  // null means the modal is closed.
  const [editingLearner, setEditingLearner] = useState(null);

  useEffect(() => {
    async function fetchLearners() {
      try {
        const learnersRef = collection(db, "learners");
        const snapshot = await getDocs(learnersRef);
        const fetchedLearners = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setLearners(fetchedLearners);
      } catch (err) {
        console.error("Failed to fetch learners:", err);
        setErrorMessage("Could not load learners. Please check your connection and refresh.");
      } finally {
        setLoading(false);
      }
    }
    fetchLearners();
  }, []);

  const gradeSectionOptions = ["All", ...Array.from(
    new Set(
      learners
        .filter((l) => l.gradeLevel && l.section)
        .map((l) => `${l.gradeLevel} - ${l.section}`)
    )
  ).sort()];

  const filteredLearners = filterValue === "All"
    ? learners
    : learners.filter((l) => `${l.gradeLevel} - ${l.section}` === filterValue);

  async function handleDelete(learnerId) {
    if (!confirm("Delete this learner permanently?")) return;

    try {
      await deleteDoc(doc(db, "learners", learnerId));
      setLearners((prev) => prev.filter((l) => l.id !== learnerId));
      setErrorMessage("");
    } catch (err) {
      console.error("Delete failed:", err);
      setErrorMessage("Failed to delete. Please check your connection and try again.");
      setTimeout(() => setErrorMessage(""), 5000);
    }
  }

  const cellStyle = { border: "1px solid #ccc", padding: "6px", textAlign: "left" };
  const selectStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "4px",
    fontSize: "14px",
  };

  if (loading) {
    return (
      <div style={{ fontFamily: "sans-serif", maxWidth: "1100px", margin: "40px auto", padding: "0 16px" }}>
        <button onClick={goBack} style={{ marginBottom: "16px", padding: "8px 16px", cursor: "pointer" }}>
          ← Back to Dashboard
        </button>
        <p style={{ textAlign: "center", color: "#555", fontSize: "18px" }}>Loading learners...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "1100px", margin: "40px auto", padding: "0 16px" }}>
      <button
        onClick={goBack}
        style={{
          marginBottom: "16px",
          padding: "8px 16px",
          cursor: "pointer",
          background: "#f0f0f0",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ marginBottom: "4px" }}>Saved Learners</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Logged in as: <strong>{user.email}</strong>
      </p>
      <p style={{ color: "#555", marginTop: 0 }}>
        Viewing {filteredLearners.length} of {learners.length} learner(s)
      </p>

      {errorMessage && (
        <p style={{ color: "red", marginTop: "12px", marginBottom: "12px" }}>{errorMessage}</p>
      )}

      <div style={{ marginBottom: "16px", maxWidth: "300px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
          Filter by Grade & Section
        </label>
        <select
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          style={selectStyle}
        >
          {gradeSectionOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {filteredLearners.length === 0 && (
        <p style={{ textAlign: "center", color: "#777", marginTop: "40px", fontSize: "16px" }}>
          {learners.length === 0
            ? "No learners saved yet."
            : "No learners match the selected filter."}
        </p>
      )}

      {filteredLearners.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={cellStyle}>LRN</th>
                <th style={cellStyle}>Last Name</th>
                <th style={cellStyle}>First Name</th>
                <th style={cellStyle}>Sex</th>
                <th style={cellStyle}>Age</th>
                <th style={cellStyle}>Grade Level</th>
                <th style={cellStyle}>Section</th>
                <th style={cellStyle}>Learning Modality</th>
                <th style={cellStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLearners.map((l) => (
                <tr key={l.id}>
                  <td style={cellStyle}>{l.lrn || ""}</td>
                  <td style={cellStyle}>{l.lastName || ""}</td>
                  <td style={cellStyle}>{l.firstName || ""}</td>
                  <td style={cellStyle}>{l.sex || ""}</td>
                  <td style={cellStyle}>{calculateAge(l.birthDate)}</td>
                  <td style={cellStyle}>{l.gradeLevel || ""}</td>
                  <td style={cellStyle}>{l.section || ""}</td>
                  <td style={cellStyle}>{l.learningModality || ""}</td>
                  <td style={cellStyle}>
                    <button
                      onClick={() => setEditingLearner(l)}
                      style={{
                        padding: "4px 10px",
                        marginRight: "6px",
                        background: "#e3f2fd",
                        color: "#1565c0",
                        border: "1px solid #90caf9",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(l.id)}
                      style={{
                        padding: "4px 10px",
                        background: "#ffebee",
                        color: "#c62828",
                        border: "1px solid #ef9a9a",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingLearner && (
        <EditLearnerModal
          learner={editingLearner}
          onClose={() => setEditingLearner(null)}
          onSaved={(updatedLearner) => {
            setLearners((prev) =>
              prev.map((l) => (l.id === updatedLearner.id ? updatedLearner : l))
            );
            setEditingLearner(null);
          }}
        />
      )}
    </div>
  );
}

export default ViewLearners;
```

---

### 2.3 🟢 VERIFIED — `src/EditLearnerModal.jsx`
Written directly by Claude and confirmed working after manual test (edit + Firestore persistence both passed).

```jsx
// src/EditLearnerModal.jsx
// A popup form for editing one existing learner's data.
// Appears on top of ViewLearners.jsx when the teacher clicks "Edit" on a row.

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

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

function EditLearnerModal({ learner, onClose, onSaved }) {
  const [formData, setFormData] = useState({ ...learner });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

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
      delete updatedFields.id;

      await updateDoc(learnerRef, updatedFields);

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
```

---

### 2.4 🟡 RECONSTRUCTED — `src/schoolConfig.js`
Written by Cline per task instructions; only a summary was reported back, not the literal file.

```js
// src/schoolConfig.js
// Central place for school-identity details used across generated documents
// (certificates, forms, etc.). Edit these values once — every document
// that imports this file updates automatically.

const schoolConfig = {
  schoolName: "Tingub National High School",
  schoolAddress: "Tingub, [City/Municipality], Cebu",
  divisionName: "Department of Education - Division of [Division Name]",
  principalName: "[Principal Full Name]",
  principalPosition: "School Principal",
};

export default schoolConfig;
```

---

### 2.5 🟡 RECONSTRUCTED — `src/CertificateGenerator.jsx`
Written by Cline per task instructions; only a summary was reported back, not the literal file. This reconstruction follows the spec closely but exact class names, spacing, or minor implementation choices Cline made independently may differ from the real file.

```jsx
// src/CertificateGenerator.jsx
// Generates a printable Certificate of Enrollment or Good Moral Certificate
// using existing learner data already saved in Firestore.

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import schoolConfig from "./schoolConfig";

function todayISO() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function formatDateLong(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function CertificateGenerator({ user, goBack }) {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [certificateType, setCertificateType] = useState("Certificate of Enrollment");
  const [purpose, setPurpose] = useState("");
  const [dateIssued, setDateIssued] = useState(todayISO());

  useEffect(() => {
    async function fetchLearners() {
      try {
        const snapshot = await getDocs(collection(db, "learners"));
        const fetched = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setLearners(fetched);
      } catch (err) {
        console.error("Failed to fetch learners:", err);
        setErrorMessage("Could not load learners. Please check your connection and refresh.");
      } finally {
        setLoading(false);
      }
    }
    fetchLearners();
  }, []);

  const selectedLearner = learners.find((l) => l.id === selectedLearnerId) || null;
  const canPrint = Boolean(selectedLearner) && purpose.trim().length > 0;

  function handlePrint() {
    if (!canPrint) return;
    window.print();
  }

  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "6px", fontSize: "14px" };
  const labelStyle = { display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", fontWeight: "bold" };

  function renderBody() {
    if (!selectedLearner) return null;
    const fullName = `${selectedLearner.firstName || ""} ${selectedLearner.middleName || ""} ${selectedLearner.lastName || ""}`.replace(/\s+/g, " ").trim();
    const grade = selectedLearner.gradeLevel || "____";
    const section = selectedLearner.section || "____";
    const schoolYear = selectedLearner.schoolYear || "____-____";

    if (certificateType === "Certificate of Enrollment") {
      return (
        <p style={{ textAlign: "justify", lineHeight: 1.8 }}>
          This is to certify that <strong>{fullName}</strong>, a bona fide learner of this school,
          is currently enrolled in <strong>Grade {grade}, Section {section}</strong> for
          School Year <strong>{schoolYear}</strong>.
          <br /><br />
          This certification is issued upon the request of the above-named learner
          {purpose ? <> for <strong>{purpose}</strong></> : null}, this{" "}
          <strong>{formatDateLong(dateIssued)}</strong> at {schoolConfig.schoolName}.
        </p>
      );
    }

    return (
      <p style={{ textAlign: "justify", lineHeight: 1.8 }}>
        This is to certify that <strong>{fullName}</strong>, a learner of this school
        currently enrolled in <strong>Grade {grade}, Section {section}</strong> for
        School Year <strong>{schoolYear}</strong>, has shown good moral character and
        satisfactory behavior during his/her stay in this school.
        <br /><br />
        This certification is issued upon the request of the above-named learner
        {purpose ? <> for <strong>{purpose}</strong></> : null}, this{" "}
        <strong>{formatDateLong(dateIssued)}</strong> at {schoolConfig.schoolName}.
      </p>
    );
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "sans-serif", maxWidth: "900px", margin: "40px auto", padding: "0 16px" }}>
        <button onClick={goBack} style={{ marginBottom: "16px", padding: "8px 16px", cursor: "pointer" }}>
          ← Back to Dashboard
        </button>
        <p style={{ textAlign: "center", color: "#555", fontSize: "18px" }}>Loading learners...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "900px", margin: "40px auto", padding: "0 16px" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>

      <button onClick={goBack} className="no-print" style={{ marginBottom: "16px", padding: "8px 16px", cursor: "pointer" }}>
        ← Back to Dashboard
      </button>

      <h1 className="no-print" style={{ marginBottom: "4px" }}>Certificate Generator</h1>
      <p className="no-print" style={{ color: "#555", marginTop: 0 }}>
        Logged in as: <strong>{user.email}</strong>
      </p>

      {errorMessage && (
        <p className="no-print" style={{ color: "red" }}>{errorMessage}</p>
      )}

      <div className="no-print" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <label style={labelStyle}>
          Learner
          <select
            style={inputStyle}
            value={selectedLearnerId}
            onChange={(e) => setSelectedLearnerId(e.target.value)}
          >
            <option value="">-- Select a learner --</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lastName}, {l.firstName} — Grade {l.gradeLevel}, Section {l.section}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Certificate Type
          <select style={inputStyle} value={certificateType} onChange={(e) => setCertificateType(e.target.value)}>
            <option>Certificate of Enrollment</option>
            <option>Good Moral Certificate</option>
          </select>
        </label>

        <label style={labelStyle}>
          Purpose
          <input
            style={inputStyle}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. scholarship application"
          />
        </label>

        <label style={labelStyle}>
          Date Issued
          <input
            style={inputStyle}
            type="date"
            value={dateIssued}
            onChange={(e) => setDateIssued(e.target.value)}
          />
        </label>
      </div>

      <div
        style={{
          border: "1px solid #ccc",
          padding: "40px",
          fontFamily: "Georgia, 'Times New Roman', serif",
          background: "white",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <p style={{ margin: 0, fontWeight: "bold" }}>{schoolConfig.divisionName}</p>
          <p style={{ margin: 0, fontWeight: "bold" }}>{schoolConfig.schoolName}</p>
          <p style={{ margin: 0 }}>{schoolConfig.schoolAddress}</p>
        </div>

        <h2 style={{ textAlign: "center", letterSpacing: "1px", marginBottom: "32px" }}>
          {certificateType === "Certificate of Enrollment"
            ? "CERTIFICATE OF ENROLLMENT"
            : "GOOD MORAL CHARACTER CERTIFICATE"}
        </h2>

        {selectedLearner ? renderBody() : (
          <p style={{ textAlign: "center", color: "#999" }}>Select a learner to preview the certificate.</p>
        )}

        <div style={{ marginTop: "60px", textAlign: "right" }}>
          <p style={{ margin: 0, borderTop: "1px solid #333", display: "inline-block", paddingTop: "4px" }}>
            <strong>{schoolConfig.principalName}</strong>
          </p>
          <p style={{ margin: 0 }}>{schoolConfig.principalPosition}</p>
        </div>
      </div>

      <button
        onClick={handlePrint}
        disabled={!canPrint}
        className="no-print"
        style={{
          marginTop: "16px",
          padding: "10px 20px",
          cursor: canPrint ? "pointer" : "not-allowed",
          background: canPrint ? "#1976d2" : "#ccc",
          color: "white",
          border: "none",
          borderRadius: "4px",
        }}
      >
        Print Certificate
      </button>
      {!canPrint && (
        <p className="no-print" style={{ fontSize: "13px", color: "#888", marginTop: "6px" }}>
          Select a learner and enter a Purpose to enable printing.
        </p>
      )}
    </div>
  );
}

export default CertificateGenerator;
```

---

### 2.6 🟢 VERIFIED (pre-Certificates-wiring) — `src/App.jsx`
This is the last version pasted into chat. A Cline task to add a `"certificates"` page branch and `goToCertificates` prop was issued but **not yet confirmed complete** at time of export.

```jsx
// src/App.jsx
// Traffic controller: handles Login, Dashboard, SF1, and ViewLearners screens
// based on login state + which page is selected.

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import Dashboard from "./Dashboard";
import SF1 from "./SF1";
import ViewLearners from "./ViewLearners";

function App() {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [currentPage, setCurrentPage] = useState("dashboard"); // "dashboard", "sf1", or "viewLearners"

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsChecking(false);
    });
    return () => unsubscribe();
  }, []);

  if (isChecking) {
    return <p style={{ textAlign: "center", marginTop: "80px" }}>Loading...</p>;
  }

  if (!user) {
    return <Login />;
  }

  if (currentPage === "sf1") {
    return <SF1 user={user} goBack={() => setCurrentPage("dashboard")} />;
  }

  if (currentPage === "viewLearners") {
    return <ViewLearners user={user} goBack={() => setCurrentPage("dashboard")} />;
  }

  return (
    <Dashboard
      user={user}
      goToSF1={() => setCurrentPage("sf1")}
      goToViewLearners={() => setCurrentPage("viewLearners")}
    />
  );
}

export default App;
```

> ⚠️ **Pending change (Cline task issued, not yet confirmed):** add `import CertificateGenerator from "./CertificateGenerator";`, a `currentPage === "certificates"` branch rendering `<CertificateGenerator user={user} goBack={...} />`, and a `goToCertificates` prop passed to `<Dashboard>`.

---

### 2.7 🟢 VERIFIED (pre-Certificates-wiring) — `src/Dashboard.jsx`
Same caveat as above — a Cline task to make "Certificates" clickable was issued but not yet confirmed complete.

```jsx
// src/Dashboard.jsx
// This is the main screen teachers see after logging in.
// Right now it just shows a welcome message and placeholder menu —
// each menu item will become a real feature (forms, ID generator, etc.) in later phases.

import { signOut } from "firebase/auth";
import { auth } from "./firebase";

function Dashboard({ user, goToSF1, goToViewLearners }) {
  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const menuItems = [
    "School Form 1 (Learner's Info)",
    "School Form 2 (Attendance)",
    "Certificates",
    "School Monitoring",
    "Evaluation & Assessment",
    "Anecdotal Records",
    "ID Generator (QR Code)",
    "Grade Data",
  ];

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "700px", margin: "40px auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ marginBottom: "4px" }}>LIKHA-SIS Dashboard</h1>
          <p style={{ color: "#555", marginTop: 0 }}>
            Logged in as: <strong>{user.email}</strong>
          </p>
        </div>
        <button onClick={handleLogout} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Log Out
        </button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h2>School Forms & Tools</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {menuItems.map((item) => {
          const isSF1 = item.startsWith("School Form 1");
          return (
            <li
              key={item}
              onClick={isSF1 ? goToSF1 : undefined}
              style={{
                padding: "12px",
                marginBottom: "8px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                color: isSF1 ? "#000" : "#999",
                cursor: isSF1 ? "pointer" : "default",
                background: isSF1 ? "#eef6ff" : "transparent",
              }}
            >
              {item} {!isSF1 && <span style={{ fontSize: "12px" }}>(coming soon)</span>}
            </li>
          );
        })}
      </ul>
      <button
        onClick={goToViewLearners}
        style={{ marginTop: "16px", padding: "10px 16px", cursor: "pointer" }}
      >
        📋 View Saved Learners
      </button>
    </div>
  );
}

export default Dashboard;
```

> ⚠️ **Pending change (Cline task issued, not yet confirmed):** add `goToCertificates` prop, generalize the click-handling logic so both "School Form 1" and "Certificates" items are clickable with the active styling, leaving all other items as greyed-out placeholders.

---

### 2.8 Not included in this export (not built yet in chat)
- `src/firebase.js` — exists per checklist, contents never pasted into this chat
- `src/Login.jsx` — exists per checklist, contents never pasted into this chat
- Firestore security rules — described as "locked down, requires auth" per spec, exact rules text never pasted into this chat

---

## 3. Project Context & Knowledge Base

### 3.1 What LIKHA-SIS is
A web-based school management system for **Tingub National High School** (DepEd Philippines), giving teachers a single dashboard to manage School Forms 1–10, certificates, monitoring/evaluation tools, anecdotal records, ID generation with QR codes, and grade data — usable online or offline, on Windows, Android, or any browser.

### 3.2 Who it's for
- **Teachers** — primary daily users (log in, fill/manage forms and records)
- **Principal** — oversight, monitoring, evaluation access
- **Parents** — limited, likely view-only access, planned for a later phase

### 3.3 Problem being solved
DepEd has no unified digital system for these school forms/records — everything is currently manual/paper-based or scattered across separate files. LIKHA-SIS centralizes it into one accessible system.

### 3.4 Architecture decisions & rationale

| Decision | Reasoning |
|---|---|
| **PWA** (Progressive Web App) instead of 3 separate native apps | One React codebase serves Windows, Android, and web with offline capability. Massively less to build/maintain for a solo beginner dev, at the cost of a slightly less "native" feel than a true .exe/.apk. |
| **Firebase** (Auth + Firestore + Hosting) over custom backend | No server budget. Firebase free tier covers authentication, database, and hosting. Firestore has **built-in offline sync**, solving the "no internet at school" problem directly. |
| **React + Vite** for frontend | Reusable components reduce repeated code as 10+ DepEd forms get added over time. |
| Cline (VS Code AI agent) + free OpenRouter model for implementation | Reduces reliance on manually pasting code; Claude plans + writes task prompts, Cline implements, human reviews diffs before approving. |

### 3.5 Key domain/data rules
- **DepEd forms** (like SF1) must match the **official DepEd template fields exactly** — an actual SF1 Excel template was referenced directly, not guessed.
- **LRN (Learner Reference Number)** must be exactly 12 digits, validated on save/edit, and must be unique within a batch.
- **Age** is calculated client-side from birth date; officially DepEd calculates age "as of the 1st Friday of June," but the current implementation uses "age as of today" as a simplified placeholder — flagged as a possible future refinement, not yet corrected.
- **Certificates** (Enrollment, Good Moral) do NOT follow one fixed DepEd template — schools customize wording on their own letterhead. Current implementation uses a standard "This is to certify that..." convention that should be adjusted later to match the actual registrar's phrasing at Tingub NHS.
- **Certificate signatory info** (principal name/position, school name/address/division) is intentionally a **fixed config file** (`schoolConfig.js`), not a per-certificate input — edited directly in code when it needs to change, no settings UI built for this yet.
- **Printing** for certificates uses the browser's native `window.print()` / Save-as-PDF — deliberately avoiding any paid or complex PDF-generation library, consistent with the free-tier-only constraint.

### 3.6 Firestore data shape (as established in code)
`learners` collection — one document per learner, per class list save:
```
{
  lrn: string (12 digits),
  lastName: string,
  firstName: string,
  middleName: string,
  sex: "M" | "F",
  birthDate: string (YYYY-MM-DD),
  age: number (calculated at save time),
  learningModality: "Face to Face" | "Blended" | "Online" | "Modular",
  houseStreetSitio: string,
  barangay: string,
  municipalityCity: string,
  province: string,
  fathersName: string,
  mothersMaidenName: string,
  guardianName: string,
  guardianRelationship: string,
  remarks: string,
  gradeLevel: string,
  section: string,
  schoolYear: string,
  addedByTeacherEmail: string,
  createdAt: Firestore server timestamp
}
```

### 3.7 Security posture
- `learners` collection requires `request.auth != null` for ANY read/write (must be logged in).
- All other/future Firestore collections default to fully blocked until explicit rules are added (secure-by-default pattern).
- Still TODO: role-based rules (e.g. restrict delete to certain account types) once more than one teacher account type exists.

### 3.8 Constraints to keep in mind
- No school server/database budget → must stay on free tiers indefinitely.
- Beginner developer, no prior coding background → every step needs plain-language explanation.
- Limited daily AI token quota → work in small, complete, testable slices; never regenerate the whole project at once.

---

## 4. Current State & Next Steps

### 4.1 What's fully built, tested, and working
- Teacher login/logout via Firebase Auth
- Protected dashboard with navigation
- **School Form 1 (SF1)** — full core fields + expandable extended detail rows (address, parents/guardian, remarks), spreadsheet-style batch entry, validation, save to Firestore
- **View Saved Learners** screen — grade/section filtering, delete
- **Edit Saved Learner** — modal-based edit, confirmed working end-to-end including Firestore persistence (tested and passed)
- Locked-down Firestore security rules requiring authentication

**➡️ Phase 2 (School Form 1) is complete.**

### 4.2 In progress (Phase 3 — started)
Phase 3 scope chosen by the user: **Certificate of Enrollment**, **Good Moral Certificate**, and **School Form 2 (Daily Attendance)** — sequenced as certificates first (simpler, reuse existing learner data), then SF2 attendance grid (more complex, deserves its own dedicated design pass).

- `schoolConfig.js` and `CertificateGenerator.jsx` were built by Cline per detailed task instructions (form + live printable preview + `window.print()` support for both certificate types) — build succeeded, lint passed, constrained files untouched, per Cline's own report. **Not yet manually browser-tested** by the user (a manual preview test was suggested but the user pivoted to wiring instead before confirming the render/print visually).
- A second Cline task prompt was just issued to wire `CertificateGenerator` into navigation:
  - `App.jsx`: add import, add `currentPage === "certificates"` branch, add `goToCertificates` prop to `<Dashboard>`
  - `Dashboard.jsx`: add `goToCertificates` prop, generalize menu click logic so "Certificates" (not just SF1) is clickable with active styling
  - **This task's completion has not yet been confirmed in chat** — this is the very next thing to check.

### 4.3 Immediate next steps (in order)
1. **Confirm the navigation-wiring Cline task completed successfully** (build passes, only the 2 intended files touched).
2. **Manually test the full Certificates flow through the real Dashboard** — click "Certificates" → verify the form + live certificate preview render correctly → select a learner, type a Purpose → verify **Print Preview** (Ctrl/Cmd+P) shows ONLY the certificate (no form, no buttons) → confirm both certificate types (Enrollment and Good Moral) render distinct, correct wording.
3. Once confirmed working, **Git commit** this checkpoint (e.g. `"Phase 3: add Certificate of Enrollment & Good Moral certificate generator"`).
4. Move to **School Form 2 (Daily Attendance)** — flagged as the most complex item in this phase (a learner × school-day grid with daily check-off input and monthly rollup). This needs its own dedicated scoping/design conversation before writing a Cline task prompt — do not attempt to scope it in the same breath as the certificates.
5. Longer-term roadmap beyond current phase: Phase 4 (School ID generator + QR code), Phase 5 (monitoring, evaluation, anecdotal records, remaining forms), Phase 6 (grade data module), Phase 7 (PWA packaging + parent view-only access).

### 4.4 Known gaps / things to revisit later (not blocking, just noted)
- Age calculation uses "as of today" instead of DepEd's official "as of 1st Friday of June" rule.
- Certificate wording is generic/standard, not yet matched against Tingub NHS's actual registrar phrasing (no template was available to reference, unlike SF1).
- `schoolConfig.js` placeholder values (school address, division name, principal name) need to be filled in with real details before certificates are used for real students.
- No role-based Firestore rules yet (single teacher-account-type security model only).
- `App.jsx`/`Dashboard.jsx` current file contents in this export reflect the **pre-Certificates-wiring** state — re-sync with actual repo once that Cline task is confirmed done.

---

*End of export.*
