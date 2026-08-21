// src/components/sf2/SF2MonthlyView.jsx
// The official Monthly SF2 sheet, structured from a real DepEd LIS export
// (see src/utils/sf2Layout.js) -- one shared component for BOTH the on-screen
// Monthly SF2 preview and the printed sheet, so they can never drift apart
// (CLAUDE.md §4E, matching the SF1PrintView precedent).
//
// This is where a teacher may CORRECT any date in the month (§15) -- date
// cells are always clickable here (no per-day lock like Daily Attendance;
// opening this tab is already a deliberate "I'm here to review/correct"
// action). The Monthly Summary sits AFTER the attendance table, matching the
// official sheet's own row order.
//
// PRINT SAFETY (CLAUDE.md §2): screen colours follow Dark Mode via
// `html.dark .sf2-*` rules; @media print forces pure black-on-white with
// `!important`, which always wins regardless of theme.

import { Fragment } from "react";
import {
  computeSf2ColumnPercents,
  NLS_REASON_GROUPS,
  DROPOUT_REASONS,
  ATTENDANCE_CODES_TEXT,
  SF2_FORMULAS,
  SF2_GUIDELINES_TEXT,
} from "../../utils/sf2Layout.js";
import { monthlyLearnerCounts, monthlyGroupTotals, groupCountOnDate } from "../../utils/sf2Summary.js";

function learnerName(l) {
  return [l.lastName || "", l.firstName || ""].filter(Boolean).join(", ");
}

function markGlyph(value) {
  if (value === "A") return "X";
  if (value === "T") return "T";
  return "";
}

/** One date cell: a real <button> so it works when editable, but its plain
 * text content ("" / "X" / "T") is identical whether printed or clicked. */
function DateCell({ value, editable, onClick, dateLabel }) {
  const cls =
    value === "A" ? "sf2-mark-absent" : value === "T" ? "sf2-mark-tardy" : "sf2-mark-present";
  return (
    <td className={`sf2-date-cell ${cls}`}>
      <button
        type="button"
        className="sf2-mark-btn"
        onClick={editable ? onClick : undefined}
        disabled={!editable}
        title={editable ? `${dateLabel} — click to change` : dateLabel}
        aria-label={`${dateLabel}: ${value === "A" ? "Absent" : value === "T" ? "Tardy" : "Present"}`}
      >
        {markGlyph(value)}
      </button>
    </td>
  );
}

function LearnerRow({ learner, no, weekdays, records, remark, editable, onCellClick, onRemarksClick }) {
  const counts = monthlyLearnerCounts(records, learner.id, weekdays);
  return (
    <tr className="sf2-row">
      <td className="sf2-c-no">{no}</td>
      <td className="sf2-c-name">{learnerName(learner)}</td>
      {weekdays.map((w) => (
        <DateCell
          key={w.dateString}
          value={records[learner.id]?.[w.dateString] || ""}
          editable={editable}
          onClick={() => onCellClick(learner.id, w.dateString)}
          dateLabel={`${w.label} ${w.day}`}
        />
      ))}
      <td className="sf2-c-total">{counts.absent}</td>
      <td className="sf2-c-total">{counts.present}</td>
      <td className="sf2-c-remarks">
        {editable ? (
          <button type="button" className="sf2-remarks-btn" onClick={() => onRemarksClick(learner)}>
            {remark || "Remarks"}
          </button>
        ) : (
          remark || ""
        )}
      </td>
    </tr>
  );
}

function TotalRow({ label, count, weekdays, records, learnerIds, className }) {
  const totals = monthlyGroupTotals(learnerIds, records, weekdays);
  return (
    <tr className={`sf2-row sf2-total-row ${className || ""}`}>
      <td className="sf2-c-no">{count}</td>
      <td className="sf2-c-name">{label}</td>
      {weekdays.map((w) => (
        <td key={w.dateString} className="sf2-c-total">
          {groupCountOnDate(learnerIds, records, w.dateString, "A")}
        </td>
      ))}
      <td className="sf2-c-total">{totals.absent}</td>
      <td className="sf2-c-total">{totals.present}</td>
      <td className="sf2-c-remarks" />
    </tr>
  );
}

export default function SF2MonthlyView({
  school = {},
  maleLearners = [],
  femaleLearners = [],
  weekdays = [],
  records = {},
  remarksData = {},
  editable = false,
  onCellClick = () => {},
  onRemarksClick = () => {},
  summary = {},
  summaryInputs = {},
  onSummaryInputChange = () => {},
  preparedBy = "",
  certifiedBy = "",
}) {
  const percents = computeSf2ColumnPercents(weekdays.length);
  const registeredLearners = maleLearners.length + femaleLearners.length;
  const maleIds = maleLearners.map((l) => l.id);
  const femaleIds = femaleLearners.map((l) => l.id);
  const allIds = [...maleIds, ...femaleIds];

  return (
    <div className="sf2-print-view">
      <style>{PRINT_CSS}</style>
      <div className="sf2-sheet">
        {/* ---------- Title + metadata ---------- */}
        <div className="sf2-title">School Form 2 (SF2) Daily Attendance Report of Learners</div>
        <div className="sf2-subtitle">
          (This replaces Form 1, Form 2 &amp; STS Form 4 - Absenteeism and Dropout Profile)
        </div>
        <div className="sf2-meta-row">
          <span className="sf2-meta-label">School ID</span>
          <span className="sf2-meta-value">{school.schoolId || ""}</span>
          <span className="sf2-meta-label">School Year</span>
          <span className="sf2-meta-value">{school.schoolYear || ""}</span>
          <span className="sf2-meta-label">Report for the Month of</span>
          <span className="sf2-meta-value">{school.monthLabel || ""}</span>
        </div>
        <div className="sf2-meta-row">
          <span className="sf2-meta-label">Name of School</span>
          <span className="sf2-meta-value sf2-meta-wide">{school.schoolName || ""}</span>
          <span className="sf2-meta-label">Grade Level</span>
          <span className="sf2-meta-value">{school.gradeLevel || ""}</span>
          <span className="sf2-meta-label">Section</span>
          <span className="sf2-meta-value">{school.section || ""}</span>
        </div>

        {/* ---------- Attendance table ---------- */}
        <table className="sf2-table">
          <colgroup>
            <col style={{ width: `${percents.no}%` }} />
            <col style={{ width: `${percents.name}%` }} />
            {weekdays.map((w) => (
              <col key={w.dateString} style={{ width: `${percents.datePerColumn}%` }} />
            ))}
            <col style={{ width: `${percents.absent}%` }} />
            <col style={{ width: `${percents.present}%` }} />
            <col style={{ width: `${percents.remarks}%` }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>No.</th>
              <th rowSpan={2}>NAME<br />(Last Name, First Name)</th>
              {weekdays.map((w) => (
                <th key={w.dateString} className="sf2-date-head">{w.day}</th>
              ))}
              <th colSpan={2}>Total for the Month</th>
              <th rowSpan={2}>REMARKS</th>
            </tr>
            <tr>
              {weekdays.map((w) => (
                <th key={w.dateString} className="sf2-date-head">{w.label}</th>
              ))}
              <th>ABSENT</th>
              <th>PRESENT</th>
            </tr>
          </thead>
          <tbody>
            {maleLearners.map((l, i) => (
              <LearnerRow
                key={l.id}
                learner={l}
                no={i + 1}
                weekdays={weekdays}
                records={records}
                remark={remarksData[l.id]}
                editable={editable}
                onCellClick={onCellClick}
                onRemarksClick={onRemarksClick}
              />
            ))}
            {maleLearners.length > 0 && (
              <TotalRow
                label="<== MALE | TOTAL Per Day ==>"
                count={maleLearners.length}
                weekdays={weekdays}
                records={records}
                learnerIds={maleIds}
              />
            )}
            {femaleLearners.map((l, i) => (
              <LearnerRow
                key={l.id}
                learner={l}
                no={maleLearners.length + i + 1}
                weekdays={weekdays}
                records={records}
                remark={remarksData[l.id]}
                editable={editable}
                onCellClick={onCellClick}
                onRemarksClick={onRemarksClick}
              />
            ))}
            {femaleLearners.length > 0 && (
              <TotalRow
                label="<== FEMALE | TOTAL Per Day ==>"
                count={femaleLearners.length}
                weekdays={weekdays}
                records={records}
                learnerIds={femaleIds}
              />
            )}
            <TotalRow
              label="Combined TOTAL Per Day"
              count={registeredLearners}
              weekdays={weekdays}
              records={records}
              learnerIds={allIds}
              className="sf2-combined-row"
            />
          </tbody>
        </table>

        {/* ---------- Monthly Summary (after the table, per the official row order) ---------- */}
        <div className="sf2-footer">
          <div className="sf2-footer-col">
            <div className="sf2-box-title">GUIDELINES</div>
            {SF2_GUIDELINES_TEXT.map((line, i) => (
              <p key={i} className="sf2-guideline-line">{line}</p>
            ))}
            <div className="sf2-box-title sf2-box-title-spaced">1. CODES FOR CHECKING ATTENDANCE</div>
            <p>{ATTENDANCE_CODES_TEXT}</p>
          </div>

          <div className="sf2-footer-col">
            <div className="sf2-box-title">2. REASONS/CAUSES FOR NLS</div>
            {NLS_REASON_GROUPS.map((group) => (
              <Fragment key={group.letter}>
                <p className="sf2-nls-group-title">{group.letter}. {group.title}</p>
                {group.items.map((code) => {
                  const reason = DROPOUT_REASONS.find((r) => r.code === code);
                  return (
                    <p key={code} className="sf2-nls-item">{code}. {reason?.label}</p>
                  );
                })}
              </Fragment>
            ))}
          </div>

          <div className="sf2-footer-col">
            <div className="sf2-summary-mini">
              <span>Month: <strong>{school.monthLabel || ""}</strong></span>
              <span>No. of Days of Classes: <strong>{summary.numberSchoolDays ?? 0}</strong></span>
            </div>
            <table className="sf2-mini-table">
              <thead>
                <tr><th>M</th><th>F</th><th>Total</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>{maleLearners.length}</td>
                  <td>{femaleLearners.length}</td>
                  <td>{registeredLearners}</td>
                </tr>
              </tbody>
            </table>

            <div className="sf2-box-title sf2-box-title-spaced">Enrollment</div>
            <SummaryLine label="Enrolment as of 1st Friday of School Year" editable={editable}>
              <input
                type="number"
                min="0"
                className="sf2-manual-input"
                value={summaryInputs.enrolmentFirstFriday}
                readOnly={!editable}
                onChange={(e) => onSummaryInputChange("enrolmentFirstFriday", e.target.value)}
              />
            </SummaryLine>

            <div className="sf2-box-title sf2-box-title-spaced">Learner Movement</div>
            <SummaryLine label="Late Enrollment during month" editable={editable}>
              <input
                type="number"
                min="0"
                className="sf2-manual-input"
                value={summaryInputs.lateEnrollment}
                readOnly={!editable}
                onChange={(e) => onSummaryInputChange("lateEnrollment", e.target.value)}
              />
            </SummaryLine>
            <SummaryLine label="Transferred In during month" editable={editable}>
              <input
                type="number"
                min="0"
                className="sf2-manual-input"
                value={summaryInputs.transferredIn}
                readOnly={!editable}
                onChange={(e) => onSummaryInputChange("transferredIn", e.target.value)}
              />
            </SummaryLine>
            <SummaryLine label="Transferred Out during month" editable={editable}>
              <input
                type="number"
                min="0"
                className="sf2-manual-input"
                value={summaryInputs.transferredOut}
                readOnly={!editable}
                onChange={(e) => onSummaryInputChange("transferredOut", e.target.value)}
              />
            </SummaryLine>

            <div className="sf2-box-title sf2-box-title-spaced">Attendance</div>
            <SummaryLine label="Registered Learners as of end of month" value={registeredLearners} />
            <SummaryLine label="Total Daily Attendance" value={summary.totalDailyAttendance ?? 0} />
            <SummaryLine label="Average Daily Attendance" value={(summary.averageDailyAttendance ?? 0).toFixed(2)} />
            <SummaryLine
              label="Percentage of Enrolment"
              value={summary.pctEnrolment == null ? "—" : `${summary.pctEnrolment.toFixed(1)}%`}
            />
            <SummaryLine
              label="Percentage of Attendance for the month"
              value={summary.pctAttendance == null ? "—" : `${summary.pctAttendance.toFixed(1)}%`}
            />
            <SummaryLine label="Absent (Total for the Month)" value={summary.monthlyAbsentTotal ?? 0} />
            <SummaryLine label="Present (Total for the Month)" value={summary.monthlyPresentTotal ?? 0} />

            <div className="sf2-box-title sf2-box-title-spaced">Formulas</div>
            {SF2_FORMULAS.map((f) => (
              <p key={f.label} className="sf2-formula-line">
                {f.label} = {f.numerator} / {f.denominator} {f.suffix}
              </p>
            ))}

            <div className="sf2-cert">I certify that this is a true and correct report.</div>
            <div className="sf2-sig">
              <div className="sf2-sig-box">
                <div className="sf2-sig-line">{preparedBy}</div>
                <div className="sf2-sig-label">(Signature of Adviser over Printed Name)</div>
              </div>
              <div className="sf2-sig-box">
                <div className="sf2-sig-label sf2-sig-head-label">Attested by:</div>
                <div className="sf2-sig-line">{certifiedBy}</div>
                <div className="sf2-sig-label">(Signature of School Head over Printed Name)</div>
              </div>
            </div>
            <div className="sf2-generated">Generated thru LIKHA-SIS</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryLine({ label, value, editable, children }) {
  return (
    <div className="sf2-summary-line">
      <span className="sf2-summary-label">{label}</span>
      {children ? children : <span className="sf2-summary-value">{value}</span>}
      {editable !== undefined && !children && null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles. Screen colours (including Dark Mode, via html.dark) live here;
// @media print forces every colour back to pure black-on-white regardless.
// ---------------------------------------------------------------------------
const PRINT_CSS = `
.sf2-print-view {
  background: #fff;
  color: #000;
  overflow-x: auto;
}
.sf2-sheet {
  width: 13.44in;
  margin: 0 auto;
  padding: 0.15in;
  background: #fff;
  color: #000;
  font-family: Arial, Helvetica, sans-serif;
  box-sizing: border-box;
}
.sf2-title { font-weight: bold; font-size: 11pt; text-align: center; }
.sf2-subtitle { font-size: 6.5pt; font-style: italic; text-align: center; margin-bottom: 4px; }
.sf2-meta-row { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 7.5pt; margin-bottom: 2px; }
.sf2-meta-label { font-weight: normal; }
.sf2-meta-value { font-weight: bold; border-bottom: 1px solid #000; padding: 0 6px; }
.sf2-meta-wide { min-width: 2.2in; }

.sf2-table { border-collapse: collapse; width: 100%; table-layout: fixed; margin-top: 6px; }
.sf2-table th, .sf2-table td {
  border: 1px solid #000;
  padding: 1px 2px;
  font-size: 6.5pt;
  line-height: 1.15;
  text-align: center;
  color: #000;
  background: #fff;
  word-wrap: break-word;
}
.sf2-table th { font-weight: bold; background: #e8e8e8; }
.sf2-c-name, .sf2-c-remarks { text-align: left !important; }
.sf2-c-no { width: 2em; }
.sf2-date-head { font-size: 6pt; }
.sf2-row { height: 0.24in; }

.sf2-mark-btn {
  width: 100%;
  height: 100%;
  min-height: 18px;
  border: none;
  background: transparent;
  font: inherit;
  font-weight: bold;
  color: inherit;
  cursor: default;
  padding: 0;
}
.sf2-date-cell button:not(:disabled) { cursor: pointer; }
.sf2-mark-absent { background: #fde8e8; }
.sf2-mark-tardy { background: #b9b9b9; }
.sf2-remarks-btn {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0;
}
.sf2-total-row { font-weight: bold; background: #e8e8e8; }
.sf2-combined-row { background: #cfcfcf; }

.sf2-footer { display: flex; gap: 10px; margin-top: 8px; font-size: 6.5pt; line-height: 1.4; }
.sf2-footer-col { flex: 1 1 0; min-width: 0; }
.sf2-box-title { font-weight: bold; font-size: 7pt; margin-bottom: 2px; }
.sf2-box-title-spaced { margin-top: 8px; }
.sf2-guideline-line { margin: 0 0 2px 0; }
.sf2-nls-group-title { font-weight: bold; margin: 4px 0 0 0; }
.sf2-nls-item { margin: 0 0 0 8px; }

.sf2-summary-mini { display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; }
.sf2-mini-table { border-collapse: collapse; width: 100%; margin-bottom: 4px; }
.sf2-mini-table th, .sf2-mini-table td { border: 1px solid #000; text-align: center; padding: 1px 3px; color: #000; background: #fff; }

.sf2-summary-line { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 2px; }
.sf2-summary-label { flex: 1; }
.sf2-summary-value { font-weight: bold; }
.sf2-manual-input {
  width: 3.2em;
  text-align: right;
  border: 1px solid #000;
  font: inherit;
  color: #000;
  background: #fff;
  padding: 0 2px;
}
.sf2-formula-line { margin: 0 0 2px 0; }

.sf2-cert { font-weight: bold; font-size: 8pt; text-align: center; margin-top: 10px; margin-bottom: 6px; }
.sf2-sig { display: flex; gap: 20px; }
.sf2-sig-box { flex: 1; text-align: center; }
.sf2-sig-line { border-bottom: 1px solid #000; min-height: 20px; padding-top: 8px; font-weight: bold; font-size: 8pt; text-transform: uppercase; }
.sf2-sig-label { font-size: 6pt; margin-top: 2px; }
.sf2-sig-head-label { margin-bottom: 14px; }
.sf2-generated { font-size: 6pt; text-align: right; margin-top: 4px; }

/* ---- screen Dark Mode (the print rules further below always win) ---- */
html.dark .sf2-print-view { background: #111827; }
html.dark .sf2-sheet { background: #111827; color: #e5e7eb; }
html.dark .sf2-table th, html.dark .sf2-table td { background: #111827; color: #e5e7eb; border-color: #4b5563; }
html.dark .sf2-table th { background: #1f2937; }
html.dark .sf2-mark-absent { background: #4c1d1d; }
html.dark .sf2-mark-tardy { background: #374151; }
html.dark .sf2-total-row { background: #1f2937; }
html.dark .sf2-combined-row { background: #26313f; }
html.dark .sf2-meta-value { border-bottom-color: #6b7280; }
html.dark .sf2-manual-input { background: #111827; color: #e5e7eb; border-color: #6b7280; }
html.dark .sf2-mini-table th, html.dark .sf2-mini-table td { background: #111827; color: #e5e7eb; border-color: #4b5563; }
html.dark .sf2-sig-line { border-bottom-color: #6b7280; }

/* ---- print ---- */
@media print {
  @page { size: legal landscape; margin: 0.28in; }
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #fff !important; }
  .sf2-print-view { display: block !important; width: 100%; background: #fff !important; color: #000 !important; overflow: visible !important; }
  .sf2-sheet { width: 100% !important; background: #fff !important; color: #000 !important; }
  .sf2-table thead { display: table-header-group; }
  .sf2-table tr { page-break-inside: avoid; }
  .sf2-print-view * {
    background: #fff !important;
    color: #000 !important;
    border-color: #000 !important;
    box-shadow: none !important;
  }
  .sf2-mark-tardy, .sf2-mark-tardy * { background: #b9b9b9 !important; }
  .sf2-total-row, .sf2-total-row * { background: #e8e8e8 !important; }
  .sf2-combined-row, .sf2-combined-row * { background: #cfcfcf !important; }
  .sf2-table th, .sf2-table th * { background: #e8e8e8 !important; }
}
`;
