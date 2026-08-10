// src/ViewLearners.jsx
// Read-only view screen for saved learners from Firestore.
// Teachers can see all learners, filter by Grade & Section, and delete entries.

import { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
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

function ViewLearners({ user, goBack }) {
  // learners: array of learner objects from Firestore, each with its document id included.
  const [learners, setLearners] = useState([]);
  // loading: true while we're fetching data from Firestore.
  const [loading, setLoading] = useState(true);
  // filterValue: which grade+section combination the user has selected in the dropdown.
  const [filterValue, setFilterValue] = useState("All");
  // errorMessage: shows a friendly error if delete fails (e.g. network issue).
  const [errorMessage, setErrorMessage] = useState("");

  // On component mount, fetch ALL documents from the "learners" collection in Firestore.
  useEffect(() => {
    async function fetchLearners() {
      try {
        const learnersRef = collection(db, "learners");
        const snapshot = await getDocs(learnersRef);
        // Map each document to an object that includes its Firestore id.
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

  // Build a list of unique "Grade Level - Section" combinations from the fetched data.
  // We use a Set to deduplicate, then convert back to a sorted array for the dropdown.
  const gradeSectionOptions = ["All", ...Array.from(
    new Set(
      learners
        .filter((l) => l.gradeLevel && l.section)
        .map((l) => `${l.gradeLevel} - ${l.section}`)
    )
  ).sort()];

  // Filter the learners array based on the selected dropdown value.
  // "All" shows everything; otherwise we match the exact "Grade - Section" string.
  const filteredLearners = filterValue === "All"
    ? learners
    : learners.filter((l) => `${l.gradeLevel} - ${l.section}` === filterValue);

  // Handle delete: ask for confirmation, then delete from Firestore and update local state.
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

  // Shared table cell style for visual consistency with SF1.jsx.
  const cellStyle = { border: "1px solid #ccc", padding: "6px", textAlign: "left" };

  // Style for the filter dropdown to match input fields in SF1.jsx.
  const selectStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "4px",
    fontSize: "14px",
  };

  // Show a loading message while data is being fetched.
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
      {/* Back button at the top, same pattern as SF1.jsx */}
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

      {/* Error message display (e.g. if delete fails) */}
      {errorMessage && (
        <p style={{ color: "red", marginTop: "12px", marginBottom: "12px" }}>{errorMessage}</p>
      )}

      {/* Filter dropdown: "Filter by Grade & Section" */}
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

      {/* If no learners exist at all (or after filtering), show a friendly message. */}
      {filteredLearners.length === 0 && (
        <p style={{ textAlign: "center", color: "#777", marginTop: "40px", fontSize: "16px" }}>
          {learners.length === 0
            ? "No learners saved yet."
            : "No learners match the selected filter."}
        </p>
      )}

      {/* Table with learner data */}
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
    </div>
  );
}

export default ViewLearners;
