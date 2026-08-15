// src/IDGenerator.jsx
// School ID generator: previews and prints learner ID cards (front + back),
// either one at a time or in a batch for a whole Grade & Section.

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import schoolConfig from "./schoolConfig";
import { User } from "lucide-react";

const CARD_W = 324; // px == 3.375in — standard CR80 ID card width
const CARD_H = 204; // px == 2.125in — standard CR80 ID card height

function fullName(learner) {
  if (!learner) return "";
  const first = learner.firstName || "";
  const middle = learner.middleName ? ` ${learner.middleName} ` : " ";
  const last = learner.lastName || "";
  return `${first}${middle}${last}`.trim();
}

function emergencyContact(learner) {
  const name = learner.guardianName || learner.fathersName || learner.mothersMaidenName || "";
  const relationship = learner.guardianName
    ? learner.guardianRelationship || "Guardian"
    : learner.fathersName
    ? "Father"
    : learner.mothersMaidenName
    ? "Mother"
    : "";
  const address = [learner.houseStreetSitio, learner.barangay, learner.municipalityCity, learner.province]
    .filter(Boolean)
    .join(", ");
  return { name, relationship, address };
}

// ---------------------------------------------------------------------------
// Card faces (print-safe: plain inline styles, brand color via CSS vars set
// by useBrandTheme so every school's ID auto-matches its own branding)
// ---------------------------------------------------------------------------
function IDCardFront({ learner }) {
  return (
    <div className="id-card" style={frontCardStyle}>
      <div style={frontHeaderStyle}>
        <img
          src="/Tingub%20National%20High%20School%28clear%29.png"
          alt=""
          style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#fff", flexShrink: 0 }}
        />
        <div style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {schoolConfig.schoolName}
          </div>
          <div style={{ fontSize: "6.5px", opacity: 0.85 }}>Learner Identification Card</div>
        </div>
      </div>

      <div style={photoPlaceholderStyle}>
        <User size={30} strokeWidth={1.2} color="#9ca3af" />
        <div style={{ fontSize: "6px", color: "#9ca3af", marginTop: "2px", letterSpacing: "0.4px" }}>PHOTO</div>
      </div>

      <div style={frontInfoStyle}>
        <div style={{ fontSize: "12.5px", fontWeight: "bold", lineHeight: 1.2, color: "#111" }}>
          {fullName(learner) || "[Learner Name]"}
        </div>
        <div style={{ fontSize: "9px", color: "#444", marginTop: "5px" }}>LRN: {learner.lrn || "N/A"}</div>
        <div style={{ fontSize: "9px", color: "#444", marginTop: "2px" }}>
          Grade {learner.gradeLevel || "—"} - {learner.section || "—"}
        </div>
      </div>

      {learner.lrn ? (
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(learner.lrn)}`}
          alt="QR code"
          style={{
            position: "absolute",
            bottom: "24px",
            right: "10px",
            width: "52px",
            height: "52px",
            border: "1px solid #ddd",
            background: "#fff",
          }}
        />
      ) : null}

      <div style={frontFooterStyle}>Valid for SY {learner.schoolYear || "—"}</div>
    </div>
  );
}

function IDCardBack({ learner }) {
  const { name, relationship, address } = emergencyContact(learner);
  return (
    <div className="id-card" style={backCardStyle}>
      <div style={backHeaderStyle}>{schoolConfig.schoolName}</div>

      <div style={{ padding: "8px 12px 0" }}>
        <div style={{ fontSize: "7px", fontWeight: "bold", letterSpacing: "0.5px", color: "#374151" }}>
          IN CASE OF EMERGENCY, PLEASE CONTACT:
        </div>
        <div style={{ fontSize: "9px", color: "#111", marginTop: "3px" }}>
          {name || "[Guardian Name]"}
          {relationship ? ` (${relationship})` : ""}
        </div>
        <div style={{ fontSize: "8px", color: "#555", marginTop: "1px" }}>{address || "[Address]"}</div>
        <div style={{ fontSize: "8px", color: "#555", marginTop: "4px" }}>
          Contact No.: <span style={{ display: "inline-block", width: "120px", borderBottom: "1px solid #999" }} />
        </div>

        <p style={{ fontSize: "6.8px", color: "#777", fontStyle: "italic", marginTop: "8px", lineHeight: 1.35 }}>
          This ID is the property of {schoolConfig.schoolName} and must be surrendered upon request.
          If found, please return to the school address above.
        </p>
      </div>

      <div style={backSignatureRowStyle}>
        <div style={backSignatureStyle}>
          <div style={{ borderTop: "1px solid #999", paddingTop: "2px", fontSize: "6.5px", color: "#666" }}>
            Learner's Signature
          </div>
        </div>
        <div style={backSignatureStyle}>
          <div style={{ borderTop: "1px solid #999", paddingTop: "2px", fontSize: "6.5px", color: "#666" }}>
            School Principal
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function IDGenerator({ user, goBack }) {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [mode, setMode] = useState("single"); // "single" | "section"
  const [sectionFilter, setSectionFilter] = useState("");
  const [side, setSide] = useState("front"); // "front" | "back" — batch mode only

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

  const gradeSectionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          learners
            .filter((l) => l.gradeLevel && l.section)
            .map((l) => `${l.gradeLevel} - ${l.section}`)
        )
      ).sort(),
    [learners]
  );

  const sectionLearners = useMemo(
    () =>
      sectionFilter
        ? learners.filter((l) => `${l.gradeLevel} - ${l.section}` === sectionFilter)
        : [],
    [learners, sectionFilter]
  );

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
    <div className="space-y-6 max-w-5xl mx-auto my-8 px-4">
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

        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          {/* Mode tabs */}
          <div className="inline-flex items-center rounded-full p-0.5 bg-gray-100 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 ${
                mode === "single" ? "bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Single ID
            </button>
            <button
              type="button"
              onClick={() => setMode("section")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 ${
                mode === "section" ? "bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Print by Section
            </button>
          </div>

          {mode === "single" ? (
            <div className="max-w-md">
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

              <div className="flex flex-wrap items-center gap-3 pt-4">
                <button
                  onClick={() => window.print()}
                  disabled={!selectedLearner}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
                  type="button"
                >
                  Print ID (Front + Back)
                </button>
                {!selectedLearner && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Select a learner to enable printing.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-w-md">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Grade & Section
                </label>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                >
                  <option value="">-- Select grade & section --</option>
                  {gradeSectionOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {sectionFilter && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-full p-0.5 bg-gray-100 dark:bg-gray-800">
                      <button
                        type="button"
                        onClick={() => setSide("front")}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 ${
                          side === "front" ? "bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        Fronts
                      </button>
                      <button
                        type="button"
                        onClick={() => setSide("back")}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 ${
                          side === "back" ? "bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        Backs
                      </button>
                    </div>

                    <button
                      onClick={() => window.print()}
                      disabled={sectionLearners.length === 0}
                      className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
                      type="button"
                    >
                      Print {side === "front" ? "Fronts" : "Backs"} ({sectionLearners.length})
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                    Print the <strong>Fronts</strong> sheet first, then flip the printed stack the same way each
                    time and feed it back into the printer, switch to <strong>Backs</strong>, and print again —
                    the cards will stay lined up in the same order on both sides.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Preview / print area ---- */}
      {mode === "single" ? (
        <div className="id-print-area" style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {selectedLearner ? (
            <>
              <IDCardFront learner={selectedLearner} />
              <IDCardBack learner={selectedLearner} />
            </>
          ) : (
            <div
              className="no-print"
              style={{
                width: CARD_W,
                height: CARD_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
                textAlign: "center",
                border: "1px dashed #d1d5db",
                borderRadius: "16px",
                fontSize: "13px",
              }}
            >
              Select a learner to preview their ID
            </div>
          )}
        </div>
      ) : (
        <div className="id-print-area" style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
          {sectionFilter && sectionLearners.length === 0 && (
            <p className="no-print text-sm text-gray-400 dark:text-gray-500">
              No learners found for {sectionFilter}.
            </p>
          )}
          {sectionLearners.map((learner) =>
            side === "front" ? (
              <IDCardFront key={learner.id} learner={learner} />
            ) : (
              <IDCardBack key={learner.id} learner={learner} />
            )
          )}
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .id-print-area, .id-print-area * { visibility: visible; }
          .id-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            box-sizing: border-box;
          }
          .id-card { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Print-safe inline styles (brand color via CSS custom properties so every
// school's ID auto-matches its own branding set in Branding Settings)
// ---------------------------------------------------------------------------
const frontCardStyle = {
  position: "relative",
  width: `${CARD_W}px`,
  height: `${CARD_H}px`,
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  backgroundColor: "#fff",
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.12)",
  overflow: "hidden",
  fontFamily: "inherit",
};

const frontHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  height: "40px",
  padding: "0 10px",
  backgroundColor: "rgb(var(--color-primary))",
  color: "#fff",
};

const frontFooterStyle = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: "18px",
  backgroundColor: "rgb(var(--color-accent))",
  color: "#fff",
  fontSize: "7.5px",
  fontWeight: "bold",
  letterSpacing: "0.3px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const photoPlaceholderStyle = {
  position: "absolute",
  top: "50px",
  left: "10px",
  width: "62px",
  height: "78px",
  border: "1px dashed #cbd5e1",
  borderRadius: "6px",
  backgroundColor: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const frontInfoStyle = {
  position: "absolute",
  top: "50px",
  left: "82px",
  right: "10px",
};

const backCardStyle = {
  position: "relative",
  width: `${CARD_W}px`,
  height: `${CARD_H}px`,
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  backgroundColor: "#fff",
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.12)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const backHeaderStyle = {
  height: "24px",
  backgroundColor: "rgb(var(--color-primary))",
  color: "#fff",
  fontSize: "8px",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const backSignatureRowStyle = {
  marginTop: "auto",
  display: "flex",
  gap: "18px",
  padding: "0 16px 12px",
};

const backSignatureStyle = {
  flex: 1,
};

export default IDGenerator;
