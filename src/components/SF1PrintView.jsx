// src/components/SF1PrintView.jsx
// A print-exact HTML/CSS replica of the official DepEd "School Form 1 (SF 1)
// School Register". Printing goes straight through window.print() — nothing is
// exported to Excel.
//
// Fidelity comes from src/importers/sf1/sf1Layout.js: the <colgroup> widths are
// the real merged-column widths taken from a LIS export, so every column lines
// up with the official sheet instead of being eyeballed.
//
// This same markup now serves BOTH the on-screen Live Register and the printed
// sheet (CLAUDE.md §4E: one official layout, never two that can drift apart).
// On screen it follows the app's Dark Mode via `html.dark .sf1-print-view …`
// overrides below -- geometry, columns and merged cells never change, only
// colour. See useDarkMode.js for how `html.dark` gets toggled.
//
// PRINT SAFETY (CLAUDE.md §2): regardless of screen theme, @media print forces
// this sheet back to pure black on pure white with `!important`, which always
// wins over the (non-!important) screen dark-mode rules -- see the print-safety-
// audit skill and src/__tests__/sf1PrintView.test.js for the enforced contract.

import { Fragment } from "react";
import {
  SF1_COLUMN_PERCENTS,
  SF1_GRID_PERCENTS,
  SF1_TITLE_ROW_HEIGHTS,
  SF1_FOOTER_ROW_HEIGHTS,
  REMARKS_INDICATORS,
  REMARKS_INDICATORS_RIGHT,
} from "../importers/sf1/sf1Layout.js";

/**
 * The raw 47-column <colgroup> of the LIS sheet. The title band and the footer
 * are merged against these columns rather than against the register's 19, so
 * they each open their own table on this grid and stay in register with it.
 */
function GridCols() {
  return (
    <colgroup>
      {SF1_GRID_PERCENTS.map((p, i) => (
        <col key={i} style={{ width: `${p}%` }} />
      ))}
    </colgroup>
  );
}

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

/**
 * One learner row, in the official column order. Column alignment below is
 * verified against the real workbook's per-cell XF records (font/alignment,
 * values never read -- see the sf1-fidelity investigation notes), not
 * eyeballed: LRN/mother tongue/IP/religion/address/guardian-relationship are
 * left-aligned, birth date is right-aligned, sex/age/learning modality/
 * remarks stay centered (the table's own default).
 */
function LearnerRow({ learner }) {
  const l = learner;
  return (
    <tr className="sf1-row">
      <td className="sf1-c-lrn">{l.lrn}</td>
      <td className="sf1-c-name">{learnerName(l)}</td>
      <td>{sexLetter(l.sex)}</td>
      <td className="sf1-c-right">{formatBirthDate(l.birthDate)}</td>
      <td>{l.age}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.motherTongue}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.ipEthnicGroup}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.religion}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.houseStreetSitio}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.barangay}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.municipalityCity}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.province}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.fathersName}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.mothersMaidenName}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.guardianName}</td>
      <td className="sf1-c-wrap sf1-c-left">{l.guardianRelationship}</td>
      <td className="sf1-c-wrap sf1-c-valign-top">{l.contactNumber}</td>
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
 * @param {string}   props.generatedOn - date printed on the LIS provenance line
 */
export default function SF1PrintView({
  learners = [],
  school = {},
  preparedBy = "",
  certifiedBy = "",
  bosyDate = "",
  eosyDate = "",
  generatedOn = "",
}) {
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
        {/*
          ---------- Title band: LIS rows 1-6 ----------
          Merged exactly as the export has them. Row 3 carries no "Region"
          label — the division office prints the region bare at columns 10-14,
          with only "School ID" and "Division" labelled — so this reproduces
          that rather than inventing a tidier caption.
        */}
        <table className="sf1-head">
          <GridCols />
          <tbody>
            <tr style={{ height: `${SF1_TITLE_ROW_HEIGHTS[0]}pt` }}>
              <td className="sf1-title" colSpan={46}>
                School Form 1 (SF 1) School Register
              </td>
            </tr>
            <tr style={{ height: `${SF1_TITLE_ROW_HEIGHTS[1]}pt` }}>
              <td className="sf1-subtitle" colSpan={46}>
                (This replaces Form 1, Master List &amp; STS Form 2-Family
                Background and Profile)
              </td>
            </tr>
            <tr style={{ height: `${SF1_TITLE_ROW_HEIGHTS[2]}pt` }}>
              <td className="sf1-meta-label" colSpan={5}>School ID</td>
              <td className="sf1-meta-value" colSpan={4}>{school.schoolId || ""}</td>
              <td className="sf1-meta-gap" />
              <td className="sf1-meta-value" colSpan={5}>{school.region || ""}</td>
              <td className="sf1-meta-gap" />
              <td className="sf1-meta-label" colSpan={2}>Division</td>
              <td className="sf1-meta-gap" />
              <td className="sf1-meta-value" colSpan={13}>{school.division || ""}</td>
              <td className="sf1-meta-gap" colSpan={14} />
            </tr>
            <tr style={{ height: `${SF1_TITLE_ROW_HEIGHTS[3]}pt` }}>
              <td className="sf1-meta-label" colSpan={5}>School Name</td>
              <td className="sf1-meta-value" colSpan={10}>{school.schoolName || ""}</td>
              <td className="sf1-meta-gap" />
              <td className="sf1-meta-label" colSpan={3}>School Year</td>
              <td className="sf1-meta-value" colSpan={5}>{school.schoolYear || ""}</td>
              <td className="sf1-meta-gap" />
              <td className="sf1-meta-label" colSpan={4}>Grade Level</td>
              <td className="sf1-meta-gap" />
              <td className="sf1-meta-value" colSpan={3}>{school.gradeLevel || ""}</td>
              <td className="sf1-meta-gap" colSpan={2} />
              <td className="sf1-meta-label" colSpan={3}>Section</td>
              <td className="sf1-meta-value" colSpan={9}>{school.section || ""}</td>
            </tr>
          </tbody>
        </table>

        {/* ---------- Learner register ---------- */}
        <table className="sf1-table">
          <colgroup>
            {SF1_COLUMN_PERCENTS.map((c) => (
              <col key={c.field} style={{ width: `${c.percent}%` }} />
            ))}
          </colgroup>

          {/* Two-row header, merged exactly like the official sheet. */}
          <thead>
            <tr style={{ height: `${SF1_TITLE_ROW_HEIGHTS[4]}pt` }}>
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
              <th>REMARKS</th>
            </tr>
            <tr style={{ height: `${SF1_TITLE_ROW_HEIGHTS[5]}pt` }}>
              <th>House #/ Street/ Sitio/ Purok</th>
              <th>Barangay</th>
              <th>Municipality/ City</th>
              <th>Province</th>
              <th>Father&apos;s Name (Last Name, First Name, Middle Name)</th>
              <th>Mother&apos;s Maiden Name (Last Name, First Name, Middle Name)</th>
              <th>Name</th>
              <th>Relationship</th>
              <th>
                (Please refer to the legend on last page)
              </th>
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

        {/*
          ---------- Footer band: LIS rows 30-41 ----------
          One table on the same 47-column grid as the title band. The export
          lays the legend (c0-18), the REGISTERED tally (c21-27) and the two
          signature columns side by side across a single band of rows, not
          stacked, and it closes with the two provenance lines. The two
          signature columns are NOT symmetric in the source: "Prepared by"
          (adviser) spans c30-36 (7 cols) but "Certified Correct" (school
          head) spans only c39-44 (6 cols) -- verified against the real
          workbook's merges, not assumed. The legend's indicator/code/
          information cells are single merged cells holding four lines each,
          so no horizontal rules run between the four indicators.
        */}
        <table className="sf1-foot">
          <GridCols />
          <tbody>
            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[0]}pt` }}>
              <td className="sf1-legend-title" colSpan={19}>
                List and Code of Indicators under REMARKS column
              </td>
              <td className="sf1-meta-gap" colSpan={26} />
            </tr>

            <tr className="sf1-foot-head" style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[1]}pt` }}>
              <th>Indicator</th>
              <th colSpan={2}>Code</th>
              <th colSpan={5}>Required Information</th>
              <th colSpan={4}>Indicator</th>
              <th>Code</th>
              <th colSpan={6}>Required Information</th>
              <td className="sf1-meta-gap" colSpan={2} />
              <th colSpan={2}>REGISTERED</th>
              <th colSpan={3}>BoSY</th>
              <th colSpan={2}>EoSY</th>
              <td className="sf1-meta-gap" colSpan={2} />
              <th className="sf1-sign-label" colSpan={7}>Prepared by;</th>
              <td className="sf1-meta-gap" colSpan={2} />
              <th className="sf1-sign-label" colSpan={6}>Certified Correct:</th>
            </tr>

            {/*
              ---------- Tally/signature block: LIS rows 36-42 (0-based 35-41) ----------
              A genuinely 7-row-tall block, not the 4 rows this used to render
              as. Each of the three column groups subdivides those 7 rows
              differently -- verified against the real workbook's merges, not
              assumed: the legend and the col28-29/col37-38 divider gaps span
              all 7 rows; MALE/FEMALE/TOTAL split 3+2+2; "Prepared by"'s name
              cell spans 3 rows with a 1-row caption below it; "Certified
              Correct"'s name is only 1 row with a 2-row caption below it (the
              two signature stacks are offset by one row from each other,
              which is why each needs its own blank filler row).
            */}
            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[2]}pt` }}>
              <td className="sf1-legend-cell" rowSpan={7}>
                {REMARKS_INDICATORS.map((x) => (
                  <div key={x.code}>{x.indicator}</div>
                ))}
              </td>
              <td className="sf1-legend-cell sf1-c-center" colSpan={2} rowSpan={7}>
                {REMARKS_INDICATORS.map((x) => (
                  <div key={x.code}>{x.code}</div>
                ))}
              </td>
              <td className="sf1-legend-cell" colSpan={5} rowSpan={7}>
                {REMARKS_INDICATORS.map((x) => (
                  <div key={x.code}>{x.info}</div>
                ))}
              </td>
              <td className="sf1-legend-cell" colSpan={4} rowSpan={7}>
                {REMARKS_INDICATORS_RIGHT.map((x) => (
                  <div key={x.code}>{x.indicator}</div>
                ))}
              </td>
              <td className="sf1-legend-cell sf1-c-center" rowSpan={7}>
                {REMARKS_INDICATORS_RIGHT.map((x) => (
                  <div key={x.code}>{x.code}</div>
                ))}
              </td>
              <td className="sf1-legend-cell" colSpan={6} rowSpan={7}>
                {REMARKS_INDICATORS_RIGHT.map((x) => (
                  <div key={x.code}>{x.info}</div>
                ))}
              </td>
              <td className="sf1-meta-gap" colSpan={2} rowSpan={7} />

              <td className="sf1-reg-label" colSpan={2} rowSpan={3}>MALE</td>
              <td className="sf1-reg-value" colSpan={3} rowSpan={3}>{males.length}</td>
              <td className="sf1-reg-value" colSpan={2} rowSpan={3} />
              <td className="sf1-meta-gap" colSpan={2} rowSpan={7} />
              <td className="sf1-sign-name" colSpan={7} rowSpan={3}>{preparedBy}</td>
              <td className="sf1-meta-gap" colSpan={2} rowSpan={7} />
              <td className="sf1-sign-name" colSpan={6}>{certifiedBy}</td>
            </tr>

            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[3]}pt` }}>
              <td className="sf1-meta-gap" colSpan={6} />
            </tr>

            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[4]}pt` }}>
              <td className="sf1-sign-caption" colSpan={6} rowSpan={2}>
                (Signature of School Head over Printed Name)
              </td>
            </tr>

            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[5]}pt` }}>
              <td className="sf1-reg-label" colSpan={2} rowSpan={2}>FEMALE</td>
              <td className="sf1-reg-value" colSpan={3} rowSpan={2}>{females.length}</td>
              <td className="sf1-reg-value" colSpan={2} rowSpan={2} />
              <td className="sf1-sign-caption" colSpan={7}>
                (Signature of Adviser over Printed Name)
              </td>
            </tr>

            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[6]}pt` }}>
              <td className="sf1-meta-gap" colSpan={7} />
              <td className="sf1-sign-dates" colSpan={3} rowSpan={2}>BoSY Date: {bosyDate}</td>
              <td className="sf1-sign-dates" colSpan={3} rowSpan={2}>EoSY Date: {eosyDate}</td>
            </tr>

            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[7]}pt` }}>
              <td className="sf1-reg-label" colSpan={2} rowSpan={2}>TOTAL</td>
              <td className="sf1-reg-value" colSpan={3} rowSpan={2}>{total}</td>
              <td className="sf1-reg-value" colSpan={2} rowSpan={2} />
              <td className="sf1-sign-dates" colSpan={4} rowSpan={2}>BoSY Date: {bosyDate}</td>
              <td className="sf1-sign-dates" colSpan={3} rowSpan={2}>EoSY Date: {eosyDate}</td>
            </tr>

            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[8]}pt` }}>
              <td className="sf1-meta-gap" colSpan={6} />
            </tr>

            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[9]}pt` }}>
              <td className="sf1-meta-gap" colSpan={45} />
            </tr>

            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[10]}pt` }}>
              <td className="sf1-meta-gap" colSpan={39} />
              <td className="sf1-generated sf1-generated-bold" colSpan={6}>Generated thru LIS</td>
            </tr>

            <tr style={{ height: `${SF1_FOOTER_ROW_HEIGHTS[11]}pt` }}>
              <td className="sf1-generated sf1-generated-lg sf1-c-left" colSpan={37}>
                {generatedOn ? `Generated on: ${generatedOn}` : ""}
              </td>
              <td className="sf1-meta-gap" colSpan={8} />
            </tr>
          </tbody>
        </table>
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
  /* A4 landscape (11.69in) minus the real workbook's own left/right
     margins (0.19in each) -- measured via openpyxl, not Legal-paper's
     14in as this used to assume. Keep in sync with
     SF1_SHEET_NATURAL_WIDTH_PX in utils/sf1FitScale.js. */
  width: 11.3in;
  margin: 0 auto;
  padding: 0;
  background: #fff;
  color: #000;
  font-family: Arial, Helvetica, sans-serif;
  box-sizing: border-box;
}
.sf1-head {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-bottom: 2px;
}
.sf1-head td {
  color: #000;
  background: #fff;
  font-size: 8pt;
  padding: 0 2px;
  vertical-align: bottom;
  white-space: nowrap;
  overflow: hidden;
}
.sf1-title {
  font-size: 21pt;
  font-weight: bold;
  text-align: center;
  vertical-align: top !important;
}
.sf1-subtitle {
  font-size: 7pt;
  font-style: italic;
  text-align: center;
  vertical-align: top !important;
}
.sf1-meta-label { font-weight: normal; text-align: right; }
.sf1-meta-value {
  border: 1px solid #000;
  font-weight: normal;
  text-align: center;
}
.sf1-meta-gap { border: 0; }

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
  font-size: 7pt;
  line-height: 1.1;
  padding: 1px;
  text-align: center;
  vertical-align: middle;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.sf1-table th {
  font-weight: bold;
  font-size: 6pt;
  vertical-align: middle;
}
.sf1-row { height: 47pt; page-break-inside: avoid; }
.sf1-c-lrn { text-align: left; letter-spacing: -0.2px; }
.sf1-c-name { text-align: left !important; font-weight: normal; }
.sf1-c-left { text-align: left !important; }
.sf1-c-right { text-align: right !important; }
.sf1-c-valign-top { vertical-align: top !important; }
.sf1-c-wrap { hyphens: auto; }
.sf1-tally { height: 20pt; }
.sf1-tally .sf1-c-lrn { text-align: right; }

/* ---- footer band: legend, REGISTERED tally, signatures, provenance ---- */
.sf1-foot {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-top: 4px;
  page-break-inside: avoid;
}
.sf1-foot td,
.sf1-foot th {
  color: #000;
  background: #fff;
  font-size: 6pt;
  line-height: 1.15;
  padding: 1px 2px;
  text-align: center;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.sf1-foot th { border: 1px solid #000; font-weight: bold; }
.sf1-legend-title {
  font-size: 8pt !important;
  font-weight: bold;
  text-align: left !important;
  border: 0;
  padding-bottom: 2px !important;
}
.sf1-legend-cell {
  border: 1px solid #000;
  font-weight: bold;
  text-align: left !important;
}
.sf1-c-center { text-align: center !important; }
.sf1-reg-label {
  border: 1px solid #000;
  font-size: 6pt !important;
  font-weight: bold;
  text-align: center !important;
  vertical-align: middle !important;
}
.sf1-reg-value {
  border: 1px solid #000;
  font-size: 6pt !important;
  font-weight: bold;
  vertical-align: middle !important;
}
.sf1-sign-label {
  border: 0 !important;
  font-size: 6pt !important;
  text-align: left !important;
}
.sf1-sign-name {
  font-size: 6pt !important;
  font-weight: normal;
  text-transform: uppercase;
  vertical-align: bottom !important;
  padding-top: 14px !important;
  border-bottom: 1px solid #000;
}
.sf1-sign-caption { font-size: 6pt !important; font-weight: bold; }
.sf1-sign-dates {
  font-size: 6pt !important;
  font-weight: bold;
  text-align: left !important;
  vertical-align: bottom !important;
}
.sf1-generated { font-size: 6pt !important; text-align: center; }
.sf1-generated-bold { font-weight: bold; }
/* "Generated on:" is measured at 8pt in the real workbook -- distinct from
   "Generated thru LIS", which is 6pt. They used to share one size. */
.sf1-generated-lg { font-size: 8pt !important; }

/* ---- screen Dark Mode (the print rules further below always win) ----
   Geometry, columns, merged cells and row heights are untouched here; only
   colours change, so the on-screen register still lines up exactly with the
   printed one. */
html.dark .sf1-print-view {
  background: #111827;
}
html.dark .sf1-sheet,
html.dark .sf1-head td,
html.dark .sf1-table th,
html.dark .sf1-table td,
html.dark .sf1-foot td,
html.dark .sf1-foot th {
  background: #111827;
  color: #e5e7eb;
}
html.dark .sf1-table th,
html.dark .sf1-foot th {
  background: #1f2937;
}
html.dark .sf1-table th,
html.dark .sf1-table td,
html.dark .sf1-foot th,
html.dark .sf1-foot td,
html.dark .sf1-legend-cell,
html.dark .sf1-reg-label,
html.dark .sf1-reg-value {
  border-color: #4b5563;
}
html.dark .sf1-meta-value,
html.dark .sf1-sign-name {
  border-bottom-color: #6b7280;
}
html.dark .sf1-tally td {
  background: #1f2937;
}

/* ---- print ---- */
@media print {
  @page {
    /* Measured via openpyxl against the real workbook's page setup --
       A4 landscape (paperSize 9), not Legal, with asymmetric margins
       (top 0.29in, the other three sides 0.19in). */
    size: A4 landscape;
    margin: 0.29in 0.19in 0.19in 0.19in;
  }

  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    background: #fff !important;
  }

  .sf1-print-view {
    display: block !important;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background: #fff !important;
    color: #000 !important;
    overflow: visible !important;
  }

  /* The sheet fills the printable area of an A4-landscape page. */
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
