// src/components/SF1PrintView.jsx
// A print-exact HTML/CSS replica of the official DepEd "School Form 1 (SF 1)
// School Register". Printing goes straight through window.print() — nothing is
// exported to Excel.
//
// Fidelity comes from src/importers/sf1/sf1Layout.js: the <colgroup> widths are
// the real 47-column merged widths taken from the official LIS SF1 template
// (SF1_2026_Grade 10 (Year IV) - COMPASSION.xls).
//
// PRINT SAFETY: this sheet is always pure black on pure white (#000 / #fff).
// It never reads a dark-mode or brand-theme colour.

import { Fragment } from "react";
import {
  SF1_47_COL_PERCENTS,
  REMARKS_INDICATORS,
  REMARKS_INDICATORS_RIGHT,
} from "../importers/sf1/sf1Layout.js";

/** Normalize either "M"/"F" or "Male"/"Female" to a single letter. */
function sexLetter(sex) {
  const s = String(sex || "").trim().toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return "";
}

/** Render a learner's name the way SF1 prints it: LAST, FIRST MIDDLE. */
function learnerName(l) {
  if (l.displayName) return l.displayName;
  const first = [l.firstName, l.nameExtension].filter(Boolean).join(" ");
  const tail = [first, l.middleName].filter(Boolean).join(" ");
  return [l.lastName, tail].filter(Boolean).join(", ");
}

/** SF1 prints birth dates as mm/dd/yyyy. Accepts ISO or already-formatted text. */
function formatBirthDate(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  return s;
}

/** One learner row mapped exactly across the 47 columns. */
function LearnerRow({ learner }) {
  const l = learner;
  return (
    <tr className="sf1-row">
      <td colSpan={2} className="sf1-c-lrn">{l.lrn}</td>
      <td colSpan={4} className="sf1-c-name">{learnerName(l)}</td>
      <td colSpan={1}>{sexLetter(l.sex)}</td>
      <td colSpan={2}>{formatBirthDate(l.birthDate)}</td>
      <td colSpan={2}>{l.age}</td>
      <td colSpan={2} className="sf1-c-wrap">{l.motherTongue}</td>
      <td colSpan={1} className="sf1-c-wrap">{l.ipEthnicGroup}</td>
      <td colSpan={1} className="sf1-c-wrap">{l.religion}</td>
      <td colSpan={2} className="sf1-c-wrap">{l.houseStreetSitio}</td>
      <td colSpan={3} className="sf1-c-wrap">{l.barangay}</td>
      <td colSpan={2} className="sf1-c-wrap">{l.municipalityCity}</td>
      <td colSpan={5} className="sf1-c-wrap">{l.province}</td>
      <td colSpan={4} className="sf1-c-wrap sf1-c-left">{l.fathersName}</td>
      <td colSpan={5} className="sf1-c-wrap sf1-c-left">{l.mothersMaidenName}</td>
      <td colSpan={4} className="sf1-c-wrap sf1-c-left">{l.guardianName}</td>
      <td colSpan={1} className="sf1-c-wrap">{l.guardianRelationship}</td>
      <td colSpan={2} className="sf1-c-wrap">{l.contactNumber}</td>
      <td colSpan={1} className="sf1-c-wrap">{l.learningModality}</td>
      <td colSpan={2} className="sf1-c-wrap">{l.remarks}</td>
      <td colSpan={1} className="sf1-spacer" />
    </tr>
  );
}

/** A "<=== TOTAL MALE" style tally row, exactly as LIS prints it. */
function TallyRow({ count, label }) {
  return (
    <tr className="sf1-row sf1-tally">
      <td colSpan={2} className="sf1-c-lrn">{count}</td>
      <td colSpan={4} className="sf1-c-name">{`<=== ${label}`}</td>
      <td colSpan={41} />
    </tr>
  );
}

/**
 * @param {Object}   props
 * @param {Array}    props.learners - learner records (imported or hand-entered)
 * @param {Object}   props.school   - { schoolId, schoolName, region, division,
 *                                      schoolYear, gradeLevel, section }
 * @param {string}   props.preparedBy      - adviser name
 * @param {string}   props.certifiedBy     - school head name
 * @param {string}   props.bosyDate
 * @param {string}   props.eosyDate
 */
export default function SF1PrintView({
  learners = [],
  school = {},
  preparedBy = "",
  certifiedBy = "",
  bosyDate = "",
  eosyDate = "",
}) {
  // Generated-on stamp shown at the very bottom, matching LIS output.
  const generatedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // SF1 lists all males first, then all females, each block alphabetical.
  const byName = (a, b) => learnerName(a).localeCompare(learnerName(b));
  const males = learners.filter((l) => sexLetter(l.sex) === "M").sort(byName);
  const females = learners.filter((l) => sexLetter(l.sex) === "F").sort(byName);
  // Anyone whose sex could not be read still has to appear on the register.
  const unspecified = learners.filter((l) => sexLetter(l.sex) === "");
  const total = males.length + females.length + unspecified.length;

  return (
    <div className="sf1-print-view">
      <style>{PRINT_CSS}</style>

      <div className="sf1-sheet">
        {/* ---------- Title block (Rows 1 & 2 Parity) ---------- */}
        <div className="sf1-title">School Form 1 (SF 1) School Register</div>
        <div className="sf1-subtitle">
          (This replaces Form 1, Master List &amp; STS Form 2-Family Background and Profile)
        </div>

        {/* ---------- Class metadata (Rows 3 & 4 Parity) ---------- */}
        <table className="sf1-meta">
          <tbody>
            <tr>
              <td className="sf1-meta-label">School ID</td>
              <td className="sf1-meta-value">{school.schoolId || ""}</td>
              <td className="sf1-meta-label">Region</td>
              <td className="sf1-meta-value">{school.region || ""}</td>
              <td className="sf1-meta-label">Division</td>
              <td className="sf1-meta-value" colSpan={3}>{school.division || ""}</td>
            </tr>
            <tr>
              <td className="sf1-meta-label">School Name</td>
              <td className="sf1-meta-value">{school.schoolName || ""}</td>
              <td className="sf1-meta-label">School Year</td>
              <td className="sf1-meta-value">{school.schoolYear || ""}</td>
              <td className="sf1-meta-label">Grade Level</td>
              <td className="sf1-meta-value">{school.gradeLevel || ""}</td>
              <td className="sf1-meta-label">Section</td>
              <td className="sf1-meta-value">{school.section || ""}</td>
            </tr>
          </tbody>
        </table>

        {/* ---------- DO 017 SHS sheet-level parameters ---------- */}
        {(school.track || school.cluster) && (
          <div className="sf1-shs">
            <div className="sf1-shs-title">Senior High School Parameters</div>
            <div className="sf1-shs-row">
              {school.track && (
                <span className="sf1-shs-item">
                  <span className="sf1-shs-label">Track:</span> {school.track}
                </span>
              )}
              {school.cluster && (
                <span className="sf1-shs-item">
                  <span className="sf1-shs-label">Elective Cluster:</span> {school.cluster}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ---------- Learner register (47-Column Table) ---------- */}
        <table className="sf1-table">
          <colgroup>
            {SF1_47_COL_PERCENTS.map((pct, idx) => (
              <col key={`col-${idx}`} style={{ width: `${pct}%` }} />
            ))}
          </colgroup>

          {/* Two-row header (Rows 5 & 6 Parity) */}
          <thead>
            <tr>
              <th rowSpan={2} colSpan={2}>LRN</th>
              <th rowSpan={2} colSpan={4}>
                NAME
                <br />
                (Last Name, First Name, Middle Name)
              </th>
              <th rowSpan={2} colSpan={1}>Sex (M/F)</th>
              <th rowSpan={2} colSpan={2}>
                BIRTH DATE
                <br />
                (mm/dd/yyyy)
              </th>
              <th rowSpan={2} colSpan={2}>AGE as of 1st Friday June</th>
              <th rowSpan={2} colSpan={2}>MOTHER TONGUE (Grade 1 to 3 Only)</th>
              <th rowSpan={2} colSpan={1}>
                IP
                <br />
                (Ethnic Group)
              </th>
              <th rowSpan={2} colSpan={1}>RELIGION</th>
              <th colSpan={12}>ADDRESS</th>
              <th colSpan={9}>PARENTS</th>
              <th colSpan={5}>
                GUARDIAN
                <br />
                (if Not Parent)
              </th>
              <th rowSpan={2} colSpan={2}>Contact Number of Parent or Guardian</th>
              <th rowSpan={2} colSpan={1}>Learning Modality</th>
              <th colSpan={2}>REMARKS</th>
              <th rowSpan={2} colSpan={1} className="sf1-spacer" />
            </tr>
            <tr>
              <th colSpan={2}>House #/ Street/ Sitio/ Purok</th>
              <th colSpan={3}>Barangay</th>
              <th colSpan={2}>Municipality/ City</th>
              <th colSpan={5}>Province</th>
              <th colSpan={4}>Father&apos;s Name (Last Name, First Name, Middle Name)</th>
              <th colSpan={5}>Mother&apos;s Maiden Name (Last Name, First Name, Middle Name)</th>
              <th colSpan={4}>Name</th>
              <th colSpan={1}>Relationship</th>
              <th colSpan={2}>(Please refer to the legend on last page)</th>
            </tr>
          </thead>

          <tbody>
            {males.map((l, i) => (
              <LearnerRow key={`m-${l.lrn || i}`} learner={l} />
            ))}
            <TallyRow count={males.length} label="TOTAL MALE" />

            {females.map((l, i) => (
              <LearnerRow key={`f-${l.lrn || i}`} learner={l} />
            ))}
            <TallyRow count={females.length} label="TOTAL FEMALE" />

            {unspecified.length > 0 && (
              <Fragment>
                {unspecified.map((l, i) => (
                  <LearnerRow key={`u-${l.lrn || i}`} learner={l} />
                ))}
                <TallyRow count={unspecified.length} label="SEX NOT INDICATED" />
              </Fragment>
            )}

            <TallyRow count={total} label="COMBINED" />
          </tbody>
        </table>

        {/* ---------- Footer: Legend + Registered Matrix + Signatures (Rows 39 to 50 Parity) ---------- */}
        <div className="sf1-footer">
          <div className="sf1-footer-flex">
            {/* Left Box: List and Code of Indicators under REMARKS column */}
            <div className="sf1-footer-left">
              <div className="sf1-legend-title">
                List and Code of Indicators under REMARKS column
              </div>

              <table className="sf1-legend">
                <thead>
                  <tr>
                    <th style={{ width: "8%" }}>Code</th>
                    <th style={{ width: "42%" }}>Required Information</th>
                    <th style={{ width: "10%" }}>Indicator</th>
                    <th style={{ width: "40%" }}>Required Information</th>
                  </tr>
                </thead>
                <tbody>
                  {REMARKS_INDICATORS.map((left, i) => {
                    const right = REMARKS_INDICATORS_RIGHT[i];
                    return (
                      <tr key={left.code}>
                        <td className="sf1-code">{left.code}</td>
                        <td className="sf1-c-left">{left.info}</td>
                        <td className="sf1-code">{right ? right.code : ""}</td>
                        <td className="sf1-c-left">{right ? right.info : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Right Box: Enrollment Summary Matrix & Signatures */}
            <div className="sf1-footer-right">
              <table className="sf1-registered-table sf1-summary-table">
                <tbody>
                  <tr>
                    <td className="sf1-c-left sf1-strong">REGISTERED</td>
                    <td className="sf1-strong">BoSY</td>
                    <td className="sf1-strong">EoSY</td>
                  </tr>
                  <tr>
                    <td className="sf1-c-left">MALE</td>
                    <td>{males.length}</td>
                    <td />
                  </tr>
                  <tr>
                    <td className="sf1-c-left">FEMALE</td>
                    <td>{females.length}</td>
                    <td />
                  </tr>
                  <tr>
                    <td className="sf1-c-left">TOTAL</td>
                    <td>{total}</td>
                    <td />
                  </tr>
                </tbody>
              </table>

              <table className="sf1-signatures">
                <tbody>
                  <tr>
                    <td className="sf1-sign-label">Prepared by:</td>
                    <td className="sf1-sign-label">Certified Correct:</td>
                  </tr>
                  <tr>
                    <td className="sf1-sign-name">{preparedBy}</td>
                    <td className="sf1-sign-name">{certifiedBy}</td>
                  </tr>
                  <tr>
                    <td className="sf1-sign-caption">
                      (Signature of Adviser over Printed Name)
                    </td>
                    <td className="sf1-sign-caption">
                      (Signature of School Head over Printed Name)
                    </td>
                  </tr>
                  <tr>
                    <td className="sf1-sign-dates">
                      <span>BoSY Date: {bosyDate || "____________"}</span>
                      <span>EoSY Date: {eosyDate || "____________"}</span>
                    </td>
                    <td className="sf1-sign-dates">
                      <span>BoSY Date: {bosyDate || "____________"}</span>
                      <span>EoSY Date: {eosyDate || "____________"}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- bottom footer metadata ---- */}
          <div className="sf1-footer-meta">
            <span>Generated on: {generatedOn}</span>
            <span>Generated thru LIS</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles. Strict pure black on white (#000 / #fff) to prevent theme leakage.
// ---------------------------------------------------------------------------
const PRINT_CSS = `
.sf1-print-view {
  background: #fff;
  color: #000;
  overflow-x: auto;
}
.sf1-sheet {
  width: 100%;
  max-width: 13.5in;
  margin: 0 auto;
  padding: 0;
  background: #fff;
  color: #000;
  font-family: Arial, Helvetica, sans-serif;
  box-sizing: border-box;
}
.sf1-title {
  font-size: 14pt;
  font-weight: bold;
  color: #000;
  text-align: center;
  margin-bottom: 2px;
  line-height: 1.2;
}
.sf1-subtitle {
  font-size: 9pt;
  font-style: italic;
  color: #000;
  text-align: center;
  margin-bottom: 6px;
  line-height: 1.2;
}

/* ---- class metadata (Rows 3 & 4) ---- */
.sf1-meta { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
.sf1-meta td {
  font-size: 7.5pt;
  color: #000;
  background: #fff;
  padding: 1px 2px;
  vertical-align: bottom;
  white-space: nowrap;
}
.sf1-meta-label { font-weight: normal; width: 1%; padding-right: 4px !important; }
.sf1-meta-value {
  border-bottom: 1px solid #000;
  font-weight: bold;
  padding-left: 4px !important;
}

/* ---- DO 017 SHS parameters ---- */
.sf1-shs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  color: #000;
  background: #fff;
  border: 1px solid #000;
  margin-bottom: 4px;
  padding: 2px 6px;
  font-size: 6.5pt;
}
.sf1-shs-title { font-weight: bold; }
.sf1-shs-row { display: flex; flex-wrap: wrap; gap: 14px; }
.sf1-shs-item { white-space: nowrap; }
.sf1-shs-label {
  font-weight: bold;
  border-bottom: 1px solid #000;
  display: inline-block;
}

/* ---- learner register (47-column table) ---- */
.sf1-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  page-break-inside: auto;
  border-bottom: 3px double #000;
}
.sf1-table th,
.sf1-table td {
  border: 1px solid #000;
  color: #000;
  background: #fff;
  font-size: 7pt;
  line-height: 1.15;
  padding: 1px 2px;
  text-align: center;
  vertical-align: middle;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.sf1-table th {
  font-weight: bold;
  font-size: 7.5pt;
  vertical-align: middle;
}
.sf1-row { height: 0.32in; page-break-inside: avoid; }
.sf1-c-lrn { font-size: 7pt; letter-spacing: -0.2px; }
.sf1-c-name { text-align: left !important; font-weight: normal; }
.sf1-c-left { text-align: left !important; }
.sf1-c-wrap { hyphens: auto; }
.sf1-tally td { font-weight: bold; }
.sf1-spacer { padding: 0 !important; width: 2px !important; }

/* ---- footer: legend, summary box, signatures ---- */
.sf1-footer {
  margin-top: 4px;
  page-break-inside: avoid;
  break-inside: avoid;
}
.sf1-footer-flex {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.sf1-footer-left {
  flex: 6;
}
.sf1-footer-right {
  flex: 4;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sf1-legend-title {
  font-size: 7.5pt;
  font-weight: bold;
  color: #000;
  margin-bottom: 2px;
}
.sf1-legend {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.sf1-legend th,
.sf1-legend td {
  border: 1px solid #000;
  color: #000;
  background: #fff;
  font-size: 6pt;
  line-height: 1.15;
  padding: 2px;
  text-align: left;
  vertical-align: top;
  word-wrap: break-word;
}
.sf1-legend th {
  font-weight: bold;
  font-size: 6.5pt;
  text-align: center;
}
.sf1-code {
  font-weight: bold;
  text-align: center !important;
}

.sf1-registered-table {
  width: 100%;
  border-collapse: collapse;
}
.sf1-registered-table th,
.sf1-registered-table td {
  border: 1px solid #000;
  color: #000;
  background: #fff;
  font-size: 7pt;
  padding: 2px 4px;
  text-align: center;
}
.sf1-registered-table th {
  font-weight: bold;
  font-size: 7.5pt;
}

.sf1-signatures {
  width: 100%;
  border-collapse: collapse;
}
.sf1-signatures td {
  width: 50%;
  color: #000;
  background: #fff;
  font-size: 7pt;
  padding: 0 4px;
  text-align: center;
  vertical-align: bottom;
}
.sf1-sign-label { text-align: left !important; font-size: 7pt; font-weight: bold; }
.sf1-sign-name {
  font-weight: bold;
  text-transform: uppercase;
  padding-top: 16px !important;
  border-bottom: 1px solid #000;
  font-size: 7.5pt;
}
.sf1-sign-caption { font-size: 6pt; font-style: italic; padding-top: 1px !important; }
.sf1-sign-dates {
  display: flex;
  justify-content: space-between;
  font-size: 6pt;
  padding-top: 6px !important;
}

/* ---- bottom metadata stamp ---- */
.sf1-footer-meta {
  display: flex;
  justify-content: space-between;
  color: #000;
  background: #fff;
  font-size: 6pt;
  padding-top: 4px;
}

/* ---- print styles ---- */
@media print {
  @page {
    size: legal landscape;
    margin: 6mm;
  }

  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    background: #fff !important;
  }

  .sf1-print-view {
    display: block !important;
    width: 100%;
    margin: 0 auto;
    background: #fff !important;
    color: #000 !important;
    overflow: visible !important;
  }

  .sf1-sheet {
    width: 100% !important;
    max-width: none !important;
    background: #fff !important;
    color: #000 !important;
  }

  .sf1-table {
    border-bottom: 3px double #000 !important;
  }

  .sf1-table thead { display: table-header-group; }
  .sf1-table tfoot { display: table-footer-group; }
  .sf1-table tr { page-break-inside: avoid; break-inside: avoid; page-break-after: auto; }
  .sf1-footer { page-break-inside: avoid; break-inside: avoid; }

  .sf1-print-view * {
    background: #fff !important;
    color: #000 !important;
    border-color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
}
`;

