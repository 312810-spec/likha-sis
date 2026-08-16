// src/SF10Generator.jsx
// SF10 (Learner's Permanent Academic Record / Form 137) generator. Merges
// live LIKHA-SIS classRecords with imported academicRecords into a
// multi-year grid, printable one learner at a time or for a whole section.
//
// Layout is built from general knowledge of the DepEd SF10 format (no
// reference template was available -- see the design spec's Decision 3).
// Treat this as needing a follow-up validation pass once a real blank SF10
// form is available to compare against; unlike ReportCard.jsx's Annex G
// layout, this one is NOT verified byte-exact.

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { getSubjectWeights } from "./utils/subjectWeights.js";
import { buildLearnerAcademicHistory } from "./utils/sf10Records.js";
import { getSubjectRows } from "./utils/subjectRows.js";
import { ArrowLeft, Printer } from "lucide-react";

function fullName(learner) {
  if (!learner) return "";
  const middle = learner.middleName ? ` ${learner.middleName} ` : " ";
  return `${learner.firstName || ""}${middle}${learner.lastName || ""}`.trim();
}

// One learner's printable SF10 grid: identity header + one row per subject
// (union of every subject that appears across the learner's history rows,
// in the current grade level's canonical order first) with one column per
// school year, plus a general-average row and a promotion-status row.
function SF10Document({ learner, history, shsConfig }) {
  const canonicalRows = getSubjectRows(learner?.gradeLevel, learner, shsConfig).filter(
    (r) => !r.isHeader && r.key
  );
  const seen = new Set(canonicalRows.map((r) => r.key));
  const extraKeys = [];
  history.forEach((row) => {
    Object.keys(row.subjects).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        extraKeys.push(key);
      }
    });
  });
  const subjectKeys = [...canonicalRows.map((r) => r.key), ...extraKeys];
  const subjectLabels = new Map(canonicalRows.map((r) => [r.key, r.label]));

  return (
    <div
      className="sf10-print-area"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", background: "#ffffff", color: "#111827", padding: "24px" }}
    >
      <div style={{ textAlign: "center", marginBottom: "12px" }}>
        <div style={{ fontWeight: "bold", fontSize: "14px" }}>SCHOOL FORM 10 (SF10)</div>
        <div style={{ fontSize: "12px" }}>Learner's Permanent Academic Record</div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "12px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "2px 6px" }}><strong>Name:</strong> {fullName(learner)}</td>
            <td style={{ padding: "2px 6px" }}><strong>LRN:</strong> {learner?.lrn || "—"}</td>
          </tr>
          <tr>
            <td style={{ padding: "2px 6px" }}><strong>Sex:</strong> {learner?.sex || "—"}</td>
            <td style={{ padding: "2px 6px" }}><strong>Birth Date:</strong> {learner?.birthDate || "—"}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #000", padding: "4px", textAlign: "left" }}>Learning Area</th>
            {history.map((row) => (
              <th key={`${row.schoolYear}-${row.gradeLevel}`} style={{ border: "1px solid #000", padding: "4px" }}>
                {row.schoolYear}
                <br />
                {row.gradeLevel}
              </th>
            ))}
            {history.length === 0 && (
              <th style={{ border: "1px solid #000", padding: "4px" }}>No records</th>
            )}
          </tr>
        </thead>
        <tbody>
          {subjectKeys.map((key) => (
            <tr key={key}>
              <td style={{ border: "1px solid #000", padding: "4px" }}>{subjectLabels.get(key) || key}</td>
              {history.map((row) => (
                <td
                  key={`${row.schoolYear}-${row.gradeLevel}-${key}`}
                  style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}
                >
                  {row.subjects[key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px", fontWeight: "bold" }}>General Average</td>
            {history.map((row) => (
              <td
                key={`${row.schoolYear}-${row.gradeLevel}-avg`}
                style={{ border: "1px solid #000", padding: "4px", textAlign: "center", fontWeight: "bold" }}
              >
                {row.generalAverage}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px" }}>Remarks</td>
            {history.map((row) => (
              <td
                key={`${row.schoolYear}-${row.gradeLevel}-remarks`}
                style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}
              >
                {row.promotionStatus || "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function SF10Generator({ goBack }) {
  const { config } = useSchoolConfig();

  const [learners, setLearners] = useState([]);
  const [classRecords, setClassRecords] = useState([]);
  const [academicRecords, setAcademicRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedLearnerId, setSelectedLearnerId] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [learnersSnap, classRecordsSnap, academicRecordsSnap] = await Promise.all([
          getDocs(collection(db, "learners")),
          getDocs(collection(db, "classRecords")),
          getDocs(collection(db, "academicRecords")),
        ]);
        setLearners(learnersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setClassRecords(classRecordsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setAcademicRecords(academicRecordsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load SF10 data:", err);
        setErrorMessage("Failed to load data. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const sortedLearners = useMemo(
    () =>
      [...learners].sort((a, b) => {
        const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
        if (last !== 0) return last;
        return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
      }),
    [learners]
  );

  const selectedLearner = sortedLearners.find((l) => l.id === selectedLearnerId) || null;

  const selectedHistory = useMemo(() => {
    if (!selectedLearner) return [];
    return buildLearnerAcademicHistory(
      { learnerId: selectedLearner.id, lrn: selectedLearner.lrn },
      classRecords,
      academicRecords,
      getSubjectWeights
    );
  }, [selectedLearner, classRecords, academicRecords]);

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100 space-y-6 max-w-6xl mx-auto pb-12 animate-slide-up">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .sf10-print-area, .sf10-print-area * { visibility: visible; }
          .sf10-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            box-sizing: border-box;
            background: #ffffff !important;
            color: #111827 !important;
          }
        }
      `}</style>

      <div className="no-print flex items-center gap-3">
        {goBack && (
          <button type="button" onClick={goBack} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SF10 Generator</h1>
      </div>

      {errorMessage && (
        <div className="no-print bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl p-4 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="no-print bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Learner
        </label>
        <select
          value={selectedLearnerId}
          onChange={(e) => setSelectedLearnerId(e.target.value)}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800"
        >
          <option value="">-- Select a learner --</option>
          {sortedLearners.map((l) => (
            <option key={l.id} value={l.id}>
              {`${l.lastName || ""}, ${l.firstName || ""} — Grade ${l.gradeLevel || ""}, Section ${l.section || ""}`}
            </option>
          ))}
        </select>

        {selectedLearner && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-light"
          >
            <Printer size={16} /> Print SF10
          </button>
        )}
      </div>

      {selectedLearner && (
        <SF10Document learner={selectedLearner} history={selectedHistory} shsConfig={config?.shs} />
      )}
      {!loading && !selectedLearner && sortedLearners.length === 0 && (
        <p className="no-print text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          No learners found.
        </p>
      )}
    </div>
  );
}
