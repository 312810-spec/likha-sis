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
import useSchoolConfig from "./hooks/useSchoolConfig";
import { formatDivisionHeader } from "./utils/depedHierarchy.js";

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
  const { config } = useSchoolConfig();
  const school = { ...schoolConfig, ...config };
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

  // Loading screen with pulsing skeleton
  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto my-8 px-4">
        {goBack && (
          <button
            onClick={goBack}
            className="no-print inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light font-medium mb-2 transition-colors duration-150 active:scale-[0.98]"
            type="button"
          >
            ← Back to Dashboard
          </button>
        )}
        <div className="space-y-3 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="h-6 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto my-8 px-4">
      {/* ---- Filter / Form Controls (no-print) ---- */}
      <div className="no-print space-y-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {goBack && (
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light font-medium mb-2 transition-colors duration-150 active:scale-[0.98]"
              type="button"
            >
              ← Back to Dashboard
            </button>
          )}
          <h1 className="font-display text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Certificate Generator
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Logged in as: <strong className="text-gray-700 dark:text-gray-300">{user.email}</strong>
          </p>
        </div>

        {/* Error message if Firestore fetch fails */}
        {errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-fade-in">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Learner
            </label>
            <select
              value={selectedLearner ? selectedLearner.id : ""}
              onChange={(e) => {
                const found = learners.find((l) => l.id === e.target.value);
                setSelectedLearner(found || null);
              }}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
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
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Certificate Type
            </label>
            <select
              value={certificateType}
              onChange={(e) => setCertificateType(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            >
              <option value="Certificate of Enrollment">Certificate of Enrollment</option>
              <option value="Good Moral Certificate">Good Moral Certificate</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Purpose
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. for scholarship application"
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Date Issued
            </label>
            <input
              type="date"
              value={dateIssued}
              onChange={(e) => setDateIssued(e.target.value)}
              className="w-full sm:w-auto text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => window.print()}
              disabled={!canPrint}
              className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
              type="button"
            >
              Print Certificate
            </button>
            {!canPrint && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Select a learner and enter a purpose to enable printing.
              </span>
            )}
          </div>
        </div>
      </div>


      {/* ---- Live certificate preview ---- */}
      <div className="certificate-preview" style={certificateBorderStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>{school.schoolName}</div>
          <div style={{ fontSize: "14px", marginTop: "4px" }}>{school.schoolAddress}</div>
          <div style={{ fontSize: "12px", marginTop: "2px", fontStyle: "italic" }}>
            {formatDivisionHeader(school.divisionOffice)}
          </div>
        </div>

        <h2 style={{ textAlign: "center", margin: "36px 0 28px", fontWeight: "bold" }}>{heading}</h2>

        <p style={{ textAlign: "justify", lineHeight: "1.8", fontSize: "16px", margin: "0 20px" }}>
          {bodyText || "Select a learner to preview the certificate here."}
        </p>

        <div style={{ textAlign: "right", marginTop: "60px", marginRight: "20px" }}>
          <div style={{ fontSize: "15px", marginBottom: "50px" }}>{formatDate(dateIssued)}</div>
          <div style={{ fontWeight: "bold", fontSize: "17px" }}>{school.principalName}</div>
          <div style={{ fontSize: "14px" }}>{school.principalPosition}</div>
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

