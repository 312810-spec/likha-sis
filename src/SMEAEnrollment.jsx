// src/SMEAEnrollment.jsx
// SMEA — Enrollment Report (First SMEA Feature)
//
// This report derives its data entirely from the existing Firestore "learners"
// collection (single source of truth, populated through SF1). It does NOT create
// enrollment events, does not add a term field, and does not modify SF1.
//
// Enrollment is summarized as: School Year -> Current Term -> Grade Level -> Section -> Sex.
// Term is CONTEXTUAL only (learners have no stored term), so learners are never
// filtered by term — the report is an enrollment snapshot for the selected school
// year / current term context.

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { academicCalendar, getCurrentTermForSchoolYear } from "./academicCalendar";
import { BarChart3, Users, AlertTriangle } from "lucide-react";
import PageHeader from "./components/ui/PageHeader";
import Card from "./components/ui/Card";
import Alert from "./components/ui/Alert";
import EmptyState from "./components/ui/EmptyState";

// Selectable school years derived from the academic calendar configuration, sorted descending.
const SCHOOL_YEARS = Object.keys(academicCalendar).sort((a, b) => b.localeCompare(a));

// Normalize a learner's sex into "Male" | "Female" | "" (unrecognized/empty).
function normalizeSex(sex) {
  if (sex === null || sex === undefined) return "";
  const s = String(sex).trim();
  if (/^m/i.test(s)) return "Male";
  if (/^f/i.test(s)) return "Female";
  return "";
}

// Normalize a grade level down to its numeric part (e.g. "Grade 10" -> "10").
// Returns "" when no grade value (or no number) is present.
function normalizeGrade(grade) {
  if (grade === null || grade === undefined) return "";
  const g = String(grade).trim();
  const m = g.match(/\d+/);
  return m ? m[0] : "";
}

function gradeNumber(grade) {
  return parseInt(grade.match(/\d+/)?.[0] || "0", 10);
}

// Analyze the selected school year's learners and build the report structure.
// Also performs data-quality validation so bad records are never silently counted.
function buildReport(allLearners, selectedSY) {
  const inSY = allLearners.filter(
    (l) => String(l.schoolYear || "").trim() === String(selectedSY)
  );

  // ---- Data quality -------------------------------------------------------
  const missingSection = [];
  const missingSex = [];
  const invalidGrade = [];

  const lrnCount = {};
  inSY.forEach((l) => {
    const lrn = String(l.lrn || "").trim();
    if (lrn) lrnCount[lrn] = (lrnCount[lrn] || 0) + 1;
  });
  const duplicateLrns = Object.keys(lrnCount).filter((k) => lrnCount[k] > 1);

  // Only records with a grade level, section, AND a recognizable sex are valid
  // for the main Grade x Section x Sex table. Everything else is reported
  // separately in the Data Quality area.
  const valid = [];
  inSY.forEach((l) => {
    const grade = normalizeGrade(l.gradeLevel);
    const section = String(l.section || "").trim();
    const sex = normalizeSex(l.sex);

    if (!section) missingSection.push(l);
    if (!sex) missingSex.push(l);
    if (!grade) invalidGrade.push(l);

    if (grade && section && sex) {
      valid.push({ ...l, grade, section, sex });
    }
  });

  // ---- Grade x Section x Sex matrix --------------------------------------
  const matrix = {};
  valid.forEach((l) => {
    if (!matrix[l.grade]) matrix[l.grade] = {};
    if (!matrix[l.grade][l.section]) matrix[l.grade][l.section] = { male: 0, female: 0 };
    if (l.sex === "Male") matrix[l.grade][l.section].male += 1;
    else matrix[l.grade][l.section].female += 1;
  });

  // Grade-level subtotals + global totals.
  const gradeOrder = Object.keys(matrix).sort(
    (a, b) => gradeNumber(a) - gradeNumber(b) || a.localeCompare(b)
  );

  let totalMale = 0;
  let totalFemale = 0;

  const gradeRows = gradeOrder.map((g) => {
    const sections = Object.keys(matrix[g]).sort().map((sec) => {
      const c = matrix[g][sec];
      return { section: sec, male: c.male, female: c.female, total: c.male + c.female };
    });
    const male = sections.reduce((s, r) => s + r.male, 0);
    const female = sections.reduce((s, r) => s + r.female, 0);
    totalMale += male;
    totalFemale += female;
    return { grade: g, sections, male, female, total: male + female };
  });

  // Assemble the Data Quality issues list (only reported when present).
  const issues = [];
  if (missingSection.length) {
    issues.push({ text: `${missingSection.length} learner${missingSection.length === 1 ? "" : "s"} have missing section` });
  }
  if (missingSex.length) {
    issues.push({ text: `${missingSex.length} learner${missingSex.length === 1 ? "" : "s"} have missing sex` });
  }
  if (invalidGrade.length) {
    issues.push({ text: `${invalidGrade.length} learner${invalidGrade.length === 1 ? "" : "s"} have an invalid/empty grade level` });
  }
  if (duplicateLrns.length) {
    issues.push({ text: `${duplicateLrns.length} duplicate LRN${duplicateLrns.length === 1 ? "" : "s"} detected` });
  }

  return {
    inSYCount: inSY.length,
    validCount: valid.length,
    gradeRows,
    totalMale,
    totalFemale,
    totalLearners: totalMale + totalFemale,
    issues,
  };
}

function SMEAEnrollment({ goBack }) {
  const [selectedSY, setSelectedSY] = useState("2026-2027");
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch ALL learners from Firestore once on mount.
  useEffect(() => {
    let cancelled = false;
    async function fetchLearners() {
      setLoading(true);
      setError("");
      try {
        const snapshot = await getDocs(collection(db, "learners"));
        const fetched = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        if (!cancelled) setLearners(fetched);
      } catch (err) {
        console.error("Failed to fetch learners for enrollment report:", err);
        if (!cancelled) setError("Unable to load enrollment data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLearners();
    return () => {
      cancelled = true;
    };
  }, []);

  const report = useMemo(() => buildReport(learners, selectedSY), [learners, selectedSY]);

  // Derive the current term using the shared academic calendar helper.
  const currentTerm = getCurrentTermForSchoolYear(selectedSY, new Date());
  const termLabel = currentTerm ? currentTerm.label : "Outside configured academic period";

  const schoolYearLabel = String(selectedSY).replace("-", "–");

  // ---------- Loading state -------------------------------------------------
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-slide-up">
        <PageHeader icon={BarChart3} title="SMEA — Enrollment Report" onBack={goBack} />
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
      <div className="max-w-6xl mx-auto animate-slide-up">
        <PageHeader icon={BarChart3} title="SMEA — Enrollment Report" onBack={goBack} />
        <Alert variant="error">Unable to load enrollment data. Please try again.</Alert>
      </div>
    );
  }

  // ---------- Empty state ---------------------------------------------------
  if (report.inSYCount === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-4 animate-slide-up">
        <PageHeader icon={BarChart3} title="SMEA — Enrollment Report" onBack={goBack} />
        <ReportControls selectedSY={selectedSY} setSelectedSY={setSelectedSY} schoolYearLabel={schoolYearLabel} termLabel={termLabel} />
        <Card>
          <EmptyState icon={Users} title={`No enrollment records found for SY ${schoolYearLabel}.`} />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-slide-up">
      <PageHeader icon={BarChart3} title="SMEA — Enrollment Report" onBack={goBack} />
      <ReportControls selectedSY={selectedSY} setSelectedSY={setSelectedSY} schoolYearLabel={schoolYearLabel} termLabel={termLabel} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Total Learners" value={report.totalLearners} tint="bg-primary/10 text-primary dark:bg-primary/20" />
        <SummaryCard label="Total Male" value={report.totalMale} tint="bg-leaf/10 text-leaf dark:bg-leaf/20" />
        <SummaryCard label="Total Female" value={report.totalFemale} tint="bg-accent/10 text-accent-dark dark:bg-accent/20" />
      </div>

      {/* Report table */}
      {report.gradeRows.length === 0 ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title={`No valid records to tabulate for SY ${schoolYearLabel}.`}
            description="Check the Data Quality area below."
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto -mx-4 px-4 sm:-mx-5 sm:px-5">
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
                  <td className="px-3 py-2.5" colSpan={2}>TOTAL</td>
                  <td className="px-3 py-2.5">{report.totalMale}</td>
                  <td className="px-3 py-2.5">{report.totalFemale}</td>
                  <td className="px-3 py-2.5">{report.totalLearners}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            Enrollment snapshot for SY {schoolYearLabel} ({termLabel}). Term is contextual —
            learner records carry no stored term, so no filtering by term is applied.
          </p>
        </Card>
      )}

      {/* Data Quality area — only rendered when issues exist */}
      {report.issues.length > 0 && (
        <Alert variant="warning" className="animate-fade-in">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle size={16} /> Data Quality
          </h4>
          <ul className="mt-2 space-y-1 text-sm">
            {report.issues.map((issue, i) => (
              <li key={i}>⚠ {issue.text}</li>
            ))}
          </ul>
          <p className="text-xs opacity-80 mt-3">
            Incomplete or invalid records are excluded from the main Grade × Section × Sex
            totals to avoid misleading numbers; their counts are shown here.
          </p>
        </Alert>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tint }) {
  return (
    <Card className="flex items-center gap-3">
      <div className={`w-11 h-11 rounded-md flex items-center justify-center flex-shrink-0 font-bold text-lg ${tint}`}>
        {value}
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">{label}</div>
    </Card>
  );
}

// A single grade block: section rows + a grade subtotal row.
function RowGroup({ row }) {
  return (
    <>
      {row.sections.map((s) => (
        <tr key={s.section} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
          {s === row.sections[0] && (
            <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100 font-medium align-top" rowSpan={row.sections.length}>
              {row.grade}
            </td>
          )}
          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{s.section}</td>
          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{s.male}</td>
          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{s.female}</td>
          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{s.total}</td>
        </tr>
      ))}
      <tr className="bg-gray-50/70 dark:bg-gray-800/40 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <td className="px-3 py-2">Subtotal — {row.grade}</td>
        <td className="px-3 py-2"></td>
        <td className="px-3 py-2">{row.male}</td>
        <td className="px-3 py-2">{row.female}</td>
        <td className="px-3 py-2">{row.total}</td>
      </tr>
    </>
  );
}

// School year selector + term display (shared by all states).
function ReportControls({ selectedSY, setSelectedSY, schoolYearLabel, termLabel }) {
  return (
    <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        Auto-generated enrollment summary from existing learner records.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
          School Year
          <select
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            value={selectedSY}
            onChange={(e) => setSelectedSY(e.target.value)}
          >
            {SCHOOL_YEARS.map((sy) => (
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
    </Card>
  );
}

export default SMEAEnrollment;
