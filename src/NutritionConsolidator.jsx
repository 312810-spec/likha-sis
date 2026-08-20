// src/NutritionConsolidator.jsx
// School-wide DepEd Nutritional Status (Baseline/Endline) Consolidator —
// aggregates every section's nutritionRecords into the printable summary
// grid used in TingubNHS-BASELINE-NS-CONSO-2026-2027.xlsx.

import { Fragment, useState, useEffect } from "react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { consolidateBySection } from "./utils/nutritionConsolidation.js";
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
    sections: [],
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

      const consolidated = consolidateBySection(learners, nutritionRecords, {
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

  function renderCountCell(count) {
    return (
      <>
        <td>{count.M}</td>
        <td>{count.F}</td>
        <td>{count.T}</td>
      </>
    );
  }

  function renderRow(row, isGrandTotal) {
    return (
      <tr key={`${row.gradeLevel}|${row.section}`} className={isGrandTotal ? "nc-grand-total" : ""}>
        <td className="nc-cell-left">{isGrandTotal ? "GRAND TOTAL" : `${row.gradeLevel} - ${row.section}`}</td>
        {renderCountCell(row.enrolment)}
        {renderCountCell(row.weighed)}
        {BMI_COLUMNS.map((col) => (
          <Fragment key={col.key}>{renderCountCell(row.bmi[col.key])}</Fragment>
        ))}
        {HFA_COLUMNS.map((col) => (
          <Fragment key={`hfa-${col.key}`}>{renderCountCell(row.hfa[col.key])}</Fragment>
        ))}
      </tr>
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
          @page { size: A4 landscape; margin: 8mm; }
        }
        .nc-table { border-collapse: collapse; width: 100%; }
        .nc-table th, .nc-table td {
          border: 1px solid #000;
          padding: 2px 3px;
          font-size: 6.5pt;
          text-align: center;
          line-height: 1.2;
          color: #000;
          background: #fff;
        }
        .nc-table th { background: #e8e8e8; font-weight: bold; }
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
            <div style={{ textAlign: "center", color: "#000" }}>
              <div style={{ fontWeight: "bold", fontSize: "12pt" }}>{config?.schoolName || "—"}</div>
              <div style={{ fontWeight: "bold", fontSize: "13pt", marginTop: "4px" }}>
                NUTRITIONAL STATUS {(result.period || "").toUpperCase()} REPORT OF STUDENTS
              </div>
              <div style={{ fontSize: "9pt", marginTop: "2px" }}>S.Y. {result.schoolYear}</div>
            </div>

            <table className="nc-table" style={{ marginTop: "10px" }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: "12%" }}>Grade &amp; Section</th>
                  <th colSpan={3}>Enrolment</th>
                  <th colSpan={3}>Pupils Weighed</th>
                  {BMI_COLUMNS.map((col) => (
                    <th key={col.key} colSpan={3}>{col.label}</th>
                  ))}
                  {HFA_COLUMNS.map((col) => (
                    <th key={`hfa-${col.key}`} colSpan={3}>{col.label}</th>
                  ))}
                </tr>
                <tr>
                  <th>M</th><th>F</th><th>T</th>
                  <th>M</th><th>F</th><th>T</th>
                  {BMI_COLUMNS.map((col) => (
                    <Fragment key={col.key}>
                      <th>M</th>
                      <th>F</th>
                      <th>T</th>
                    </Fragment>
                  ))}
                  {HFA_COLUMNS.map((col) => (
                    <Fragment key={`hfa-${col.key}`}>
                      <th>M</th>
                      <th>F</th>
                      <th>T</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.sections.length === 0 ? (
                  <tr>
                    <td colSpan={7 + BMI_COLUMNS.length * 3 + HFA_COLUMNS.length * 3} style={{ padding: "12px" }}>
                      No learners found for {result.schoolYear}.
                    </td>
                  </tr>
                ) : (
                  result.sections.map((row) => renderRow(row, false))
                )}
                {result.grandTotal && renderRow(result.grandTotal, true)}
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
