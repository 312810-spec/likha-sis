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
      <div className="space-y-6 max-w-4xl mx-auto my-8 px-4 animate-slide-up">
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto my-8 px-4">
      {/* ---- Controls (no-print) ---- */}
      <div className="no-print space-y-4 animate-slide-up">
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            School ID Generator
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Logged in as: <strong className="text-gray-700 dark:text-gray-300">{user?.email || "Unknown user"}</strong>
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-fade-in">
            {errorMessage}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Learner
            </label>
            <select
              value={selectedLearner ? selectedLearner.id : ""}
              onChange={(e) => {
                const found = learners.find((learner) => learner.id === e.target.value);
                setSelectedLearner(found || null);
              }}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            >
              <option value="">-- Select a learner --</option>
              {learners.map((learner) => (
                <option key={learner.id} value={learner.id}>
                  {`${learner.lastName || ""}, ${learner.firstName || ""} — Grade ${learner.gradeLevel || ""}, Section ${learner.section || ""}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => window.print()}
              disabled={!selectedLearner}
              className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
              type="button"
            >
              Print ID
            </button>
            {!selectedLearner && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Select a learner to enable printing.
              </span>
            )}
          </div>
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
