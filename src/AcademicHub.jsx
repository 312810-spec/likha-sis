// src/AcademicHub.jsx
// Academic Hub — combined Grades + Attendance rollup for a section.
// Reuses ConsolidatedGrades' grade computation and SF2's attendance-year-overview
// logic rather than introducing a new Firestore collection: this page is a read-only
// aggregate over the existing `classRecords`, `learners`, and `attendance` collections.

import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import { getSubjectWeights } from "./utils/subjectWeights";
import { makeSubjectWeightsResolver } from "./utils/shsSubjectWeights";
import { computeLearnerTermGrade } from "./utils/gradeComputations";
import { schoolYearFromMonth } from "./utils/attendanceDates";
import buildAttendanceYearOverview from "./utils/attendanceYearOverview";
import { ArrowLeft, LayoutDashboard, RefreshCw } from "lucide-react";

export default function AcademicHub({ goBack }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];

  const shsSubjectList = [
    ...(config?.shs?.subjects || []),
    ...((config?.shs?.electiveClusters || []).flatMap((cluster) => cluster.subjects || [])),
  ];
  const getSHSAwareWeights = makeSubjectWeightsResolver(shsSubjectList, getSubjectWeights);

  const [gradeLevel, setGradeLevel] = useState(gradeOptions[0] || "Grade 4");
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const { sections: availableSections, loading: loadingSections } = useAvailableSections(gradeLevel, schoolYear);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rows, setRows] = useState([]);

  async function handleLoad(e) {
    if (e) e.preventDefault();
    if (!section.trim()) {
      setErrorMessage("Please select a section.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");

    try {
      // Learners for this class
      const learnersSnap = await getDocs(collection(db, "learners"));
      const learners = learnersSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(
          (l) =>
            (l.gradeLevel || "").trim().toLowerCase() === gradeLevel.trim().toLowerCase() &&
            (l.section || "").trim().toLowerCase() === section.trim().toLowerCase() &&
            (!l.schoolYear || (l.schoolYear || "").trim().toLowerCase() === schoolYear.trim().toLowerCase())
        )
        .sort((a, b) => {
          const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
          if (last !== 0) return last;
          return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
        });

      // Grades: classRecords for this class, grouped by subject/term
      const recordsSnap = await getDocs(collection(db, "classRecords"));
      const filteredRecords = recordsSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(
          (r) =>
            (r.gradeLevel || "").trim().toLowerCase() === gradeLevel.trim().toLowerCase() &&
            (r.section || "").trim().toLowerCase() === section.trim().toLowerCase() &&
            (r.schoolYear || "").trim().toLowerCase() === schoolYear.trim().toLowerCase()
        );

      const recordsBySubject = {};
      filteredRecords.forEach((rec) => {
        if (!rec.subject) return;
        const subjKey = rec.subject.trim().toUpperCase();
        if (!recordsBySubject[subjKey]) recordsBySubject[subjKey] = {};
        const termKey = (rec.term || "").trim();
        if (termKey) recordsBySubject[subjKey][termKey] = rec;
      });
      const subjects = Object.keys(recordsBySubject);

      // Attendance: this class's attendance docs for the selected school year
      const attendanceSnap = await getDocs(collection(db, "attendance"));
      const monthDocs = attendanceSnap.docs
        .map((docSnap) => docSnap.data())
        .filter(
          (d) =>
            d.gradeLevel === gradeLevel &&
            d.section === section &&
            schoolYearFromMonth(d.month) === schoolYear
        );
      const yearOverview = buildAttendanceYearOverview({ monthDocs, learners });
      const attendanceByLearner = new Map(yearOverview.perLearner.map((l) => [l.learnerId, l.yearAverage]));

      const computedRows = learners.map((learner) => {
        const validFinalGrades = subjects
          .map((subj) => {
            const termsObj = recordsBySubject[subj] || {};
            const termGrades = ["Term 1", "Term 2", "Term 3"]
              .map((termKey) => termsObj[termKey])
              .filter(Boolean)
              .map((rec) => computeLearnerTermGrade(rec, learner.id, getSHSAwareWeights))
              .filter((tg) => typeof tg === "number" && !isNaN(tg));
            if (termGrades.length === 0) return null;
            return termGrades.reduce((sum, g) => sum + g, 0) / termGrades.length;
          })
          .filter((g) => typeof g === "number");

        const genAvg =
          validFinalGrades.length > 0
            ? Math.round(validFinalGrades.reduce((sum, g) => sum + g, 0) / validFinalGrades.length)
            : null;
        const attendanceRate = attendanceByLearner.get(learner.id) ?? null;

        return {
          id: learner.id,
          name: `${learner.lastName || ""}, ${learner.firstName || ""} ${
            learner.middleName ? learner.middleName.charAt(0) + "." : ""
          }`.trim(),
          genAvg,
          attendanceRate,
          gradeFlag: typeof genAvg === "number" && genAvg < 70,
          attendanceFlag: typeof attendanceRate === "number" && attendanceRate < 80,
        };
      });

      setRows(computedRows);
      setIsLoaded(true);
    } catch (err) {
      console.error("Error loading Academic Hub:", err);
      setErrorMessage("Unable to load academic data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="flex items-center gap-2 mb-1">
        <LayoutDashboard size={22} className="text-primary" />
        <h1 className="font-display text-xl font-semibold text-gray-900 dark:text-white">Academic Hub</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        General Average and year-long attendance rate, side by side, for a section — read-only rollup over
        Class Record and Attendance data already on file.
      </p>

      <form onSubmit={handleLoad} className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Grade Level</label>
          <select
            value={gradeLevel}
            onChange={(e) => {
              setGradeLevel(e.target.value);
              setSection("");
              setIsLoaded(false);
            }}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 outline-none"
          >
            {gradeOptions.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Section</label>
          <select
            value={section}
            onChange={(e) => {
              setSection(e.target.value);
              setIsLoaded(false);
            }}
            disabled={loadingSections}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 outline-none min-w-[10rem]"
          >
            <option value="">Select section…</option>
            {availableSections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">School Year</label>
          <input
            type="text"
            value={schoolYear}
            onChange={(e) => {
              setSchoolYear(e.target.value);
              setIsLoaded(false);
            }}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 outline-none w-32"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !section}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Loading…" : "Load"}
        </button>
      </form>

      {errorMessage && (
        <div className="mb-4 text-sm text-red-600 dark:text-red-400">{errorMessage}</div>
      )}

      {isLoaded && rows.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No learners found for this class.</p>
      )}

      {isLoaded && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Learner</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">General Average</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Attendance Rate (Year)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.name}</td>
                  <td
                    className={`px-4 py-2 text-right ${
                      r.gradeFlag ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-900 dark:text-gray-100"
                    }`}
                    title={r.gradeFlag ? "Below 70.00 — DO 15 academic intervention trigger" : undefined}
                  >
                    {typeof r.genAvg === "number" ? r.genAvg.toFixed(2) : "—"}
                  </td>
                  <td
                    className={`px-4 py-2 text-right ${
                      r.attendanceFlag ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-900 dark:text-gray-100"
                    }`}
                    title={r.attendanceFlag ? "Below 80% — LARDO risk trigger" : undefined}
                  >
                    {typeof r.attendanceRate === "number" ? `${r.attendanceRate.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
