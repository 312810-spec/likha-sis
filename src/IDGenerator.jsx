// src/IDGenerator.jsx
// School ID generator: previews and prints learner ID cards (front + back),
// either one at a time or in a batch for a whole Grade & Section.
//
// Card design follows the standard DepEd elementary/secondary school ID
// template (government header, colored school-name band, pill-shaped info
// fields with italic captions, diagonal ribbon accent) — reskinned with the
// school's own brand color via the same CSS variables Branding Settings sets,
// in portrait orientation with a faint school-seal watermark + color wash.

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import schoolConfig from "./schoolConfig";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { User } from "lucide-react";

const CARD_W = 204; // px == 2.125in — standard CR80 ID card width, portrait
const CARD_H = 324; // px == 3.375in — standard CR80 ID card height, portrait

function fullName(learner) {
  if (!learner) return "";
  const first = learner.firstName || "";
  const middle = learner.middleName ? ` ${learner.middleName} ` : " ";
  const last = learner.lastName || "";
  return `${first}${middle}${last}`.trim();
}

// Builds `count` consecutive school-year labels starting at `startSY`
// (e.g. "2026-2027" -> ["2026-2027", "2027-2028", ...]) for the back's
// yearly-revalidation table. Falls back to blanks if the learner's school
// year isn't in the expected "YYYY-YYYY" shape rather than guessing.
function schoolYearSequence(startSY, count) {
  const match = /^(\d{4})-(\d{4})$/.exec(String(startSY || "").trim());
  if (!match) return Array.from({ length: count }, () => "—");
  const startYear = Number(match[1]);
  return Array.from({ length: count }, (_, i) => `${startYear + i}-${startYear + i + 1}`);
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

// Finds the adviser (from the "users" directory) whose assignments list
// names this learner's exact grade level + section, per the assignment
// model UserManagement already writes. Returns "" — never a guess — when
// no adviser is on record for that section.
function adviserNameFor(learner, advisers) {
  if (!learner) return "";
  const match = advisers.find(
    (a) =>
      Array.isArray(a.assignments) &&
      a.assignments.some(
        (asn) => asn.role === "adviser" && asn.gradeLevel === learner.gradeLevel && asn.section === learner.section
      )
  );
  return match?.fullName || "";
}

// ---------------------------------------------------------------------------
// Card faces (print-safe: plain inline styles, brand color via CSS vars set
// by useBrandTheme so every school's ID auto-matches its own branding)
// ---------------------------------------------------------------------------
function InfoPill({ value, caption }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={pillStyle}>{value || " "}</div>
      <div style={pillCaptionStyle}>{caption}</div>
    </div>
  );
}

function DiagonalRibbon() {
  return <div style={ribbonStyle} />;
}

// Faint centered school-seal watermark + soft brand-color wash behind the
// card content — sits at z-index 0 so the actual content (z-index 1) always
// reads clearly on top of it.
function CardBackground() {
  return (
    <img
      src="/Tingub%20National%20High%20School%28clear%29.png"
      alt=""
      style={watermarkStyle}
    />
  );
}

function IDCardFront({ learner, adviserName, school = schoolConfig }) {
  const currentSchool = { ...schoolConfig, ...school };
  return (
    <div className="id-card" style={cardStyle}>
      <CardBackground />
      <div style={contentStyle}>
        {/* Government header */}
        <div style={govHeaderStyle}>
          <img
            src="/Tingub%20National%20High%20School%28clear%29.png"
            alt=""
            style={{ width: "22px", height: "22px", borderRadius: "50%", marginBottom: "2px" }}
          />
          <div style={{ fontSize: "5.6px", fontWeight: "bold" }}>Republic of the Philippines</div>
          <div style={{ fontSize: "5.6px" }}>Department of Education</div>
          <div style={{ fontSize: "5px", color: "#555" }}>{currentSchool.region}</div>
          <div style={{ fontSize: "5px", color: "#555" }}>{currentSchool.divisionOffice}</div>
          <div style={{ fontSize: "5px", color: "#555" }}>{currentSchool.district}</div>
        </div>

        {/* School name band */}
        <div style={nameBandStyle}>{currentSchool.schoolName}</div>

        {/* Photo and QR, matched in size and placed side by side so the QR
            stays large enough to scan reliably */}
        <div style={photoQrRowStyle}>
          {learner.photoURL ? (
            <img src={learner.photoURL} alt="" style={photoImageStyle} />
          ) : (
            <div style={photoPlaceholderStyle}>
              <User size={26} strokeWidth={1.2} color="#9ca3af" />
              <div style={{ fontSize: "5.5px", color: "#9ca3af", marginTop: "2px", letterSpacing: "0.4px" }}>PHOTO</div>
            </div>
          )}

          {learner.lrn ? (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(learner.lrn)}`}
              alt="QR code"
              style={qrPlaceholderStyle}
            />
          ) : (
            <div style={qrPlaceholderStyle}>
              <div style={{ fontSize: "5.5px", color: "#9ca3af" }}>NO QR</div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: "6px" }}>
          <div style={{ fontSize: "7.5px", fontWeight: "bold", color: "#111" }}>S.Y. {learner.schoolYear || "—"}</div>
          <div style={{ fontSize: "7px", color: "#555", marginTop: "1px" }}>LRN: {learner.lrn || "N/A"}</div>
        </div>

        {/* Pill info fields */}
        <div style={pillGroupStyle}>
          <InfoPill value={fullName(learner)} caption="Name of Student" />
          <InfoPill value={`Grade ${learner.gradeLevel || "—"} - ${learner.section || "—"}`} caption="Grade & Section" />
          <InfoPill value={adviserName} caption="Class Adviser" />
        </div>

        <DiagonalRibbon />
      </div>
    </div>
  );
}

function IDCardBack({ learner, principalName, principalPosition }) {
  const { name, relationship, address } = emergencyContact(learner);
  const parentValue = name ? `${name}${relationship ? ` (${relationship})` : ""}` : "";

  return (
    <div className="id-card" style={cardStyle}>
      <CardBackground />
      <div style={contentStyle}>
        <div style={{ padding: "14px 14px 0", textAlign: "center" }}>
          <div style={{ fontSize: "7px", fontWeight: "bold", letterSpacing: "0.4px", color: "#374151" }}>
            IN CASE OF EMERGENCY, PLEASE NOTIFY:
          </div>
        </div>

        <div style={{ ...pillGroupStyle, marginTop: "8px" }}>
          <InfoPill value={parentValue} caption="Name of Parent/Guardian" />
          <InfoPill value={address} caption="Address" />
          <InfoPill value="" caption="Contact Number" />
        </div>

        {/* Yearly revalidation table — one row per school year this card
            stays valid for, signed off each year rather than reprinted. */}
        <div style={syTableStyle}>
          <div style={syTableHeaderRowStyle}>
            <div style={{ ...syTableCellStyle, ...syTableSYColStyle, fontWeight: "bold" }}>School Year</div>
            <div style={{ ...syTableCellStyle, fontWeight: "bold" }}>Signature</div>
          </div>
          {schoolYearSequence(learner.schoolYear, 5).map((sy, i, arr) => (
            <div key={`${sy}-${i}`} style={i === arr.length - 1 ? syTableRowStyleLast : syTableRowStyle}>
              <div style={{ ...syTableCellStyle, ...syTableSYColStyle }}>{sy}</div>
              <div style={syTableCellStyle} />
            </div>
          ))}
        </div>

        <p style={backDisclaimerStyle}>
          This card is non-transferable and is valid only for S.Y. {learner.schoolYear || "—"}. It must be worn
          at all times while inside the school premises. In case of loss, report immediately to your class
          adviser.
        </p>

        <div style={backSignoffStyle}>
          <div style={{ fontSize: "9.5px", fontWeight: "bold", color: "#111" }}>{principalName}</div>
          <div style={{ fontSize: "7px", color: "#555" }}>{principalPosition}</div>
        </div>

        <DiagonalRibbon />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function IDGenerator({ user, goBack }) {
  const { config } = useSchoolConfig();
  const school = { ...schoolConfig, ...config };
  const [learners, setLearners] = useState([]);
  const [advisers, setAdvisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [mode, setMode] = useState("single"); // "single" | "section"
  const [sectionFilter, setSectionFilter] = useState("");
  const [side, setSide] = useState("front"); // "front" | "back" — batch mode only

  useEffect(() => {
    async function fetchData() {
      try {
        const [learnersSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "learners")),
          getDocs(collection(db, "users")),
        ]);
        setLearners(learnersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setAdvisers(
          usersSnap.docs
            .map((docSnap) => docSnap.data())
            .filter((u) => Array.isArray(u.roles) && u.roles.includes("adviser"))
        );
      } catch (err) {
        console.error("Failed to fetch learners/advisers:", err);
        setErrorMessage("Could not load learners. Please check your connection and refresh.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto my-8 px-4">
      {/* ---- Controls (no-print) ---- */}
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
          <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            School ID Generator
          </h2>
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
              <IDCardFront learner={selectedLearner} adviserName={adviserNameFor(selectedLearner, advisers)} school={school} />
              <IDCardBack
                learner={selectedLearner}
                principalName={school.principalName}
                principalPosition={school.principalPosition}
              />
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
              <IDCardFront key={learner.id} learner={learner} adviserName={adviserNameFor(learner, advisers)} school={school} />
            ) : (
              <IDCardBack
                key={learner.id}
                learner={learner}
                principalName={school.principalName}
                principalPosition={school.principalPosition}
              />
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
const cardStyle = {
  position: "relative",
  width: `${CARD_W}px`,
  height: `${CARD_H}px`,
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  backgroundColor: "#fff",
  backgroundImage: "linear-gradient(160deg, rgb(var(--color-primary) / 0.07), rgba(255,255,255,0) 55%)",
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.12)",
  overflow: "hidden",
  fontFamily: "inherit",
};

// Faint centered watermark of the school seal — decorative background layer,
// sits below the content (z-index 0 vs. contentStyle's z-index 1).
const watermarkStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "62%",
  opacity: 0.07,
  pointerEvents: "none",
  userSelect: "none",
  zIndex: 0,
};

const contentStyle = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  height: "100%",
};

const govHeaderStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  padding: "8px 10px 2px",
  color: "#111",
  lineHeight: 1.25,
};

const nameBandStyle = {
  backgroundColor: "rgb(var(--color-primary))",
  color: "#fff",
  fontSize: "9.5px",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  textAlign: "center",
  padding: "3px 6px",
  marginTop: "4px",
};

// Photo and QR sit side by side at matching size, so the QR stays large
// enough to scan reliably instead of being shrunk into a corner badge.
const photoQrRowStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: "10px",
  marginTop: "10px",
  padding: "0 10px",
};

const photoPlaceholderStyle = {
  width: "78px",
  height: "78px",
  border: "1px dashed #cbd5e1",
  borderRadius: "6px",
  backgroundColor: "rgba(248, 250, 252, 0.85)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const photoImageStyle = {
  width: "78px",
  height: "78px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  objectFit: "cover",
  flexShrink: 0,
};

const qrPlaceholderStyle = {
  width: "78px",
  height: "78px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  backgroundColor: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const pillGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "10px 16px 0",
};

const pillStyle = {
  border: "1px solid #d1d5db",
  borderRadius: "999px",
  padding: "3px 10px",
  fontSize: "9px",
  fontWeight: "bold",
  color: "#111",
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const pillCaptionStyle = {
  fontSize: "6px",
  fontStyle: "italic",
  color: "#6b7280",
  marginTop: "1px",
};

const ribbonStyle = {
  marginTop: "auto",
  height: "12px",
  backgroundImage:
    "repeating-linear-gradient(45deg, rgb(var(--color-primary)) 0px, rgb(var(--color-primary)) 8px, rgb(var(--color-accent)) 8px, rgb(var(--color-accent)) 16px, #ffffff 16px, #ffffff 20px)",
};

const syTableStyle = {
  margin: "8px 16px 0",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  overflow: "hidden",
};

const syTableHeaderRowStyle = {
  display: "flex",
  backgroundColor: "#f3f4f6",
  borderBottom: "1px solid #d1d5db",
};

const syTableRowStyle = {
  display: "flex",
  borderBottom: "1px solid #e5e7eb",
};

const syTableRowStyleLast = {
  display: "flex",
};

const syTableCellStyle = {
  flex: 1,
  padding: "2px 4px",
  fontSize: "6px",
  color: "#111",
  minHeight: "11px",
  display: "flex",
  alignItems: "center",
};

const syTableSYColStyle = {
  flex: "0 0 58px",
  justifyContent: "center",
  textAlign: "center",
  borderRight: "1px solid #e5e7eb",
  color: "#374151",
};

const backDisclaimerStyle = {
  fontSize: "6.5px",
  color: "#777",
  fontStyle: "italic",
  lineHeight: 1.4,
  textAlign: "center",
  padding: "10px 16px 0",
};

const backSignoffStyle = {
  marginTop: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "10px 16px 12px",
};

export default IDGenerator;
