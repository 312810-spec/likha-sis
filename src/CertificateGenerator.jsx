// src/CertificateGenerator.jsx
// Reusable certificate generator for:
//   - Certificate of Enrollment
//   - Good Moral Character Certificate
// Uses existing learner data from Firestore and prints via the browser's
// built-in window.print() (no PDF library needed).

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import schoolConfig from "./schoolConfig";

// --- Small date helpers (local-timezone safe, matching the use of
//     "YYYY-MM-DD" date strings used elsewhere in the app) ---------------

// Convert a Date object to a "YYYY-MM-DD" string using local time.
function dateToInputString(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Format a "YYYY-MM-DD" string as "Month DD, YYYY" for the certificate body.
function formatDate(dateString) {
  if (!dateString) return "";
  try {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function CertificateGenerator({ user, goBack }) {
  // learners: all learner documents from Firestore, each with its id included.
  const [learners, setLearners] = useState([]);
  // loading: true while we fetch learner data.
  const [loading, setLoading] = useState(true);
  // errorMessage: friendly error if Firestore fetch fails.
  const [errorMessage, setErrorMessage] = useState("");

  // Form state
  const [selectedLearner, setSelectedLearner] = useState(null); // full learner object
  const [certificateType, setCertificateType] = useState("Certificate of Enrollment");
  const [purpose, setPurpose] = useState("");
  const [dateIssued, setDateIssued] = useState(dateToInputString(new Date()));

  // On mount, fetch ALL documents from the "learners" collection in Firestore.
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

  // Utility to render a learner's full name when displaying in the certificate.
  function fullName(learner) {
    if (!learner) return "";
    const first = learner.firstName || "";
    const middle = learner.middleName ? ` ${learner.middleName} ` : " ";
    const last = learner.lastName || "";
    return `${first}${middle}${last}`.trim();
  }

  // Small helper for the selected learner's section (avoids repeating fallbacks).
  function selectedLeader_section(learner) {
    return learner.section || "[Section]";
  }

  // Certificate heading based on the selected type.
  const heading =
    certificateType === "Certificate of Enrollment"
      ? "CERTIFICATE OF ENROLLMENT"
      : "GOOD MORAL CHARACTER CERTIFICATE";

  // Body paragraph following the DepEd-style convention, using the selected
  // learner's data, purpose, and date issued.
  let bodyText = "";
  if (selectedLearner) {
    const grade = selectedLearner.gradeLevel || "[Grade]";
    const section = selectedLeader_section(selectedLearner);
    const schoolYear = selectedLearner.schoolYear || "[School Year]";
    const name = fullName(selectedLearner);

    if (certificateType === "Certificate of Enrollment") {
      bodyText =
        `This is to certify that ${name}, a bona fide learner of this school, ` +
        `is currently enrolled in Grade ${grade}, Section ${section} for ` +
        `School Year ${schoolYear}. This certificate is being issued for the ` +
        `purpose of ${purpose || "[purpose]"} and is valid as of ` +
        `${formatDate(dateIssued)}.`;
    } else {
      bodyText =
        `This is to certify that ${name}, a bona fide learner of this school, ` +
        `has shown good moral character and behavior during his/her stay in ` +
        `this school for School Year ${schoolYear}. This certificate is being ` +
        `issued for the purpose of ${purpose || "[purpose]"} this ` +
        `${formatDate(dateIssued)}.`;
    }
  }

  // Disable printing until a learner is picked AND a purpose is typed in.
  const canPrint = Boolean(selectedLearner) && purpose.trim().length > 0;

  // Loading screen, same pattern as ViewLearners.jsx.
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
      {/* Back button at the top, same pattern as SF1.jsx / ViewLearners.jsx */}
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

      <h1 style={{ marginBottom: "4px" }}>Certificate Generator</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Logged in as: <strong>{user.email}</strong>
      </p>

      {/* Error message if Firestore fetch fails */}
      {errorMessage && (
        <p style={{ color: "red", marginTop: "12px", marginBottom: "12px" }}>{errorMessage}</p>
      )}

      {/* ---- Form (hidden when printing) ---- */}
      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "20px 0" }}>
        <div>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "bold" }}>
            Learner
          </label>
          <select
            value={selectedLearner ? selectedLearner.id : ""}
            onChange={(e) => {
              const found = learners.find((l) => l.id === e.target.value);
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
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {`${l.lastName || ""}, ${l.firstName || ""} — Grade ${l.gradeLevel || ""}, Section ${l.section || ""}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "bold" }}>
            Certificate Type
          </label>
          <select
            value={certificateType}
            onChange={(e) => setCertificateType(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "6px",
              fontSize: "14px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          >
            <option value="Certificate of Enrollment">Certificate of Enrollment</option>
            <option value="Good Moral Certificate">Good Moral Certificate</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "bold" }}>
            Purpose
          </label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. for scholarship application"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "6px",
              fontSize: "14px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "bold" }}>
            Date Issued
          </label>
          <input
            type="date"
            value={dateIssued}
            onChange={(e) => setDateIssued(e.target.value)}
            style={{
              padding: "6px",
              fontSize: "14px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div style={{ marginTop: "4px" }}>
          <button
            onClick={() => window.print()}
            disabled={!canPrint}
            style={{
              padding: "10px 18px",
              cursor: canPrint ? "pointer" : "not-allowed",
              background: canPrint ? "#1565c0" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          >
            Print Certificate
          </button>
          {!canPrint && (
            <span style={{ marginLeft: "12px", color: "#999", fontSize: "12px" }}>
              Select a learner and enter a purpose to enable printing.
            </span>
          )}
        </div>
      </div>


      {/* ---- Live certificate preview ---- */}
      <div className="certificate-preview" style={certificateBorderStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>{schoolConfig.schoolName}</div>
          <div style={{ fontSize: "14px", marginTop: "4px" }}>{schoolConfig.schoolAddress}</div>
          <div style={{ fontSize: "12px", marginTop: "2px", fontStyle: "italic" }}>{schoolConfig.divisionName}</div>
        </div>

        <h2 style={{ textAlign: "center", margin: "36px 0 28px", fontWeight: "bold" }}>{heading}</h2>

        <p style={{ textAlign: "justify", lineHeight: "1.8", fontSize: "16px", margin: "0 20px" }}>
          {bodyText || "Select a learner to preview the certificate here."}
        </p>

        <div style={{ textAlign: "right", marginTop: "60px", marginRight: "20px" }}>
          <div style={{ fontSize: "15px", marginBottom: "50px" }}>{formatDate(dateIssued)}</div>
          <div style={{ fontWeight: "bold", fontSize: "17px" }}>{schoolConfig.principalName}</div>
          <div style={{ fontSize: "14px" }}>{schoolConfig.principalPosition}</div>
        </div>
      </div>

      {/* Print CSS: hide back button + form when printing, show certificate only */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .certificate-preview, .certificate-preview * { visibility: visible; }
          .certificate-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 40px;
            box-sizing: border-box;
          }
        }
      `}</style>
    </div>
  );
}

// The certificate "paper" styling — serif font for the certificate body only.
const certificateBorderStyle = {
  border: "2px solid #333",
  borderRadius: "8px",
  padding: "40px",
  fontFamily: "'Times New Roman', Times, serif",
  backgroundColor: "#fff",
  minHeight: "400px",
};

export default CertificateGenerator;

