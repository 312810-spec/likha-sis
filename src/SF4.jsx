// src/SF4.jsx
// School Form 4 — Monthly Learner Movement Report.
// Shows learner enrollment movement (beginning, transfers, dropouts, end of
// month) for the sections of a selected grade level during a chosen month,
// following the DepEd SF4 format. All data is read client-side from the
// existing learners, transfers, and attendance collections.

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { academicCalendar } from "./academicCalendar";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import { computeSF4Rows, isDropoutRemark } from "./utils/sf4Computations";

// Normalize a learner's sex into "Male" | "Female" | "" so it matches the
// computeSF4Rows contract, regardless of whether the doc stores "M"/"F" or
// "Male"/"Female".
function normalizeSex(sex) {
  const s = String(sex || "").trim().toUpperCase();
  if (s === "M" || s === "MALE") return "Male";
  if (s === "F" || s === "FEMALE") return "Female";
  return "";
}

// Builds the Firestore document id for an attendance sheet, matching SF2's
// makeDocumentId. E.g. "Grade 10 - Kindness" + "2026-08" ->
// "Grade_10_Kindness_2026-08". Spaces are replaced with underscores.
function makeDocumentId(classValue, monthValue) {
  if (!classValue) return "";
  const [gradeLevel = "", section = ""] = classValue.split(" - ");
  return `${gradeLevel.replace(/ /g, "_")}_${section.replace(/ /g, "_")}_${monthValue}`;
}

// School year options come from the centralized academic calendar.
const SCHOOL_YEARS = Object.keys(academicCalendar).length
  ? Object.keys(academicCalendar).sort((a, b) => b.localeCompare(a))
  : ["2026-2027"];

function SF4({ user, goBack }) {
  const { config } = useSchoolConfig();
  const gradeOptions =
    config?.gradeLevelsOffered ||
    ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];

  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [gradeLevel, setGradeLevel] = useState(gradeOptions[0] || "");
  // monthValue: the raw "YYYY-MM" string from the month input, same pattern as SF2.
  const [monthValue, setMonthValue] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { sections } = useAvailableSections(gradeLevel, schoolYear);

  // rows: the computed SF4 rows (one per section plus a totals row).
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const hasSelection = Boolean(gradeLevel && schoolYear && monthValue && sections.length > 0);

  // Fetch learners per section, transfers, and attendance-based dropouts for the
  // selected grade level + month, then compute the rows.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gradeLevel || !schoolYear || !monthValue || sections.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        // 1. Learners for each section of this grade level + school year.
        const learnersBySection = {};
        for (const section of sections) {
          const q = query(
            collection(db, "learners"),
            where("gradeLevel", "==", gradeLevel),
            where("section", "==", section),
            where("schoolYear", "==", schoolYear)
          );
          const snap = await getDocs(q);
          learnersBySection[section] = snap.docs.map((snapDoc) => {
            const data = snapDoc.data();
            return {
              ...data,
              sex: normalizeSex(data.sex),
              enrollmentStatus: data.enrollmentStatus || "active",
            };
          });
        }

        // 2. Transfers for this school year, filtered to the selected grade
        //    level's sections and the selected month (transferDate "YYYY-MM-DD").
        const transfersRef = collection(db, "transfers");
        const tq = query(transfersRef, where("schoolYear", "==", schoolYear));
        const tSnap = await getDocs(tq);
        const transfersInMonth = tSnap.docs
          .map((snapDoc) => snapDoc.data())
          .filter(
            (t) =>
              t.gradeLevel === gradeLevel &&
              sections.includes(t.section) &&
              typeof t.transferDate === "string" &&
              t.transferDate.startsWith(monthValue)
          )
          .map((t) => ({ section: t.section, transferType: t.transferType }));

        // 3. Dropouts: scan each section's attendance doc for the month and
        //    count remarks that start with "Dropped Out".
        const dropoutsInMonth = [];
        for (const section of sections) {
          const classValue = `${gradeLevel} - ${section}`;
          const docId = makeDocumentId(classValue, monthValue);
          const snap = await getDoc(doc(db, "attendance", docId));
          if (snap.exists()) {
            const remarks = snap.data().remarks || {};
            Object.values(remarks).forEach((remark) => {
              if (isDropoutRemark(remark)) dropoutsInMonth.push({ section });
            });
          }
        }

        if (cancelled) return;

        const computed = computeSF4Rows({
          sections,
          learnersBySection,
          transfersInMonth,
          dropoutsInMonth,
        });
        setRows(computed);
      } catch (err) {
        console.error("Failed to load SF4 data:", err);
        if (!cancelled) setError("Failed to load SF4 data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [gradeLevel, schoolYear, monthValue, sections]);

  // Renders one cell value, showing an em dash for null/absent amounts.
  function cell(value) {
    return value === null || value === undefined ? "—" : value;
  }

  return (
    <div className="space-y-5">
      {/* Print CSS — screen chrome hides, the printable table stays plain. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .sf4-print-area, .sf4-print-area * { visibility: visible; }
          .sf4-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
        }
        .sf4-table { border-collapse: collapse; width: 100%; }
        .sf4-table th, .sf4-table td {
          border: 1px solid #000;
          padding: 3px 6px;
          font-size: 9pt;
          text-align: center;
          line-height: 1.3;
        }
        .sf4-table th { background: #e8e8e8; font-weight: bold; }
        .sf4-cell-left { text-align: left !important; }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {goBack && (
            <button
              onClick={goBack}
              className="mb-2 text-xs font-semibold text-primary-light bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 border border-primary/20 rounded-lg px-3 py-1.5 transition-colors duration-150 active:scale-[0.98] no-print"
              type="button"
            >
              ← Back to Dashboard
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            School Form 4 — Monthly Learner Movement Report
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Logged in as: <strong className="text-gray-700 dark:text-gray-300">{user?.email || ""}</strong>
          </p>
        </div>
      </div>

      {/* Selectors */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm no-print">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              School Year
            </label>
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            >
              {SCHOOL_YEARS.map((sy) => (
                <option key={sy} value={sy}>{sy}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Grade Level
            </label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            >
              {gradeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Month
            </label>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>
      </div>
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 no-print">
        <button
          onClick={() => window.print()}
          disabled={!hasSelection || loading || rows.length === 0}
          className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
          type="button"
        >
          Print
        </button>
        {error && (
          <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400">
            {error}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm no-print">
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      )}

      {/* Guards */}
      {!loading && !hasSelection && (
        <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm no-print">
          Select a grade level and month to view the movement report.
        </div>
      )}
      {!loading && hasSelection && rows.length === 0 && (
        <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm no-print">
          No sections found for this grade level and school year.
        </div>
      )}
      {/* Report table */}
      {!loading && hasSelection && rows.length > 0 && (
        <div className="sf4-print-area bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Printable header */}
          <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-center uppercase tracking-wide text-gray-600 dark:text-gray-300">
              School Form 4 - Monthly Learner Movement Report
            </p>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
              {gradeLevel} · {schoolYear} · Month: {monthValue}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="sf4-table w-full text-xs">
              <thead>
                <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold">
                  <th className="sf4-cell-left p-2 w-40">Section</th>
                  <th colSpan={3} className="p-2">Beginning of Month</th>
                  <th className="p-2">Late Enrollment</th>
                  <th className="p-2">Transferred In</th>
                  <th className="p-2">Transferred Out</th>
                  <th className="p-2">Dropped Out</th>
                  <th colSpan={3} className="p-2">End of Month</th>
                </tr>
                <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold">
                  <th className="p-2" />
                  <th className="p-2">M</th>
                  <th className="p-2">F</th>
                  <th className="p-2">Total</th>
                  <th className="p-2" />
                  <th className="p-2" />
                  <th className="p-2" />
                  <th className="p-2" />
                  <th className="p-2">M</th>
                  <th className="p-2">F</th>
                  <th className="p-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
                {rows.map((row) => {
                  const isTotal = row.section === "TOTAL";
                  return (
                    <tr
                      key={row.section}
                      className={
                        isTotal
                          ? "bg-primary/10 dark:bg-primary/20 font-bold text-gray-900 dark:text-gray-100"
                          : "hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150"
                      }
                    >
                      <td className="sf4-cell-left p-2 border-r border-gray-200 dark:border-gray-700 font-semibold">
                        {row.section}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-mono">
                        {cell(row.beginningOfMonthMale)}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-mono">
                        {cell(row.beginningOfMonthFemale)}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-mono">
                        {row.beginningOfMonthTotal}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-mono">
                        {row.lateEnrollment}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-mono">
                        {row.transferredIn}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-mono">
                        {row.transferredOut}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-mono text-red-700 dark:text-red-400">
                        {row.droppedOut}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-mono">
                        {row.endOfMonthMale}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-mono">
                        {row.endOfMonthFemale}
                      </td>
                      <td className="p-2 font-mono font-bold">
                        {row.endOfMonthTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default SF4;


