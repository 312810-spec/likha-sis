// src/ReportCard.jsx
// SF9 - Learner's Performance Report (DepEd Order 15, s.2026, Annex G format)
// Single printable page per learner, showing term grades, final grades,
// general average, and attendance summary.

import { useState, useEffect, Fragment } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import useTeacherScope from "./hooks/useTeacherScope";
import { getSubjectWeights } from "./utils/subjectWeights";
import { makeSubjectWeightsResolver } from "./utils/shsSubjectWeights";
import { computeLearnerTermGrade } from "./utils/gradeComputations";
import { getSubjectRows, isShsGradeLevel, findCanonicalKey, LEGACY_SUBJECT_ROWS } from "./utils/subjectRows.js";
import schoolConfig from "./schoolConfig";
import { ArrowLeft, Printer, RefreshCw } from "lucide-react";

// ---- Helpers ----------------------------------------------------------------

// Count weekday (Mon–Fri) dates in a "YYYY-MM" month — same logic as getWeekdays in SF2.jsx
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

// Compute age from a "YYYY-MM-DD" birth date string as of today
function computeAge(birthDateString) {
  if (!birthDateString) return "";
  try {
    const birth = new Date(`${birthDateString}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const hasHadBirthday =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
    if (!hasHadBirthday) age--;
    return age;
  } catch {
    return "";
  }
}

// Short month name from "YYYY-MM"
function shortMonthName(monthValue) {
  if (!monthValue) return "";
  const [, mm] = monthValue.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[Number(mm) - 1] || monthValue;
}

// ---- Component --------------------------------------------------------------

export default function ReportCard({ user, goBack }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  const GRADE_OPTIONS = gradeOptions;
  const school = { ...schoolConfig, ...config };

  // DO 017 SHS: resolve weights for the school's configured SHS subjects
  // first, falling through to the static Grade 4-10 map.
  const shsSubjectList = [
    ...(config?.shs?.subjects || []),
    ...((config?.shs?.electiveClusters || []).flatMap((cluster) => cluster.subjects || [])),
  ];
  const getSHSAwareWeights = makeSubjectWeightsResolver(shsSubjectList, getSubjectWeights);

  // Filter state
  const [gradeLevelChoice, setGradeLevel] = useState(gradeOptions[0] || "Grade 4");
  // useSchoolConfig() resolves asynchronously, so gradeLevelChoice above is
  // seeded from the fallback grade list before the real (possibly narrower)
  // gradeLevelsOffered loads. Deriving the effective value at render time
  // (rather than syncing it back via an effect) keeps it always valid --
  // otherwise the section list would silently query a grade with none until
  // the user manually touched the dropdown.
  const gradeLevel = gradeOptions.includes(gradeLevelChoice)
    ? gradeLevelChoice
    : gradeOptions[0] || "Grade 4";
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const { sections: availableSections, loading } = useAvailableSections(gradeLevel, schoolYear);
  // An adviser is locked to their own advisory section -- never the open
  // Grade/Section picker below, which stays available to principal (the
  // other reportCard-authorized role, per pageAccess.js).
  const { adviser, roles, loading: scopeLoading } = useTeacherScope(user, schoolYear);
  const isAdviserRole = roles.includes("adviser");

  // Data state
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [learnersList, setLearnersList] = useState([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState("");

  // Computed per-learner report data
  const [attendanceMonths, setAttendanceMonths] = useState([]); // sorted "YYYY-MM" strings
  const [attendanceByMonth, setAttendanceByMonth] = useState({}); // "YYYY-MM" -> { classDays, absent, present }
  const [recordsBySubject, setRecordsBySubject] = useState({}); // subjKey -> { "Term 1": doc, ... }

  // ---- Load class data (learners + class records + attendance) --------------
  async function handleLoadClass(e) {
    if (e) e.preventDefault();
    if (!section.trim()) {
      setErrorMessage("Please enter a section name.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");

    try {
      // 1. Fetch learners -- scoped to this grade+section, not the whole school.
      const learnersSnap = await getDocs(
        query(
          collection(db, "learners"),
          where("gradeLevel", "==", gradeLevel),
          where("section", "==", section)
        )
      );
      const scopedLearners = learnersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = scopedLearners
        .filter((l) => {
          const matchSY =
            !l.schoolYear ||
            (l.schoolYear || "").trim().toLowerCase() === schoolYear.trim().toLowerCase();
          return matchSY;
        })
        .sort((a, b) => {
          const last = (a.lastName || "")
            .toLowerCase()
            .localeCompare((b.lastName || "").toLowerCase());
          if (last !== 0) return last;
          return (a.firstName || "")
            .toLowerCase()
            .localeCompare((b.firstName || "").toLowerCase());
        });
      setLearnersList(filtered);
      const defaultId = filtered.length > 0 ? filtered[0].id : "";
      setSelectedLearnerId(defaultId);

      // 2. Fetch classRecords and group by subject -> term -- scoped to this
      //    grade+section, not the whole school.
      const recordsSnap = await getDocs(
        query(
          collection(db, "classRecords"),
          where("gradeLevel", "==", gradeLevel),
          where("section", "==", section)
        )
      );
      const scopedRecords = recordsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filteredRecords = scopedRecords.filter(
        (r) => (r.schoolYear || "").trim().toLowerCase() === schoolYear.trim().toLowerCase()
      );
      const bySubject = {};
      filteredRecords.forEach((rec) => {
        if (!rec.subject) return;
        // Resolves to the same canonical Annex G row key subjectRows below
        // reads from (e.g. "EPP" and "TLE" both resolve to "EPP/TLE") --
        // falls back to a raw uppercase match for anything with no
        // canonical row (SHS subjects), preserving today's behavior there.
        const sk = findCanonicalKey(rec.subject, LEGACY_SUBJECT_ROWS) || rec.subject.trim().toUpperCase();
        if (!bySubject[sk]) bySubject[sk] = {};
        const tk = (rec.term || "").trim();
        if (tk) bySubject[sk][tk] = rec;
      });
      setRecordsBySubject(bySubject);

      // 3. Fetch attendance docs matching gradeLevel + section -- scoped to
      //    this grade+section, not the whole school.
      const attendSnap = await getDocs(
        query(
          collection(db, "attendance"),
          where("gradeLevel", "==", gradeLevel),
          where("section", "==", section)
        )
      );
      const filteredAttend = attendSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Collect distinct months
      const monthSet = new Set();
      filteredAttend.forEach((doc) => {
        if (doc.month) monthSet.add(doc.month);
      });
      const sortedMonths = Array.from(monthSet).sort();
      setAttendanceMonths(sortedMonths);

      // Build lookup: month -> attendance doc
      const attendDocByMonth = {};
      filteredAttend.forEach((doc) => {
        if (doc.month) attendDocByMonth[doc.month] = doc;
      });

      // Pre-compute class days per month (independent of learner)
      const byMonth = {};
      sortedMonths.forEach((m) => {
        byMonth[m] = {
          classDays: countWeekdays(m),
          attendDoc: attendDocByMonth[m] || null,
        };
      });
      setAttendanceByMonth(byMonth);

      setIsLoaded(true);
    } catch (err) {
      console.error("Error loading report card data:", err);
      setErrorMessage("Failed to load data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // An adviser skips the Grade/Section picker entirely: lock the picker
  // state to their advisory section, then auto-trigger the same load logic
  // once that state has settled (same two-step lock pattern as SF1/SF4).
  useEffect(() => {
    if (!adviser) return;
    if (gradeLevelChoice !== adviser.gradeLevel || section !== adviser.section) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGradeLevel(adviser.gradeLevel);
      setSection(adviser.section);
    }
  }, [adviser, gradeLevelChoice, section]);

  useEffect(() => {
    if (!adviser || isLoaded || isLoading) return;
    if (gradeLevel !== adviser.gradeLevel || section !== adviser.section) return;
    // Deferred so handleLoadClass's setIsLoading(true) doesn't run
    // synchronously within this effect's render pass.
    const timer = setTimeout(() => handleLoadClass(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviser, gradeLevel, section, isLoaded, isLoading]);

  // ---- Derived data for the selected learner --------------------------------

  const selectedLearner = learnersList.find((l) => l.id === selectedLearnerId) || null;
  const learnerGradeLevel = selectedLearner?.gradeLevel || gradeLevel;
  const isSHS = isShsGradeLevel(learnerGradeLevel);
  const subjectRows = getSubjectRows(learnerGradeLevel, selectedLearner, config?.shs);

  // Compute grade data for the selected learner
  function getLearnerSubjectData(learnerId) {
    const result = {};
    subjectRows.forEach(({ key, isHeader }) => {
      if (isHeader || !key) return;
      const termsObj = recordsBySubject[key] || {};
      const termGrades = [];
      const t1 = termsObj["Term 1"]
        ? computeLearnerTermGrade(termsObj["Term 1"], learnerId, getSHSAwareWeights)
        : null;
      const t2 = termsObj["Term 2"]
        ? computeLearnerTermGrade(termsObj["Term 2"], learnerId, getSHSAwareWeights)
        : null;
      const t3 = termsObj["Term 3"]
        ? computeLearnerTermGrade(termsObj["Term 3"], learnerId, getSHSAwareWeights)
        : null;

      if (typeof t1 === "number" && !isNaN(t1)) termGrades.push(t1);
      if (typeof t2 === "number" && !isNaN(t2)) termGrades.push(t2);
      if (typeof t3 === "number" && !isNaN(t3)) termGrades.push(t3);

      let finalGrade = "—";
      if (termGrades.length > 0) {
        finalGrade = Math.round(termGrades.reduce((s, g) => s + g, 0) / termGrades.length);
      }

      result[key] = {
        t1: typeof t1 === "number" && !isNaN(t1) ? t1 : "—",
        t2: typeof t2 === "number" && !isNaN(t2) ? t2 : "—",
        t3: typeof t3 === "number" && !isNaN(t3) ? t3 : "—",
        final: finalGrade,
      };
    });
    return result;
  }

  const learnerSubjectData = isLoaded && selectedLearnerId
    ? getLearnerSubjectData(selectedLearnerId)
    : {};

  // General Average (excluding header rows)
  const validFinals = subjectRows.filter((r) => !r.isHeader && r.key)
    .map((r) => learnerSubjectData[r.key]?.final)
    .filter((g) => typeof g === "number");
  const genAvg =
    validFinals.length > 0
      ? Math.round(validFinals.reduce((s, g) => s + g, 0) / validFinals.length)
      : "—";

  // Attendance per month for the selected learner
  function getAttendanceForLearner(learnerId) {
    return attendanceMonths.map((m) => {
      const { classDays, attendDoc } = attendanceByMonth[m] || { classDays: 0, attendDoc: null };
      let absent = 0;
      if (attendDoc && attendDoc.records && attendDoc.records[learnerId]) {
        const rec = attendDoc.records[learnerId];
        absent = Object.values(rec).filter((v) => v === "A").length;
      }
      const present = Math.max(0, classDays - absent);
      return { month: m, classDays, absent, present };
    });
  }

  const attendanceRows = isLoaded && selectedLearnerId
    ? getAttendanceForLearner(selectedLearnerId)
    : [];

  const totalClassDays = attendanceRows.reduce((s, r) => s + r.classDays, 0);
  const totalAbsent = attendanceRows.reduce((s, r) => s + r.absent, 0);
  const totalPresent = attendanceRows.reduce((s, r) => s + r.present, 0);

  // ---- Helper: Remarks column -----------------------------------------------
  function getRemarks(finalGrade) {
    if (typeof finalGrade !== "number") return "—";
    return finalGrade >= 75 ? "Passed" : "Failed";
  }

  // ---- Render ----------------------------------------------------------------
  return (
    <div>
      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .rc-print-area, .rc-print-area * { visibility: visible; }
          .rc-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          /* Same defensive pattern as SF4/SF8/SF10: force this print area back
             to plain black-on-white if dark mode is active, so a future edit
             that adds a dark: class here can't silently leak onto paper. */
          html.dark .rc-print-area, html.dark .rc-print-area * {
            background-color: #fff !important;
            color: #000 !important;
            border-color: #000 !important;
          }
          /* Measured directly from the real workbook's pageSetup XML (both
             the FRONT and BACK sheets of the source are landscape) --
             replaces an earlier, unmeasured "letter portrait" guess.
             Paper size isn't set explicitly in the source XML (inherits
             printer default); A4 is used here for consistency with every
             other measured LIKHA-SIS DepEd form (SF1/SF2/SF4/SF8 all
             measured A4), not independently confirmed for SF9. */
          @page { size: A4 landscape; margin: 0.3in 0.24in; }
        }
        .rc-table { border-collapse: collapse; width: 100%; }
        .rc-table th, .rc-table td {
          border: 1px solid #000;
          padding: 2px 4px;
          font-size: 8.5pt;
          text-align: center;
          line-height: 1.2;
        }
        .rc-table th { background: #e8e8e8; font-weight: bold; }
        .rc-cell-left { text-align: left !important; }
        .rc-sig-line {
          display: block;
          border-bottom: 1px solid #000;
          margin-top: 18px;
          width: 100%;
        }
      `}</style>

      {/* ---- Filter / Controls (no-print) ---- */}
      <div className="no-print space-y-4">
        <div className="flex items-center gap-3">
          {goBack && (
            <button
              onClick={goBack}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 active:scale-[0.98]"
              title="Back"
              type="button"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="font-display text-2xl font-semibold text-gray-900 dark:text-gray-100">Report Card (SF9)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Learner&apos;s Performance Report per DO 15, s.2026, Annex G
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-fade-in">
            {errorMessage}
          </div>
        )}

        {!isLoaded && isAdviserRole && !scopeLoading && !adviser ? (
          <div className="max-w-lg bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              No advisory class is assigned to your account. Please contact the ICT Coordinator.
            </p>
          </div>
        ) : !isLoaded && adviser ? (
          <div className="max-w-xl bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <RefreshCw className="animate-spin" size={16} />
            Loading your advisory class ({adviser.gradeLevel} — {adviser.section})…
          </div>
        ) : !isLoaded ? (
          <form
            onSubmit={handleLoadClass}
            className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-xl space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Section</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Grade Level
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Section
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                >
                  <option value="">Select a section</option>
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
                {availableSections.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {loading ? "Loading sections..." : "No sections found. Add learners in SF1 first."}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                School Year
              </label>
              <input
                type="text"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                placeholder="2026-2027"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Loading...
                </>
              ) : (
                "Load Class"
              )}
            </button>

            {isLoading && (
              <div className="space-y-3 pt-2">
                <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              </div>
            )}
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            {adviser ? (
              <button
                onClick={() => handleLoadClass()}
                disabled={isLoading}
                className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                type="button"
                title="Reload this advisory class"
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                Reload Class
              </button>
            ) : (
              <button
                onClick={() => setIsLoaded(false)}
                className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 active:scale-[0.98] flex items-center gap-2"
                type="button"
              >
                <RefreshCw size={16} />
                Change Class
              </button>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Select Learner
              </label>
              <select
                value={selectedLearnerId}
                onChange={(e) => setSelectedLearnerId(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors min-w-[280px]"
              >
                {learnersList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lastName}, {l.firstName}
                    {l.lrn ? ` (${l.lrn})` : ""}
                  </option>
                ))}
                {learnersList.length === 0 && (
                  <option disabled>No learners found</option>
                )}
              </select>
            </div>
            <button
              onClick={() => window.print()}
              disabled={!selectedLearnerId}
              className="ml-auto px-4 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
              type="button"
            >
              <Printer size={18} />
              Print
            </button>
          </div>
        )}
      </div>

      {/* ---- Printable Report Card ---- */}
      {isLoaded && selectedLearner && (
        <div
          className="rc-print-area"
          style={{
            fontFamily: "Calibri, Carlito, Arial, sans-serif",
            fontSize: "8.5pt",
            background: "#fff",
            padding: "8px 12px",
            marginTop: "16px",
            border: "1px solid #ccc",
            /* A4 landscape printable width (11.69in - 0.24in*2 margins) at
               96px/in -- matches the real page orientation now that @page
               is measured, not the portrait-shaped 780px this used to be. */
            maxWidth: "1080px",
          }}
        >
          {/* ===== HEADER: two-column ===== */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
            <tbody>
              <tr>
                {/* Left: School info */}
                <td
                  style={{
                    width: "48%",
                    verticalAlign: "top",
                    padding: "0 4px 0 0",
                    fontSize: "7.5pt",
                    lineHeight: "1.35",
                  }}
                >
                  <div>Republic of the Philippines</div>
                  <div>Department of Education</div>
                  <div>{school.region}</div>
                  <div>SCHOOLS DIVISION OFFICE OF {school.divisionOffice}</div>
                  <div>{school.district}</div>
                  <div>{school.municipalityCityProvince}</div>
                  <div>
                    <strong>School: </strong>
                    {school.schoolName}
                  </div>
                  {school.schoolId && (
                    <div>
                      <strong>School ID: </strong>
                      {school.schoolId}
                    </div>
                  )}
                </td>

                {/* Right: Logo placeholder + Attendance table */}
                <td style={{ width: "52%", verticalAlign: "top", padding: "0 0 0 4px" }}>
                  {/* School logo placeholder */}
                  <div style={{ textAlign: "center", marginBottom: "6px" }}>
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        border: "1px solid #000",
                        borderRadius: "50%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "6.5pt",
                        textAlign: "center",
                        lineHeight: "1.2",
                        color: "#555",
                      }}
                    >
                      School<br />Logo
                    </div>
                  </div>

                  {/* Attendance Record table */}
                  <div
                    style={{
                      fontSize: "6.5pt",
                      fontWeight: "bold",
                      textAlign: "center",
                      marginBottom: "2px",
                    }}
                  >
                    ATTENDANCE RECORD
                  </div>
                  <table className="rc-table" style={{ fontSize: "7pt" }}>
                    <thead>
                      <tr>
                        <th className="rc-cell-left" style={{ fontSize: "7pt", padding: "2px 3px" }}>
                          &nbsp;
                        </th>
                        {attendanceMonths.map((m) => (
                          <th key={m} style={{ padding: "2px 3px" }}>
                            {shortMonthName(m)}
                          </th>
                        ))}
                        {attendanceMonths.length === 0 && (
                          <th style={{ padding: "2px 3px" }}>—</th>
                        )}
                        <th style={{ padding: "2px 3px" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="rc-cell-left" style={{ padding: "2px 3px" }}>
                          No. of Class Days
                        </td>
                        {attendanceRows.map((r) => (
                          <td key={r.month}>{r.classDays}</td>
                        ))}
                        {attendanceRows.length === 0 && <td>—</td>}
                        <td>{totalClassDays || "—"}</td>
                      </tr>
                      <tr>
                        <td className="rc-cell-left" style={{ padding: "2px 3px" }}>
                          No. of Days Present
                        </td>
                        {attendanceRows.map((r) => (
                          <td key={r.month}>{r.present}</td>
                        ))}
                        {attendanceRows.length === 0 && <td>—</td>}
                        <td>{totalPresent || "—"}</td>
                      </tr>
                      <tr>
                        <td className="rc-cell-left" style={{ padding: "2px 3px" }}>
                          No. of Days Absent
                        </td>
                        {attendanceRows.map((r) => (
                          <td key={r.month}>{r.absent}</td>
                        ))}
                        {attendanceRows.length === 0 && <td>—</td>}
                        <td>{totalAbsent || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ===== REPORT TITLE ===== */}
          <div
            style={{
              textAlign: "center",
              fontWeight: "bold",
              fontSize: "10pt",
              margin: "4px 0 2px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Learner&apos;s Performance Report
          </div>
          <div style={{ textAlign: "center", fontSize: "8pt", marginBottom: "4px" }}>
            School Year: <strong>{schoolYear}</strong>
          </div>

          {/* ===== LEARNER INFO ROW ===== */}
          <table
            style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px", fontSize: "8pt" }}
          >
            <tbody>
              <tr>
                <td style={{ padding: "1px 3px", width: "50%" }}>
                  <strong>Name: </strong>
                  {`${selectedLearner.lastName || ""}, ${selectedLearner.firstName || ""}${
                    selectedLearner.middleName ? " " + selectedLearner.middleName : ""
                  }`.trim()}
                </td>
                <td style={{ padding: "1px 3px", width: "20%" }}>
                  <strong>Age: </strong>
                  {computeAge(selectedLearner.birthDate)}
                </td>
                <td style={{ padding: "1px 3px", width: "30%" }}>
                  <strong>Sex: </strong>
                  {selectedLearner.sex || ""}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "1px 3px", width: "40%" }}>
                  <strong>LRN: </strong>
                  {selectedLearner.lrn || ""}
                </td>
                <td style={{ padding: "1px 3px", width: "20%" }}>
                  <strong>Grade: </strong>
                  {selectedLearner.gradeLevel || gradeLevel}
                </td>
                <td style={{ padding: "1px 3px", width: "40%" }}>
                  <strong>Section: </strong>
                  {selectedLearner.section || section}
                </td>
              </tr>
              {isSHS && (
                <tr>
                  <td colSpan={3} style={{ padding: "1px 3px" }}>
                    <strong>Track: </strong>
                    {selectedLearner?.track === "techPro"
                      ? "Tech-Pro Track"
                      : selectedLearner?.track === "academic"
                      ? "Academic Track"
                      : "—"}
                    {selectedLearner?.track === "techPro" && (
                      <>
                        {" "}
                        <strong>Cluster: </strong>
                        {(config?.shs?.electiveClusters || []).find((c) => c.id === selectedLearner?.cluster)
                          ?.name || "—"}
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ===== BOILERPLATE ===== */}
          <div style={{ fontSize: "7.5pt", marginBottom: "5px", lineHeight: "1.4" }}>
            <strong>Dear Parents,</strong>
            <br />
            This Performance Report shows the ability and progress your child has made in the
            different learning areas as well as his/her core values. The school welcomes you should
            you desire to know more about your child&apos;s progress.
          </div>

          {/* ===== MAIN LAYOUT: grades (left) | comments/sigs (right) ===== */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr style={{ verticalAlign: "top" }}>
                {/* LEFT: Grades table */}
                <td style={{ width: "62%", paddingRight: "6px" }}>
                  {/* Grades heading */}
                  <div
                    style={{
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "8pt",
                      marginBottom: "2px",
                      textTransform: "uppercase",
                    }}
                  >
                    Learning Progress and Achievement
                  </div>
                  <table className="rc-table">
                    <thead>
                      <tr>
                        <th className="rc-cell-left" style={{ width: "32%" }}>
                          Learning Areas
                        </th>
                        <th>Term 1</th>
                        <th>Term 2</th>
                        <th>Term 3</th>
                        <th>Final Grade</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectRows.map((row) => {
                        if (row.isHeader) {
                          return (
                            <tr key={row.label} style={{ background: "#f0f0f0" }}>
                              <td
                                colSpan={6}
                                className="rc-cell-left"
                                style={{ fontWeight: "bold", padding: "2px 4px" }}
                              >
                                {row.label}
                              </td>
                            </tr>
                          );
                        }
                        const d = learnerSubjectData[row.key] || {
                          t1: "—", t2: "—", t3: "—", final: "—",
                        };
                        const remarks = getRemarks(d.final);
                        return (
                          <tr key={row.label}>
                            <td
                              className="rc-cell-left"
                              style={{
                                fontStyle: row.isIndented ? "italic" : "normal",
                                paddingLeft: row.isIndented ? "10px" : "4px",
                              }}
                            >
                              {row.label}
                            </td>
                            <td>{d.t1}</td>
                            <td>{d.t2}</td>
                            <td>{d.t3}</td>
                            <td style={{ fontWeight: "bold" }}>{d.final}</td>
                            <td>{remarks}</td>
                          </tr>
                        );
                      })}
                      {/* General Average */}
                      <tr style={{ background: "#e8e8e8" }}>
                        <td
                          colSpan={4}
                          className="rc-cell-left"
                          style={{ fontWeight: "bold", padding: "2px 4px" }}
                        >
                          General Average
                        </td>
                        <td style={{ fontWeight: "bold" }}>{genAvg}</td>
                        <td style={{ fontWeight: "bold" }}>
                          {typeof genAvg === "number"
                            ? genAvg >= 75
                              ? "Passed"
                              : "Failed"
                            : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Grade Descriptors */}
                  <table className="rc-table" style={{ fontSize: "7pt", marginTop: "5px" }}>
                    <thead>
                      <tr>
                        <th>Grade Descriptors</th>
                        <th>Grading Scale</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Outstanding", "90-100", "Passed"],
                        ["Very Satisfactory", "85-89", "Passed"],
                        ["Satisfactory", "80-84", "Passed"],
                        ["Fairly Satisfactory", "75-79", "Passed"],
                        ["Did not meet expectations", "Below 75", "Failed"],
                      ].map(([desc, scale, rem]) => (
                        <tr key={desc}>
                          <td className="rc-cell-left">{desc}</td>
                          <td>{scale}</td>
                          <td>{rem}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>

                {/* RIGHT: Comments, Signatures, Transfer certificates */}
                <td style={{ width: "38%", paddingLeft: "4px", fontSize: "7.5pt" }}>
                  {/* Teacher's Comments */}
                  <div style={{ border: "1px solid #000", padding: "4px", marginBottom: "5px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "3px", fontSize: "7.5pt" }}>
                      TEACHER&apos;S COMMENTS / REMARKS
                    </div>
                    {["Term 1", "Term 2", "Term 3"].map((term) => (
                      <div key={term} style={{ marginBottom: "6px" }}>
                        <div style={{ fontSize: "7pt", fontStyle: "italic" }}>{term}:</div>
                        <div style={{ borderBottom: "1px solid #000", minHeight: "16px" }} />
                        <div style={{ borderBottom: "1px solid #000", minHeight: "16px", marginTop: "3px" }} />
                      </div>
                    ))}
                  </div>

                  {/* Parents / Guardian Signature */}
                  <div style={{ border: "1px solid #000", padding: "4px", marginBottom: "5px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "3px", fontSize: "7.5pt" }}>
                      PARENTS / GUARDIAN&apos;S SIGNATURE
                    </div>
                    {["Term 1", "Term 2", "Term 3"].map((term) => (
                      <div key={term} style={{ marginBottom: "10px" }}>
                        <div style={{ borderBottom: "1px solid #000", minHeight: "20px" }} />
                        <div style={{ fontSize: "7pt", textAlign: "center" }}>{term}</div>
                      </div>
                    ))}
                  </div>

                  {/* Certificate of Transfer */}
                  <div style={{ border: "1px solid #000", padding: "4px", marginBottom: "5px" }}>
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: "4px",
                        fontSize: "7.5pt",
                        textAlign: "center",
                      }}
                    >
                      CERTIFICATE OF TRANSFER
                    </div>
                    <div style={{ marginBottom: "4px" }}>
                      Admitted to Grade: ____________________
                    </div>
                    <div style={{ marginBottom: "4px" }}>
                      Eligible for Admission to Grade: __________
                    </div>
                    <div style={{ marginBottom: "3px" }}>Approved:</div>
                    <div style={{ borderBottom: "1px solid #000", minHeight: "16px", marginBottom: "2px" }} />
                    <div style={{ textAlign: "center", fontSize: "7pt" }}>Adviser</div>
                    <div style={{ borderBottom: "1px solid #000", minHeight: "16px", marginTop: "6px", marginBottom: "2px" }} />
                    <div style={{ textAlign: "center", fontSize: "7pt" }}>School Head</div>
                  </div>

                  {/* Cancellation of Eligibility to Transfer */}
                  <div style={{ border: "1px solid #000", padding: "4px" }}>
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: "4px",
                        fontSize: "7.5pt",
                        textAlign: "center",
                      }}
                    >
                      CANCELLATION OF ELIGIBILITY TO TRANSFER
                    </div>
                    <div style={{ marginBottom: "4px" }}>Admitted in: ____________________</div>
                    <div style={{ marginBottom: "4px" }}>Date: ____________________</div>
                    <div style={{ borderBottom: "1px solid #000", minHeight: "16px", marginTop: "8px", marginBottom: "2px" }} />
                    <div style={{ textAlign: "center", fontSize: "7pt" }}>School Head</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/*
            ===== Report on Learner's Observed Values =====
            Required section per the official SF9 back page -- was missing
            entirely. DepEd's 4 core values (Maka-Diyos, Makatao,
            Makakalikasan, Makabansa), each with their official behavior
            statements, rated per term as Always/Sometimes/Rarely/Never
            Observed. Reference uses legacy "Grading Quarter" columns; this
            uses Term 1-3 per DO 15 s.2026's 3-term calendar (CLAUDE.md --
            never reintroduce Q1-Q4 terminology). No digital rating capture
            exists yet for this section (no Firestore field backs it), so
            the AO/SO/RO/NO cells print blank for manual completion --
            adding that is a separate feature decision, not a fidelity fix.
          */}
          <div
            style={{
              fontSize: "10pt",
              fontWeight: "bold",
              textTransform: "uppercase",
              margin: "6px 0 2px",
            }}
          >
            Report on Learner&apos;s Observed Values
          </div>
          <table className="rc-table" style={{ fontSize: "7pt" }}>
            <thead>
              <tr>
                <th style={{ width: "14%" }}>Core Values</th>
                <th style={{ width: "46%" }}>Behavior Statements</th>
                <th colSpan={3}>Term</th>
              </tr>
              <tr>
                <th />
                <th />
                <th>1</th>
                <th>2</th>
                <th>3</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  value: "Maka-Diyos",
                  statements: [
                    "Expresses one's spiritual beliefs while respecting the spiritual beliefs of others",
                    "Shows adherence to ethical principles by upholding truth",
                  ],
                },
                {
                  value: "Makatao",
                  statements: [
                    "Is sensitive to individual, social and cultural differences",
                    "Demonstrates contributions toward solidarity",
                  ],
                },
                {
                  value: "Makakalikasan",
                  statements: [
                    "Cares for the environment and utilizes resources wisely, judisciously and economically",
                  ],
                },
                {
                  value: "Makabansa",
                  statements: [
                    "Demonstrates pride in being a Filipino; exercises the rights and responsibilities of a Filipino citizen",
                    "Demonstrates appropriate behavior in carrying out activities in the school, community and country",
                  ],
                },
              ].map((group) => (
                <Fragment key={group.value}>
                  {group.statements.map((statement, i) => (
                    <tr key={statement}>
                      {i === 0 && (
                        <td className="rc-cell-left" rowSpan={group.statements.length} style={{ fontWeight: "bold" }}>
                          {group.value}
                        </td>
                      )}
                      <td className="rc-cell-left">{statement}</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: "6.5pt", marginTop: "2px" }}>
            Marking: AO - Always Observed &nbsp; SO - Sometimes Observed &nbsp; RO - Rarely Observed &nbsp; NO - Never Observed
          </div>
        </div>
      )}

      {/* Empty state when loaded but no learner */}
      {isLoaded && !selectedLearner && (
        <div className="mt-6 p-8 bg-white rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
          No learners found for {gradeLevel} — {section} ({schoolYear}).
        </div>
      )}
    </div>
  );
}
