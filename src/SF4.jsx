// src/SF4.jsx
// School Form 4 — Monthly Learner Movement and Attendance Report.
// Per-section rows follow the official DepEd SF4 layout: registered learners
// (as of end of month), daily average attendance and attendance percentage,
// NLPA ("No Longer Participating in Learning Activities", formerly "Dropped
// Out"), Transferred Out and Transferred In — each movement block with the
// (A) cumulative as of previous month / (B) for the month / (A+B) cumulative
// as of end of month period structure, split by Male / Female / Total. Below
// the table a school-wide Mortality (Death) block is listed. All data is read
// client-side from the existing learners, transfers, and attendance
// collections; mortality numbers are manual inputs persisted to the
// "sf4Mortality" collection, matching the pattern SF2 uses for its summaries.

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useAcademicCalendar from "./hooks/useAcademicCalendar";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import {
  computeSF4Rows,
  computeSectionAttendance,
  isDropoutRemark,
} from "./utils/sf4Computations";

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

// Builds the Firestore document id for a school-wide mortality record:
// `${gradeLevel}_${schoolYear}_${monthValue}` with spaces replaced by
// underscores. E.g. "Grade 7" + "2026-2027" + "2026-08" ->
// "Grade_7_2026-2027_2026-08".
function makeMortalityDocumentId(gradeLevel, schoolYear, monthValue) {
  return `${gradeLevel.replace(/ /g, "_")}_${schoolYear.replace(/ /g, "_")}_${monthValue}`;
}

// Counts the weekday (Mon–Fri) dates in a "YYYY-MM" month — the same logic as
// SF2's getWeekdays, returning just the number of school days. Used to convert
// the SF2 attendance records into daily averages and percentages.
function countWeekdays(monthValue) {
  if (!monthValue) return 0;
  const year = Number(monthValue.slice(0, 4));
  const month = Number(monthValue.slice(5, 7));
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// Blank mortality inputs (previous month / for the month).
const DEFAULT_MORTALITY = { previousMonths: 0, forTheMonth: 0 };

function SF4({ user, goBack }) {
  const { config } = useSchoolConfig();
  // School year options come from School Settings > Academic Calendar,
  // falling back to the built-in SY 2026-2027 calendar.
  const { schoolYears } = useAcademicCalendar();
  const gradeOptions =
    config?.gradeLevelsOffered ||
    ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];

  const [schoolYear, setSchoolYear] = useState("2026-2027");
  // Keep the current selection listed even if the school later removes that
  // year from its academic calendar, so the dropdown never shows a blank value.
  const schoolYearOptions = schoolYears.includes(schoolYear)
    ? schoolYears
    : [schoolYear, ...schoolYears];
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

  // mortalityInputs: the two MANUAL school-wide mortality number inputs,
  // persisted to the "sf4Mortality" collection like SF2's summary inputs.
  const [mortalityInputs, setMortalityInputs] = useState({ ...DEFAULT_MORTALITY });
  const [isSavingMortality, setIsSavingMortality] = useState(false);
  const [mortalityStatus, setMortalityStatus] = useState("");

  const hasSelection = Boolean(gradeLevel && schoolYear && monthValue && sections.length > 0);

  // Fetch learners per section, transfers, and each section's attendance doc
  // (adviser name, NLPA remarks, and attendance records), then compute rows.
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
        //    Each learner carries its Firestore doc id so transfers and NLPA
        //    remarks can be resolved back to a sex for the M/F breakdown.
        const learnersBySection = {};
        const sexLookup = {};
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
            const learnerDoc = {
              ...data,
              id: snapDoc.id,
              sex: normalizeSex(data.sex),
              enrollmentStatus: data.enrollmentStatus || "active",
            };
            sexLookup[snapDoc.id] = learnerDoc.sex;
            return learnerDoc;
          });
        }

        // 2. Transfers for this school year, filtered to the selected grade
        //    level's sections and the selected month (transferDate "YYYY-MM-DD").
        //    Each transfer's sex comes from the roster above so movement can be
        //    reported by Male / Female.
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
          .map((t) => ({
            section: t.section,
            transferType: t.transferType,
            sex: sexLookup[t.learnerId] || "",
          }));

        // 3. Per-section attendance sheet: adviser name, NLPA remarks (remarks
        //    that start with "Dropped Out") and the records used for the daily
        //    average / percentage attendance columns.
        const nlpaInMonth = [];
        const advisersBySection = {};
        const attendanceBySection = {};
        const weekdaysCount = countWeekdays(monthValue);
        for (const section of sections) {
          const classValue = `${gradeLevel} - ${section}`;
          const docId = makeDocumentId(classValue, monthValue);
          const snap = await getDoc(doc(db, "attendance", docId));
          if (!snap.exists()) continue;

          const data = snap.data();
          advisersBySection[section] = data.adviserName || "";

          const remarks = data.remarks || {};
          Object.entries(remarks).forEach(([learnerId, remark]) => {
            if (isDropoutRemark(remark)) {
              nlpaInMonth.push({ section, sex: sexLookup[learnerId] || "" });
            }
          });

          // Attendance is computed against the registered (active) learners,
          // matching the "Registered Learners (As of End of the Month)" column.
          const activeLearners = (learnersBySection[section] || []).filter(
            (l) => l.enrollmentStatus === "active"
          );
          attendanceBySection[section] = computeSectionAttendance({
            records: data.records || {},
            learnerIds: {
              male: activeLearners
                .filter((l) => l.sex === "Male")
                .map((l) => l.id),
              female: activeLearners
                .filter((l) => l.sex === "Female")
                .map((l) => l.id),
            },
            weekdaysCount,
          });
        }

        if (cancelled) return;

        // "(A) Cumulative as of previous month" cannot be derived from current
        // data alone (no historical SF4 snapshots exist), so computeSF4Rows is
        // left with its zeros default for that input.
        const computed = computeSF4Rows({
          sections,
          learnersBySection,
          transfersInMonth,
          nlpaInMonth,
          attendanceBySection,
          advisersBySection,
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

  // Load any saved mortality numbers for the selected grade level + month.
  useEffect(() => {
    let cancelled = false;

    async function loadMortality() {
      if (!gradeLevel || !schoolYear || !monthValue) {
        setMortalityInputs({ ...DEFAULT_MORTALITY });
        return;
      }
      try {
        const docId = makeMortalityDocumentId(gradeLevel, schoolYear, monthValue);
        const snap = await getDoc(doc(db, "sf4Mortality", docId));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setMortalityInputs({
            previousMonths: data.previousMonths ?? 0,
            forTheMonth: data.forTheMonth ?? 0,
          });
        } else {
          setMortalityInputs({ ...DEFAULT_MORTALITY });
        }
      } catch (err) {
        console.error("Failed to load mortality data:", err);
      }
    }

    loadMortality();

    return () => {
      cancelled = true;
    };
  }, [gradeLevel, schoolYear, monthValue]);

  // Persists the school-wide mortality numbers for the current selection.
  async function handleSaveMortality() {
    if (!gradeLevel || !schoolYear || !monthValue) {
      setMortalityStatus("Select a grade level, school year and month first.");
      return;
    }
    setIsSavingMortality(true);
    setMortalityStatus("");
    try {
      const docId = makeMortalityDocumentId(gradeLevel, schoolYear, monthValue);
      await setDoc(doc(db, "sf4Mortality", docId), {
        gradeLevel,
        schoolYear,
        month: monthValue,
        previousMonths: Number(mortalityInputs.previousMonths) || 0,
        forTheMonth: Number(mortalityInputs.forTheMonth) || 0,
        updatedAt: serverTimestamp(),
      });
      setMortalityStatus("Mortality data saved successfully!");
    } catch (err) {
      console.error("Failed to save mortality data:", err);
      setMortalityStatus("Something went wrong while saving. Please try again.");
    } finally {
      setIsSavingMortality(false);
    }
  }

  // Renders one cell value, showing an em dash for null/absent amounts.
  function cell(item) {
    return item === null || item === undefined ? "—" : item;
  }

  // Renders a decimal like 28.33 (em dash when there is no data).
  function fmtNum(item) {
    return item === null || item === undefined ? "—" : Number(item).toFixed(2);
  }

  // Renders a percentage like 92.17% (em dash when there is no data).
  function fmtPct(item) {
    return item === null || item === undefined
      ? "—"
      : `${Number(item).toFixed(2)}%`;
  }

  // Three M / F / T cells for a { male, female, total } sex triple.
  function triad(sexPair) {
    return (
      <>
        <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
          {cell(sexPair?.male)}
        </td>
        <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
          {cell(sexPair?.female)}
        </td>
        <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
          {cell(sexPair?.total)}
        </td>
      </>
    );
  }

  // School-wide mortality cumulative computed as the sum of the two inputs,
  // included in the printable Mortality (Death) block below the table.
  const mortalityTotal =
    (Number(mortalityInputs.previousMonths) || 0) + (Number(mortalityInputs.forTheMonth) || 0);

  return (
    <div className="space-y-5 animate-slide-up">
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
          /* The table cells carry dark: Tailwind classes for on-screen
             readability. Those must never reach the printed page, so when
             dark mode is active, force this print area back to plain
             black-on-white — light-mode printing is unaffected. */
          html.dark .sf4-print-area, html.dark .sf4-print-area * {
            background-color: #fff !important;
            color: #000 !important;
            border-color: #000 !important;
          }
        }
        @page { size: A4 landscape; margin: 8mm; }
        .sf4-table { border-collapse: collapse; width: 100%; }
        .sf4-table th, .sf4-table td {
          border: 1px solid #000;
          padding: 2px 3px;
          font-size: 6.8pt;
          text-align: center;
          line-height: 1.25;
          overflow-wrap: break-word;
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
          <h1 className="font-display text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            School Form 4 — Monthly Learner Movement and Attendance Report
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
              {schoolYearOptions.map((sy) => (
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

      {/* Mortality (Death) manual inputs */}
      {hasSelection && (
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm no-print">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Mortality (Death)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                School-wide total for {gradeLevel} · {schoolYear} · {monthValue}.
                Cumulative as of end of month is computed as the sum of the two inputs.
              </p>
            </div>
            {mortalityStatus && (
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{mortalityStatus}</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Previous Month/s
              <input
                type="number"
                min="0"
                value={mortalityInputs.previousMonths}
                onChange={(e) =>
                  setMortalityInputs((prev) => ({ ...prev, previousMonths: e.target.value }))
                }
                className="mt-1 block w-28 text-sm text-right rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
              />
            </label>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              For the Month
              <input
                type="number"
                min="0"
                value={mortalityInputs.forTheMonth}
                onChange={(e) =>
                  setMortalityInputs((prev) => ({ ...prev, forTheMonth: e.target.value }))
                }
                className="mt-1 w-28 text-sm text-right rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
              />
            </label>
            <button
              onClick={handleSaveMortality}
              disabled={isSavingMortality}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
              type="button"
            >
              {isSavingMortality ? "Saving…" : "Save Mortality"}
            </button>
          </div>
        </div>
      )}

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
            <p className="text-sm font-bold text-center uppercase tracking-wide text-gray-900 dark:text-gray-100">
              School Form 4 — Monthly Learner Movement and Attendance Report
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-center text-gray-600 dark:text-gray-400 mt-1.5">
              <span>School ID: <strong>{config?.schoolId || "—"}</strong></span>
              <span>School: <strong>{config?.schoolName || "—"}</strong></span>
              {config?.district && <span>District: <strong>{config.district}</strong></span>}
              {config?.divisionOffice && (
                <span>Division: <strong>{config.divisionOffice}</strong></span>
              )}
              {config?.region && <span>Region: <strong>{config.region}</strong></span>}
              <span>Grade: <strong>{gradeLevel}</strong></span>
              <span>SY: <strong>{schoolYear}</strong></span>
              <span>Month: <strong>{monthValue}</strong></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="sf4-table w-full text-xs">
              <thead>
                <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold">
                  <th rowSpan={3} className="p-1 w-16">Grade/Year Level</th>
                  <th rowSpan={3} className="p-1 w-20">Section</th>
                  <th rowSpan={3} className="sf4-cell-left p-1 w-28">Name of Adviser</th>
                  <th colSpan={2} className="p-1">Registered Learners<br />(As of End of the Month)</th>
                  <th colSpan={3} className="p-1">Attendance<br />Daily Average</th>
                  <th colSpan={3} className="p-1">Attendance<br />Percentage for the Month</th>
                  <th colSpan={9} className="p-1">NLPA (No Longer Participating in Learning Activities)</th>
                  <th colSpan={9} className="p-1">Transferred Out</th>
                  <th colSpan={9} className="p-1">Transferred In</th>
                </tr>
                <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold">
                  <th colSpan={2} />
                  <th colSpan={3} />
                  <th colSpan={3} />
                  <th colSpan={3} className="p-1">A<br />(Cum. as of Prev. Mo.)</th>
                  <th colSpan={3} className="p-1">B<br />(For the Month)</th>
                  <th colSpan={3} className="p-1">A+B<br />(Cum. as of End of Mo.)</th>
                  <th colSpan={3} className="p-1">A<br />(Cum. as of Prev. Mo.)</th>
                  <th colSpan={3} className="p-1">B<br />(For the Month)</th>
                  <th colSpan={3} className="p-1">A+B<br />(Cum. as of End of Mo.)</th>
                  <th colSpan={3} className="p-1">A<br />(Cum. as of Prev. Mo.)</th>
                  <th colSpan={3} className="p-1">B<br />(For the Month)</th>
                  <th colSpan={3} className="p-1">A+B<br />(Cum. as of End of Mo.)</th>
                </tr>
                <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold">
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">T</th>
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">T</th>
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">T</th>
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">T</th>
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">T</th>
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">T</th>
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">T</th>
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">T</th>
                  <th className="p-1">M</th>
                  <th className="p-1">F</th>
                  <th className="p-1">T</th>
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
                      <td className="sf4-cell-left p-1 border border-gray-300 dark:border-gray-700">
                        {isTotal ? "" : gradeLevel}
                      </td>
                      <td className="sf4-cell-left p-1 border border-gray-300 dark:border-gray-700 font-semibold">
                        {isTotal ? "TOTAL" : row.section}
                      </td>
                      <td className="sf4-cell-left p-1 border border-gray-300 dark:border-gray-700">
                        {isTotal ? "" : row.adviserName}
                      </td>
                      <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
                        {row.endOfMonthMale}
                      </td>
                      <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
                        {row.endOfMonthFemale}
                      </td>
                      <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
                        {fmtNum(row.attendance?.dailyAverageMale)}
                      </td>
                      <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
                        {fmtNum(row.attendance?.dailyAverageFemale)}
                      </td>
                      <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
                        {fmtNum(row.attendance?.dailyAverageTotal)}
                      </td>
                      <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
                        {fmtPct(row.attendance?.percentageMale)}
                      </td>
                      <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
                        {fmtPct(row.attendance?.percentageFemale)}
                      </td>
                      <td className="p-1 border border-gray-300 dark:border-gray-700 font-mono">
                        {fmtPct(row.attendance?.percentageTotal)}
                      </td>
                      {triad(row.nlpaPrev)}
                      {triad(row.nlpaForMonth)}
                      {triad(row.nlpaCumulative)}
                      {triad(row.transferredOutPrev)}
                      {triad(row.transferredOutForMonth)}
                      {triad(row.transferredOutCumulative)}
                      {triad(row.transferredInPrev)}
                      {triad(row.transferredInForMonth)}
                      {triad(row.transferredInCumulative)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* NLPA legend + school-wide Mortality (Death) block */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-600 dark:text-gray-400">
              NLPA — No Longer Participating in Learning Activities: a learner
              who has not communicated with the adviser for 7 or more consecutive
              weeks (replaces the former "Dropped Out" designation).
            </p>
            <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">
              Mortality (Death) — School-wide Total
            </p>
            <table className="sf4-table mt-1" style={{ maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
              <thead>
                <tr>
                  <th className="p-1" style={{ width: "34%" }}>Detail</th>
                  <th className="p-1" style={{ width: "22%" }}>Previous Month/s</th>
                  <th className="p-1" style={{ width: "22%" }}>For the Month</th>
                  <th className="p-1" style={{ width: "22%" }}>Cumulative as of End of Month</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="sf4-cell-left p-1 font-semibold">School-wide Total</td>
                  <td className="p-1 font-mono">{cell(mortalityInputs.previousMonths)}</td>
                  <td className="p-1 font-mono">{cell(mortalityInputs.forTheMonth)}</td>
                  <td className="p-1 font-mono font-bold">{cell(mortalityTotal)}</td>
                </tr>
              </tbody>
            </table>

            {/* Certification Footer */}
            <div className="mt-6 flex flex-wrap items-center justify-between text-xs max-w-2xl mx-auto pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center w-5/12">
                <div className="border-b border-black dark:border-gray-400 min-h-[20px]" />
                <div className="mt-1 text-[11px] text-gray-700 dark:text-gray-300 font-medium">Prepared by: Class Advisers</div>
              </div>
              <div className="text-center w-5/12">
                <div className="border-b border-black dark:border-gray-400 min-h-[20px] font-bold text-gray-900 dark:text-gray-100">
                  {config?.principalName || ""}
                </div>
                <div className="mt-1 text-[11px] text-gray-700 dark:text-gray-300 font-medium">
                  {config?.principalPosition || "School Principal"} / Certified Correct
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SF4;


