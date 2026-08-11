// src/IDGenerator.jsx
// Standalone school ID generator for previewing and printing learner ID cards.
// It fetches learners from Firestore and uses the school config for header text.

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import schoolConfig from "./schoolConfig";

function fullName(learner) {
  if (!learner) return "";
  const first = learner.firstName || "";
  const middle = learner.middleName ? ` ${learner.middleName} ` : " ";
  const last = learner.lastName || "";
  return `${first}${middle}${last}`.trim();
}

function IDGenerator({ user, goBack }) {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedLearner, setSelectedLearner] = useState(null);

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

  if (loading) {
    return (
      <div style={{ fontFamily: "sans-serif", maxWidth: "1000px", margin: "30px auto", padding: "0 16px" }}>
        <button onClick={goBack} className="no-print" style={{ marginBottom: "16px", padding: "8px 16px", cursor: "pointer" }}>
          ← Back to Dashboard
        </button>
        <p style={{ textAlign: "center", color: "#555", fontSize: "18px" }}>Loading learners...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "1000px", margin: "30px auto", padding: "0 16px" }}>
      <button
        onClick={goBack}
        className="no-print"
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

      <h1 style={{ marginBottom: "4px" }}>School ID Generator</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Logged in as: <strong>{user?.email || "Unknown user"}</strong>
      </p>

      {errorMessage && (
        <p style={{ color: "red", marginTop: "12px", marginBottom: "12px" }}>{errorMessage}</p>
      )}

      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "20px 0", maxWidth: "480px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "bold" }}>
            Learner
          </label>
          <select
            value={selectedLearner ? selectedLearner.id : ""}
            onChange={(e) => {
              const found = learners.find((learner) => learner.id === e.target.value);
              setSelectedLearner(found || null);
            }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "6px",
              fontSize: "14px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          >
            <option value="">-- Select a learner --</option>
            {learners.map((learner) => (
              <option key={learner.id} value={learner.id}>
                {`${learner.lastName || ""}, ${learner.firstName || ""} — Grade ${learner.gradeLevel || ""}, Section ${learner.section || ""}`}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: "4px" }}>
          <button
            onClick={() => window.print()}
            disabled={!selectedLearner}
            style={{
              padding: "10px 18px",
              cursor: selectedLearner ? "pointer" : "not-allowed",
              background: selectedLearner ? "#1565c0" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          >
            Print ID
          </button>
          {!selectedLearner && (
            <span style={{ marginLeft: "12px", color: "#999", fontSize: "12px" }}>
              Select a learner to enable printing.
            </span>
          )}
        </div>
      </div>

      <div className="id-card-preview" style={idCardStyle}>
        {selectedLearner ? (
          <>
            <div style={{ fontSize: "11px", fontWeight: "bold", lineHeight: "1.3", textTransform: "uppercase", marginBottom: "10px" }}>
              <div>{schoolConfig.schoolName}</div>
              <div style={{ fontSize: "9px", fontWeight: "normal", marginTop: "2px", textTransform: "none" }}>
                {schoolConfig.schoolAddress}
              </div>
            </div>

            <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>
              {fullName(selectedLearner)}
            </div>

            <div style={{ fontSize: "13px", color: "#444", marginBottom: "4px" }}>
              LRN: {selectedLearner.lrn || "N/A"}
            </div>
            <div style={{ fontSize: "13px", color: "#444", marginBottom: "4px" }}>
              Grade {selectedLearner.gradeLevel || "[Grade]"} - Section {selectedLearner.section || "[Section]"}
            </div>
            <div style={{ fontSize: "13px", color: "#444" }}>
              School Year: {selectedLearner.schoolYear || "[School Year]"}
            </div>

            {selectedLearner.lrn ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(selectedLearner.lrn)}`}
                alt="QR code"
                style={{
                  position: "absolute",
                  bottom: "14px",
                  right: "14px",
                  width: "92px",
                  height: "92px",
                  border: "1px solid #ddd",
                  background: "#fff",
                }}
              />
            ) : null}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#777", textAlign: "center" }}>
            Select a learner to preview their ID
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .id-card-preview, .id-card-preview * { visibility: visible; }
          .id-card-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            box-sizing: border-box;
          }
        }
      `}</style>
    </div>
  );
}

const idCardStyle = {
  position: "relative",
  width: "340px",
  height: "214px",
  border: "2px solid #222",
  borderRadius: "16px",
  padding: "18px 20px 18px 20px",
  backgroundColor: "#fff",
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
  overflow: "hidden",
};

export default IDGenerator;
