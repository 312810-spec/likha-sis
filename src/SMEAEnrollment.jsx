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
import { getCurrentTermForSchoolYear } from "./academicCalendar";

// Extendable list of selectable school years. Additional years can be added here later.
const SCHOOL_YEARS = ["2026-2027"];

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

function SMEAEnrollment() {
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
    return <p className="smea-enrollment smea-message">Loading enrollment data...</p>;
  }

  // ---------- Error state ---------------------------------------------------
  if (error) {
    return <p className="smea-enrollment smea-message smea-error">Unable to load enrollment data. Please try again.</p>;
  }

  // ---------- Empty state ---------------------------------------------------
  if (report.inSYCount === 0) {
    return (
      <div className="smea-enrollment">
        {renderControls(selectedSY, setSelectedSY, schoolYearLabel, termLabel)}
        <p className="smea-empty">
          No enrollment records found for SY {schoolYearLabel}.
        </p>
      </div>
    );
  }


  return (
    <div className="smea-enrollment">
      {renderControls(selectedSY, setSelectedSY, schoolYearLabel, termLabel)}

      {/* Summary cards */}
      <div className="smea-cards">
        <div className="smea-card" style={{ borderTopColor: "var(--tnhs-blue)" }}>
          <span className="smea-card-label">Total Learners</span>
          <span className="smea-card-value">{report.totalLearners}</span>
        </div>
        <div className="smea-card" style={{ borderTopColor: "var(--tnhs-green)" }}>
          <span className="smea-card-label">Total Male</span>
          <span className="smea-card-value">{report.totalMale}</span>
        </div>
        <div className="smea-card" style={{ borderTopColor: "var(--tnhs-orange)" }}>
          <span className="smea-card-label">Total Female</span>
          <span className="smea-card-value">{report.totalFemale}</span>
        </div>
      </div>

      {/* Report table */}
      {report.gradeRows.length === 0 ? (
        <p className="smea-empty">
          No valid records to tabulate for SY {schoolYearLabel}. Check the Data Quality area below.
        </p>
      ) : (
        <div className="smea-panel">
          <div className="smea-table-wrap">
            <table className="smea-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Male</th>
                  <th>Female</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.gradeRows.map((row) => (
                  <RowGroup key={row.grade} row={row} />
                ))}
                <tr className="smea-grand-total">
                  <td colSpan={2}>TOTAL</td>
                  <td>{report.totalMale}</td>
                  <td>{report.totalFemale}</td>
                  <td>{report.totalLearners}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="smea-note">
            Enrollment snapshot for SY {schoolYearLabel} ({termLabel}). Term is contextual —
            learner records carry no stored term, so no filtering by term is applied.
          </p>
        </div>
      )}

      {/* Data Quality area — only rendered when issues exist */}
      {report.issues.length > 0 && (
        <div className="smea-panel smea-quality">
          <h4 className="smea-quality-title">Data Quality</h4>
          <ul className="smea-quality-list">
            {report.issues.map((issue, i) => (
              <li key={i}>⚠ {issue.text}</li>
            ))}
          </ul>
          <p className="smea-note">
            Incomplete or invalid records are excluded from the main Grade × Section × Sex
            totals to avoid misleading numbers; their counts are shown here.
          </p>
        </div>
      )}
    </div>
  );
}

// A single grade block: section rows + a grade subtotal row.
function RowGroup({ row }) {
  return (
    <>
      {row.sections.map((s) => (
        <tr key={s.section}>
          {s === row.sections[0] && <td rowSpan={row.sections.length}>{row.grade}</td>}
          <td>{s.section}</td>
          <td>{s.male}</td>
          <td>{s.female}</td>
          <td>{s.total}</td>
        </tr>
      ))}
      <tr className="smea-subtotal">
        <td>Subtotal — {row.grade}</td>
        <td></td>
        <td>{row.male}</td>
        <td>{row.female}</td>
        <td>{row.total}</td>
      </tr>
    </>
  );
}

// School year selector + term display (shared by all states).
function renderControls(selectedSY, setSelectedSY, schoolYearLabel, termLabel) {
  return (
    <div className="smea-header">
      <div>
        <h3 className="smea-title">SMEA Enrollment Report</h3>
        <p className="smea-subtitle">
          Auto-generated enrollment summary from existing learner records.
        </p>
      </div>

      <div className="smea-controls">
        <label className="smea-field">
          <span className="smea-field-label">School Year</span>
          <select
            className="smea-select"
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

        <div className="smea-term">
          <span className="smea-field-label">School Year</span>
          <span className="smea-term-value">{schoolYearLabel}</span>
          <span className="smea-field-label">Current Term</span>
          <span className="smea-term-value">{termLabel}</span>
        </div>
      </div>
    </div>
  );
}

export default SMEAEnrollment;

