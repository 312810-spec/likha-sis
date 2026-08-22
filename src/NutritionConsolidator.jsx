// src/NutritionConsolidator.jsx
// School-wide DepEd Nutritional Status (Baseline/Endline) Consolidator —
// aggregates every section's nutritionRecords into the printable summary
// grid used in TingubNHS-BASELINE-NS-CONSO-2026-2027.xlsx.

import { Fragment, useState, useEffect } from "react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { consolidateByGradeLevel, withPercentages } from "./utils/nutritionConsolidation.js";
import {
  ArrowLeft,
  ClipboardList,
  RefreshCw,
  AlertCircle,
  Printer,
} from "lucide-react";

const BMI_COLUMNS = [
  { key: "severelyWasted", label: "Severely Wasted" },
  { key: "wasted", label: "Wasted" },
  { key: "normal", label: "Normal" },
  { key: "overweight", label: "Overweight" },
  { key: "obese", label: "Obese" },
];

const HFA_COLUMNS = [
  { key: "severelyStunted", label: "Severely Stunted" },
  { key: "stunted", label: "Stunted" },
  { key: "normal", label: "Normal" },
  { key: "tall", label: "Tall" },
];

export default function NutritionConsolidator({ goBack }) {
  const { config } = useSchoolConfig();
  const gradeLevelsOffered = config?.gradeLevelsOffered || [];

  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [period, setPeriod] = useState("Baseline");
  const [clinicTeacherName, setClinicTeacherName] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "clinicTeacher"), limit(1));
        const snap = await getDocs(q);
        if (active && !snap.empty) {
          setClinicTeacherName(snap.docs[0].data().displayName || "");
        }
      } catch (err) {
        console.error("Failed to fetch clinic teacher:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // `result` carries a snapshot of the filters the report was actually
  // generated with, so the printed header can never drift from the numbers
  // when the user changes a dropdown after generating.
  const [result, setResult] = useState({
    gradeLevels: [],
    grandTotal: null,
    schoolYear: "",
    period: "",
  });

  async function handleGenerate(e) {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [learnersSnap, recordsSnap] = await Promise.all([
        getDocs(collection(db, "learners")),
        getDocs(collection(db, "nutritionRecords")),
      ]);
      const learners = learnersSnap.docs.map((d) => d.data());
      const nutritionRecords = recordsSnap.docs.map((d) => d.data());

      const generatedSchoolYear = schoolYear.trim();
      const generatedPeriod = period;

      const consolidated = consolidateByGradeLevel(learners, nutritionRecords, {
        schoolYear: generatedSchoolYear,
        period: generatedPeriod,
        gradeLevelsOffered,
      });
      setResult({
        ...consolidated,
        schoolYear: generatedSchoolYear,
        period: generatedPeriod,
      });
      setIsLoaded(true);
    } catch (err) {
      console.error("Failed to generate nutrition consolidator:", err);
      setErrorMessage("Failed to load data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  // The real workbook formats a percentage to one decimal place (e.g. 8.3%),
  // "—" when the denominator was 0 (see withPercentages' null convention).
  function formatPct(value) {
    return value == null ? "—" : `${value.toFixed(1)}%`;
  }

  // One sex's No./% pair for one category -- the leaf unit both Enrolment
  // (No. only, no % column in the source) and every other category (No.+%)
  // are built from.
  function renderNoCell(count) {
    return <td>{count}</td>;
  }
  function renderNoPctCells(count, pctValue) {
    return (
      <>
        <td>{count}</td>
        <td>{formatPct(pctValue)}</td>
      </>
    );
  }

  // Renders the 3 sex rows (M/F/T) for one grade-level group, with the
  // Grade Level cell rowSpan'd across all 3 -- matches the real workbook's
  // row structure (verified: each grade is 3 physical rows, T = M+F).
  function renderGradeGroup(row, isGrandTotal) {
    const withPct = withPercentages(row);
    const sexRows = ["M", "F", "T"];
    return (
      <Fragment key={row.gradeLevel}>
        {sexRows.map((sex, i) => (
          <tr key={sex} className={isGrandTotal ? "nc-grand-total" : ""}>
            {i === 0 && (
              <td className="nc-cell-left" rowSpan={3}>
                {isGrandTotal ? "GRAND TOTAL" : row.gradeLevel}
              </td>
            )}
            <td>{sex}</td>
            {renderNoCell(row.enrolment[sex])}
            {renderNoPctCells(row.weighed[sex], withPct.pct.weighed[sex])}
            {BMI_COLUMNS.map((col) => (
              <Fragment key={col.key}>
                {renderNoPctCells(row.bmi[col.key][sex], withPct.pct.bmi[col.key][sex])}
              </Fragment>
            ))}
            {HFA_COLUMNS.map((col) => (
              <Fragment key={`hfa-${col.key}`}>
                {renderNoPctCells(row.hfa[col.key][sex], withPct.pct.hfa[col.key][sex])}
              </Fragment>
            ))}
          </tr>
        ))}
      </Fragment>
    );
  }

  return (
    <div className="space-y-6 max-w-none w-full">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .nc-print-area, .nc-print-area * { visibility: visible; }
          .nc-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            color: #000;
            background: #fff;
          }
          /* Measured via raw pageSetup/margins XML against the real
             workbook: orientation was already correct, margins were not
             (was a flat 8mm; real is asymmetric). */
          @page { size: A4 landscape; margin: 0.75in 0.24in; }
        }
        /* Outer left/right frame is a medium border per styled-exceljs;
           internal grid lines stay thin. */
        .nc-table { border-collapse: collapse; width: 100%; border-left: 2px solid #000; border-right: 2px solid #000; }
        .nc-table th, .nc-table td {
          border: 1px solid #000;
          padding: 2px 3px;
          /* Real data-cell size measures 11pt, scaled by the sheet's own
             80% print scale -> 8.8pt. Was 6.5pt (unscaled-source guess). */
          font-size: 8.8pt;
          text-align: center;
          line-height: 1.2;
          color: #000;
          background: #fff;
        }
        /* Header sizes vary 8-12pt (6.4-9.6pt scaled) per-category in the
           source with internal inconsistencies even between sibling
           categories (e.g. "Severely Wasted" vs "Wasted" differ) -- 8pt is
           the representative middle value, not a per-cell measurement. */
        .nc-table th { background: #e8e8e8; font-weight: bold; font-size: 8pt; }
        .nc-cell-left { text-align: left !important; }
        .nc-grand-total td { font-weight: bold; background: #f0f0f0; }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 no-print">
        <div className="flex items-center space-x-3">
          {goBack && (
            <button
              onClick={goBack}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-150 active:scale-[0.98] transition-transform"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-rose-500" />
              Nutrition Status Consolidator
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              School-wide Baseline / Endline BMI + Height-for-Age rollup
            </p>
          </div>
        </div>
        {isLoaded && (
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-150 active:scale-[0.98] transition-transform shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        )}
      </div>

      <form
        onSubmit={handleGenerate}
        className="no-print bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            School Year
          </label>
          <input
            type="text"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-colors"
          >
            <option value="Baseline">Baseline</option>
            <option value="Endline">Endline</option>
          </select>
        </div>
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors duration-150 active:scale-[0.98] transition-transform shadow-sm text-sm"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {isLoading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </form>

      {errorMessage && (
        <div className="no-print animate-fade-in bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoaded && (
        <div className="nc-print-area">
          <div style={{ padding: "0.4in 0.5in", fontFamily: "Arial, Helvetica, sans-serif" }}>
            {/* Header block -- sizes measured via styled-exceljs against the
                real workbook then adjusted for its page setup's 80% print
                scale (e.g. a stored 14pt title prints at 14*0.8=11.2pt).
                "Department of Education" and the Division line were missing
                entirely; the source duplicates "Division of Mandaue City"
                on two separate lines, which reads as a data-entry slip in
                this one sample school's copy rather than an official
                template requirement, so only one Division line is added. */}
            <div style={{ textAlign: "center", color: "#000" }}>
              <div style={{ fontWeight: "bold", fontSize: "9.6pt" }}>Department of Education</div>
              {config?.divisionOffice && (
                <div style={{ fontWeight: "bold", fontSize: "9.6pt" }}>Division of {config.divisionOffice}</div>
              )}
              <div style={{ fontWeight: "bold", fontSize: "9.6pt" }}>{config?.schoolName || "—"}</div>
              <div style={{ fontWeight: "bold", fontSize: "11.2pt", marginTop: "4px" }}>
                NUTRITIONAL STATUS {(result.period || "").toUpperCase()} REPORT OF STUDENTS
              </div>
              <div style={{ fontWeight: "bold", fontSize: "11.2pt", marginTop: "2px" }}>S.Y. {result.schoolYear}</div>
            </div>

            <table className="nc-table" style={{ marginTop: "10px" }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: "10%" }}>Grade Level</th>
                  <th rowSpan={2} style={{ width: "4%" }} />
                  <th rowSpan={2}>Enrolment</th>
                  <th colSpan={2}>Pupils Weighed</th>
                  {BMI_COLUMNS.map((col) => (
                    <th key={col.key} colSpan={2}>{col.label}</th>
                  ))}
                  {HFA_COLUMNS.map((col) => (
                    <th key={`hfa-${col.key}`} colSpan={2}>{col.label}</th>
                  ))}
                </tr>
                <tr>
                  <th>No.</th><th>%</th>
                  {BMI_COLUMNS.map((col) => (
                    <Fragment key={col.key}>
                      <th>No.</th>
                      <th>%</th>
                    </Fragment>
                  ))}
                  {HFA_COLUMNS.map((col) => (
                    <Fragment key={`hfa-${col.key}`}>
                      <th>No.</th>
                      <th>%</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.gradeLevels.length === 0 ? (
                  <tr>
                    <td colSpan={5 + BMI_COLUMNS.length * 2 + HFA_COLUMNS.length * 2} style={{ padding: "12px" }}>
                      No learners found for {result.schoolYear}.
                    </td>
                  </tr>
                ) : (
                  result.gradeLevels.map((row) => renderGradeGroup(row, false))
                )}
                {result.grandTotal && renderGradeGroup(result.grandTotal, true)}
              </tbody>
            </table>

            <table style={{ width: "100%", marginTop: "40px", fontSize: "9pt", color: "#000" }}>
              <tbody>
                <tr>
                  {/* DepEd/PH government signature-block convention:
                      label -> blank signing space (rule) -> printed name -> position. */}
                  <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                    <div style={{ fontWeight: "bold", textAlign: "left" }}>Prepared by:</div>
                    <div style={{ borderTop: "1px solid #000", marginTop: "40px", paddingTop: "4px" }}>
                      {clinicTeacherName || "—"}
                    </div>
                    <div>School Clinic Teacher</div>
                  </td>
                  <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                    <div style={{ fontWeight: "bold", textAlign: "left" }}>Submitted by:</div>
                    <div style={{ borderTop: "1px solid #000", marginTop: "40px", paddingTop: "4px" }}>
                      {config?.principalName || "—"}
                    </div>
                    <div>{config?.principalPosition || "School Principal"}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
