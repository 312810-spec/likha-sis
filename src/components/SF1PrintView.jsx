// src/components/SF1PrintView.jsx
// A print-exact HTML/CSS replica of the official DepEd "School Form 1 (SF 1)
// School Register". Printing goes straight through window.print() — nothing is
// exported to Excel.
//
// Fidelity comes from src/importers/sf1/sf1Layout.js: the <colgroup> widths are
// the real merged-column widths taken from a LIS export, so every column lines
// up with the official sheet instead of being eyeballed.
//
// PRINT SAFETY (CLAUDE.md §2): this sheet is always pure black on pure white.
// It never reads a dark-mode or brand-theme colour, so screen theming can never
// leak into a printed learner record.

import { Fragment } from "react";
import {
  SF1_COLUMN_PERCENTS,
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

/** One learner row, in the official column order. */
function LearnerRow({ learner }) {
  const l = learner;
  return (
    <tr className="sf1-row">
      <td className="sf1-c-lrn">{l.lrn}</td>
      <td className="sf1-c-name">{learnerName(l)}</td>
      <td>{sexLetter(l.sex)}</td>
      <td>{formatBirthDate(l.birthDate)}</td>
      <td>{l.age}</td>
      <td className="sf1-c-wrap">{l.motherTongue}</td>
      <td className="sf1-c-wrap">{l.ipEthnicGroup}</td>
      <td className="sf1-c-wrap">{l.religion}</td>
      <td className="sf1-c-wrap">{l.houseStreetSitio}</td>
      <td className="sf1-c-wrap">{l.barangay}</td>
      <td className="sf1-c-wrap">{l.municipalityCity}</td>
      <td className="sf1-c-wrap">{l.province}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.fathersName}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.mothersMaidenName}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.guardianName}</td>
      <td className="sf1-c-wrap">{l.guardianRelationship}</td>
      <td className="sf1-c-wrap">{l.contactNumber}</td>
      <td className="sf1-c-wrap">{l.learningModality}</td>
      <td className="sf1-c-wrap">{l.remarks}</td>
    </tr>
  );
}

/** A "<=== TOTAL MALE" style tally row, exactly as LIS prints it. */
function TallyRow({ count, label }) {
  return (
    <tr className="sf1-row sf1-tally">
      <td className="sf1-c-lrn">{count}</td>
      <td className="sf1-c-name">{`<=== ${label}`}</td>
      <td colSpan={17} />
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
        {/* ---------- Title block ---------- */}
        <div className="sf1-title">School Form 1 (SF 1) School Register</div>
        <div className="sf1-subtitle">
          (This replaces Form 1, Master List &amp; STS Form 2-Family Background and Profile)
        </div>

        {/* ---------- Class metadata ---------- */}
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

        {/* ---------- Learner register ---------- */}
        <table className="sf1-table">
          <colgroup>
            {SF1_COLUMN_PERCENTS.map((c) => (
              <col key={c.field} style={{ width: `${c.percent}%` }} />
            ))}
          </colgroup>

          {/* Two-row header, merged exactly like the official sheet. */}
          <thead>
            <tr>
              <th rowSpan={2}>LRN</th>
              <th rowSpan={2}>
                NAME
                <br />
                (Last Name, First Name, Middle Name)
              </th>
              <th rowSpan={2}>Sex (M/F)</th>
              <th rowSpan={2}>
                BIRTH DATE
                <br />
                (mm/dd/yyyy)
              </th>
              <th rowSpan={2}>AGE as of 1st Friday June</th>
              <th rowSpan={2}>MOTHER TONGUE (Grade 1 to 3 Only)</th>
              <th rowSpan={2}>
                IP
                <br />
                (Ethnic Group)
              </th>
              <th rowSpan={2}>RELIGION</th>
              <th colSpan={4}>ADDRESS</th>
              <th colSpan={2}>PARENTS</th>
              <th colSpan={2}>
                GUARDIAN
                <br />
                (if Not Parent)
              </th>
              <th rowSpan={2}>Contact Number of Parent or Guardian</th>
              <th rowSpan={2}>Learning Modality</th>
              <th rowSpan={2}>
                REMARKS
                <br />
                (Please refer to the legend on last page)
              </th>
            </tr>
            <tr>
              <th>House #/ Street/ Sitio/ Purok</th>
              <th>Barangay</th>
              <th>Municipality/ City</th>
              <th>Province</th>
              <th>Father&apos;s Name (Last Name, First Name, Middle Name)</th>
              <th>Mother&apos;s Maiden Name (Last Name, First Name, Middle Name)</th>
              <th>Name</th>
              <th>Relationship</th>
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

        {/* ---------- Legend + tally + signatures ---------- */}
        <div className="sf1-footer">
          <div className="sf1-legend-title">
            List and Code of Indicators under REMARKS column
          </div>

          <table className="sf1-legend">
            <thead>
              <tr>
                <th style={{ width: "11%" }}>Indicator</th>
                <th style={{ width: "5%" }}>Code</th>
                <th style={{ width: "24%" }}>Required Information</th>
                <th style={{ width: "11%" }}>Indicator</th>
                <th style={{ width: "5%" }}>Code</th>
                <th style={{ width: "24%" }}>Required Information</th>
                <th className="sf1-legend-tally" colSpan={2}>&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {REMARKS_INDICATORS.map((left, i) => {
                const right = REMARKS_INDICATORS_RIGHT[i];
                return (
                  <tr key={left.code}>
                    <td className="sf1-c-left">{left.indicator}</td>
                    <td>{left.code}</td>
                    <td className="sf1-c-left">{left.info}</td>
                    <td className="sf1-c-left">{right ? right.indicator : ""}</td>
                    <td>{right ? right.code : ""}</td>
                    <td className="sf1-c-left">{right ? right.info : ""}</td>
                    {i === 0 && (
                      <td className="sf1-registered" colSpan={2} rowSpan={4}>
                        <table className="sf1-registered-table">
                          <tbody>
                            <tr>
                              <td className="sf1-c-left">REGISTERED</td>
                              <td>BoSY</td>
                              <td>EoSY</td>
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
                      </td>
                    )}
                  </tr>
                );
              })}
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
                  <span>BoSY Date: {bosyDate}</span>
                  <span>EoSY Date: {eosyDate}</span>
                </td>
                <td className="sf1-sign-dates">
                  <span>BoSY Date: {bosyDate}</span>
                  <span>EoSY Date: {eosyDate}</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ---- bottom footer metadata, exactly as LIS stamps it ---- */}
          <div className="sf1-footer-meta">
            <span>Generated thru LIS</span>
            <span>Generated on: {generatedOn}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles. Every colour is stated literally (#000 / #fff) rather than inherited,
// so no dark-mode or brand theme can bleed into the printed form.
// ---------------------------------------------------------------------------
const PRINT_CSS = `
.sf1-print-view {
  background: #fff;
  color: #000;
  overflow-x: auto;
}
.sf1-sheet {
  width: 13.5in;
  margin: 0 auto;
  padding: 0;
  background: #fff;
  color: #000;
  font-family: Arial, Helvetica, sans-serif;
  box-sizing: border-box;
}
.sf1-title {
  font-size: 11pt;
  font-weight: bold;
  color: #000;
  text-align: center;
  margin-bottom: 1px;
}
.sf1-subtitle {
  font-size: 6.5pt;
  font-style: italic;
  color: #000;
  text-align: center;
  margin-bottom: 5px;
}

/* ---- class metadata ---- */
.sf1-meta { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
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
.sf1-meta-inline-label { padding: 0 4px 0 18px; font-weight: normal; }
.sf1-meta-inline-value { font-weight: bold; }

/* ---- DO 017 SHS sheet-level parameters ---- */
.sf1-shs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  color: #000;
  background: #fff;
  border: 1px solid #000;
  margin-bottom: 3px;
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

/* ---- learner register ---- */
.sf1-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  page-break-inside: auto;
}
.sf1-table th,
.sf1-table td {
  border: 1px solid #000;
  color: #000;
  background: #fff;
  font-size: 5.5pt;
  line-height: 1.1;
  padding: 1px;
  text-align: center;
  vertical-align: middle;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.sf1-table th {
  font-weight: bold;
  font-size: 5pt;
  vertical-align: middle;
}
.sf1-row { height: 0.34in; page-break-inside: avoid; }
.sf1-c-lrn { font-size: 5.5pt; letter-spacing: -0.2px; }
.sf1-c-name { text-align: left !important; font-weight: normal; }
.sf1-c-left { text-align: left !important; }
.sf1-c-wrap { hyphens: auto; }
.sf1-tally td { font-weight: bold; }

/* ---- footer: legend, tally box, signatures ---- */
.sf1-footer { margin-top: 4px; page-break-inside: avoid; }
.sf1-legend-title { font-size: 6pt; font-weight: bold; color: #000; margin-bottom: 1px; }
.sf1-legend { width: 100%; border-collapse: collapse; table-layout: fixed; }
.sf1-legend th,
.sf1-legend td {
  border: 1px solid #000;
  color: #000;
  background: #fff;
  font-size: 5pt;
  line-height: 1.15;
  padding: 1px 2px;
  text-align: center;
  vertical-align: top;
  word-wrap: break-word;
}
.sf1-legend th { font-weight: bold; }
.sf1-registered { padding: 0 !important; vertical-align: top; }
.sf1-registered-table { width: 100%; border-collapse: collapse; }
.sf1-registered-table td {
  border: 1px solid #000;
  color: #000;
  background: #fff;
  font-size: 5.5pt;
  padding: 1px 3px;
  text-align: center;
}

.sf1-signatures { width: 100%; border-collapse: collapse; margin-top: 6px; }
.sf1-signatures td {
  width: 50%;
  color: #000;
  background: #fff;
  font-size: 7pt;
  padding: 0 8px;
  text-align: center;
  vertical-align: bottom;
}
.sf1-sign-label { text-align: left !important; font-size: 6.5pt; }
.sf1-sign-name {
  font-weight: bold;
  text-transform: uppercase;
  padding-top: 14px !important;
  border-bottom: 1px solid #000;
}
.sf1-sign-caption { font-size: 5.5pt; font-style: italic; padding-top: 1px !important; }
.sf1-sign-dates {
  display: flex;
  justify-content: space-between;
  font-size: 6pt;
  padding-top: 8px !important;
}

/* ---- bottom stamp ---- */
.sf1-footer-meta {
  display: flex;
  justify-content: space-between;
  color: #000;
  background: #fff;
  font-size: 6pt;
  padding-top: 3px;
}

/* ---- print ---- */
@media print {
  @page {
    size: legal landscape;
    margin: 8mm;
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

  /* The sheet fills the printable area of a legal-landscape page. */
  .sf1-sheet {
    width: 100% !important;
    background: #fff !important;
    color: #000 !important;
  }

  /* Repeat the two-row header on every page of a long register. */
  .sf1-table thead { display: table-header-group; }
  .sf1-table tfoot { display: table-footer-group; }
  .sf1-table tr { page-break-inside: avoid; page-break-after: auto; }

  /* Nothing in the sheet may inherit a screen theme colour. */
  .sf1-print-view * {
    background: #fff !important;
    color: #000 !important;
    border-color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
}
`;
