// src/SMEAEnrollment.jsx
// SMEA — Enrollment Report (3-Term Enrollment Monitoring & Discrepancy Reporting)
//
// This report derives its data entirely from the existing Firestore "learners"
// collection (single source of truth, populated through SF1). It does NOT duplicate
// learner records or force external term storage on individual learners.
//
// Enrollment is summarized across Grade Level -> Section -> Sex with 3-Term academic
// calendar synchronization and automated discrepancy checks.

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import useAcademicCalendar from "./hooks/useAcademicCalendar";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { computeSMEAEnrollment } from "./utils/smeaEnrollment.js";
import computeSMEAIndicators from "./utils/smeaIndicators.js";
import { BarChart3, Users, AlertTriangle, Calendar, AlertCircle, Info, Activity } from "lucide-react";

function SMEAEnrollment() {
  const { calendar, schoolYears } = useAcademicCalendar();
  const { config } = useSchoolConfig();
  const [selectedSY, setSelectedSY] = useState("2026-2027");
  const [learners, setLearners] = useState([]);
  const [attendanceDocs, setAttendanceDocs] = useState([]);
  const [nutritionRecords, setNutritionRecords] = useState([]);
  const [lardoRecords, setLardoRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch learners plus the domains that feed the indicator rollup
  // (attendance, nutrition, LARDO) once on mount.
  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      setError("");
      try {
        const [learnersSnap, attendanceSnap, nutritionSnap, lardoSnap] = await Promise.all([
          getDocs(collection(db, "learners")),
          getDocs(collection(db, "attendance")),
          getDocs(collection(db, "nutritionRecords")),
          getDocs(collection(db, "lardoRecords")),
        ]);
        if (cancelled) return;
        setLearners(learnersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setAttendanceDocs(attendanceSnap.docs.map((docSnap) => docSnap.data()));
        setNutritionRecords(nutritionSnap.docs.map((docSnap) => docSnap.data()));
        setLardoRecords(lardoSnap.docs.map((docSnap) => docSnap.data()));
      } catch (err) {
        console.error("Failed to fetch learners for enrollment report:", err);
        if (!cancelled) setError("Unable to load enrollment data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const schoolYearOptions = schoolYears.includes(selectedSY)
    ? schoolYears
    : [selectedSY, ...schoolYears];

  const report = useMemo(
    () => computeSMEAEnrollment(learners, selectedSY, calendar, new Date()),
    [learners, selectedSY, calendar]
  );

  const indicators = useMemo(
    () =>
      computeSMEAIndicators({
        attendanceDocs,
        nutritionRecords,
        lardoRecords,
        selectedSY,
        gradeLevelsOffered: config?.gradeLevelsOffered || [],
      }),
    [attendanceDocs, nutritionRecords, lardoRecords, selectedSY, config]
  );

  const activeTerm = report.activeTerm;
  const termLabel = activeTerm ? activeTerm.label : "Outside configured academic period";
  const schoolYearLabel = String(selectedSY).replace("-", "–");

  // ---------- Loading state -------------------------------------------------
  if (loading) {
    return (
      <div className="max-w-none w-full">
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400 dark:text-gray-500">
          <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Loading enrollment data...</p>
        </div>
      </div>
    );
  }

  // ---------- Error state ---------------------------------------------------
  if (error) {
    return (
      <div className="max-w-none w-full">
        <div className="flex items-start gap-2 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300 animate-fade-in">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>Unable to load enrollment data. Please try again.</span>
        </div>
      </div>
    );
  }

  // ---------- Empty state ---------------------------------------------------
  if (report.inSYCount === 0) {
    return (
      <div className="max-w-none w-full space-y-4">
        <ReportControls
          selectedSY={selectedSY}
          setSelectedSY={setSelectedSY}
          schoolYears={schoolYearOptions}
          schoolYearLabel={schoolYearLabel}
          termLabel={termLabel}
        />
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <Users size={22} className="text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-400 dark:text-gray-500">No enrollment records found for SY {schoolYearLabel}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-none w-full space-y-4">
      <ReportControls
        selectedSY={selectedSY}
        setSelectedSY={setSelectedSY}
        schoolYears={schoolYearOptions}
        schoolYearLabel={schoolYearLabel}
        termLabel={termLabel}
      />

      {/* 3-Term Academic Monitoring Status Cards */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            3-Term Academic Calendar Tracking (DO 15, s. 2026)
          </h4>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Active: <span className="font-semibold text-primary">{termLabel}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {report.termBreakdown.map((term) => (
            <div
              key={term.id}
              className={`p-3.5 rounded-lg border transition-all ${
                term.isCurrent
                  ? "bg-primary/5 border-primary dark:bg-primary/10 dark:border-primary/50 shadow-xs"
                  : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{term.label}</span>
                {term.isCurrent ? (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary text-white rounded-full">
                    Current Term
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">Scheduled</span>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {term.startDate || "TBD"} – {term.endDate || "TBD"}
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                {term.totalLearners} <span className="text-xs font-normal text-gray-500">enrolled</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Total Active Learners" value={report.totalLearners} tint="bg-primary/10 text-primary dark:bg-primary/20" />
        <SummaryCard label="Total Male" value={report.totalMale} tint="bg-leaf/10 text-leaf dark:bg-leaf/20" />
        <SummaryCard label="Total Female" value={report.totalFemale} tint="bg-accent/10 text-accent-dark dark:bg-accent/20" />
      </div>

      {/* Discrepancy & Data Quality Alerts */}
      {report.discrepancies.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle size={16} /> SF1 Record Discrepancies & Quality Indicators
            </h4>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
              {report.discrepancies.length} indicator{report.discrepancies.length === 1 ? "" : "s"}
            </span>
          </div>

          <ul className="space-y-1.5 text-sm text-amber-800 dark:text-amber-300">
            {report.discrepancies.map((disc, idx) => (
              <li key={idx} className="flex items-start gap-2">
                {disc.severity === "error" ? (
                  <AlertCircle size={15} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                ) : disc.severity === "info" ? (
                  <Info size={15} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                )}
                <span>{disc.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
            Learners with critical record errors or transferred-out status are segregated from active enrollment totals to preserve SMEA reporting accuracy.
          </p>
        </div>
      )}

      {/* Other SMEA Indicators — attendance, nutrition, LARDO monitoring per grade */}
      {indicators.rows.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-5">
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
            <Activity size={18} className="text-primary" />
            Other SMEA Indicators
          </h4>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-y border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Grade</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Attendance Rate</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nutrition (Normal)</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nutrition (Wasted+)</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">LARDO Monitoring</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {indicators.rows.map((row) => {
                  const wastedPct =
                    (row.nutrition.severelyWastedPct ?? 0) + (row.nutrition.wastedPct ?? 0);
                  return (
                    <tr key={row.grade} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-3 py-3 text-gray-900 dark:text-gray-100 font-medium">{row.grade}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        {row.attendanceRate === null ? "—" : `${row.attendanceRate.toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        {row.nutrition.weighedCount === 0 ? "—" : `${(row.nutrition.normalPct ?? 0).toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        {row.nutrition.weighedCount === 0 ? "—" : `${wastedPct.toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.lardoMonitoringCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            Attendance, nutrition, and LARDO monitoring indicators aggregated from existing SF2, Nutrition Status,
            and LARDO Tracking records for SY {schoolYearLabel}. Academic performance indicators are not yet included.
          </p>
        </div>
      )}

      {/* Main Tabulation Table */}
      {report.gradeRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <AlertTriangle size={22} className="text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No valid active records to tabulate for SY {schoolYearLabel}. Check the discrepancy report above.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-5">
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-y border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Grade</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Section</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Male</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Female</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {report.gradeRows.map((row) => (
                  <RowGroup key={row.grade} row={row} />
                ))}
                <tr className="bg-primary/5 dark:bg-primary/10 font-semibold text-gray-900 dark:text-gray-100">
                  <td className="px-3 py-3" colSpan={2}>TOTAL</td>
                  <td className="px-3 py-3">{report.totalMale}</td>
                  <td className="px-3 py-3">{report.totalFemale}</td>
                  <td className="px-3 py-3">{report.totalLearners}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            Enrollment snapshot for SY {schoolYearLabel} ({termLabel}). Auto-aggregated from SF1 learner records.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tint }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg ${tint}`}>
        {value}
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">{label}</div>
    </div>
  );
}

// A single grade block: section rows + a grade subtotal row.
function RowGroup({ row }) {
  return (
    <>
      {row.sections.map((s) => (
        <tr key={s.section} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
          {s === row.sections[0] && (
            <td className="px-3 py-3 text-gray-900 dark:text-gray-100 font-medium align-top" rowSpan={row.sections.length}>
              {row.grade}
            </td>
          )}
          <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{s.section}</td>
          <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{s.male}</td>
          <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{s.female}</td>
          <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{s.total}</td>
        </tr>
      ))}
      <tr className="bg-gray-50/70 dark:bg-gray-800/40 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <td className="px-3 py-3">Subtotal — {row.grade}</td>
        <td className="px-3 py-3"></td>
        <td className="px-3 py-3">{row.male}</td>
        <td className="px-3 py-3">{row.female}</td>
        <td className="px-3 py-3">{row.total}</td>
      </tr>
    </>
  );
}

// School year selector + term display (shared by all states).
function ReportControls({ selectedSY, setSelectedSY, schoolYears, schoolYearLabel, termLabel }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 tracking-tight">
          <BarChart3 className="text-primary" size={24} />
          SMEA Enrollment Report
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Auto-generated 3-term enrollment monitoring derived from SF1 records.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
          School Year
          <select
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            value={selectedSY}
            onChange={(e) => setSelectedSY(e.target.value)}
          >
            {schoolYears.map((sy) => (
              <option key={sy} value={sy}>
                {String(sy).replace("-", "–")}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-xs sm:text-right">
          <span className="text-gray-400 dark:text-gray-500">
            SY <span className="font-semibold text-gray-700 dark:text-gray-200">{schoolYearLabel}</span>
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            Current Term <span className="font-semibold text-gray-700 dark:text-gray-200">{termLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default SMEAEnrollment;
