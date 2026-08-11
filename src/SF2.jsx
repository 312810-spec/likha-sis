// src/SF2.jsx
// School Form 2 — Daily Attendance (MVP).
// A month grid split into Male / Female sections, matching the structure of the
// real DepEd SF2 template: blank = Present, X (✕) = Absent, T = Tardy.
// The roster is loaded automatically from existing SF1 learner data, and only a
// class + month need to be selected before marking attendance.

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import schoolConfig from "./schoolConfig";

// Common table cell style, consistent with SF1.jsx / ViewLearners.jsx.
const cellStyle = { border: "1px solid #ccc", padding: "6px", textAlign: "left" };
// Center-aligned variant used for the compact weekday date columns.
const centerCellStyle = { ...cellStyle, textAlign: "center" };

// Dropout reason codes (a1–f) per the DepEd NLS legend. Used both for the
// "Legend & Guidelines" section and the per-learner Remarks dropdown options.
const DROPOUT_REASONS = [
  { code: "a1", label: "Had to take care of siblings" },
  { code: "a2", label: "Early marriage/pregnancy" },
  { code: "a3", label: "Parents' attitude toward schooling" },
  { code: "a4", label: "Family problems" },
  { code: "b1", label: "Illness" },
  { code: "b2", label: "Overage" },
  { code: "b3", label: "Death" },
  { code: "b4", label: "Drug Abuse" },
  { code: "b5", label: "Poor academic performance" },
  { code: "b6", label: "Lack of interest/Distractions" },
  { code: "b7", label: "Hunger/Malnutrition" },
  { code: "c1", label: "Teacher Factor" },
  { code: "c2", label: "Physical condition of classroom" },
  { code: "c3", label: "Peer influence" },
  { code: "d1", label: "Distance between home and school" },
  { code: "d2", label: "Armed conflict" },
  { code: "d3", label: "Calamities/Disasters" },
  { code: "e1", label: "Child labor, work" },
  { code: "f", label: "Others (Specify)" },
];

// The value/label used when a learner "Dropped Out" for a given reason code.
function dropoutLabel(code) {
  const r = DROPOUT_REASONS.find((x) => x.code === code);
  return `Dropped Out - ${code}: ${r ? r.label : ""}`;
}

// ---- Helpers ---------------------------------------------------------------

// Returns an array of the weekday (Mon–Fri) dates inside the given "YYYY-MM"
// month. Each entry carries the date number, a short day label, and the full
// "YYYY-MM-DD" string we use as the key inside the attendance records map.
// Sunday (0) and Saturday (6) are skipped.
function getWeekdays(monthValue) {
  if (!monthValue) return [];
  const year = Number(monthValue.slice(0, 4));
  const month = Number(monthValue.slice(5, 7));
  const daysInMonth = new Date(year, month, 0).getDate();
  const labels = ["M", "T", "W", "TH", "F"]; // index by getDay()-1 (Mon=1..Fri=5)
  const result = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // weekend
    result.push({
      day,
      label: labels[dow - 1],
      dateString: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  return result;
}

// Builds the Firestore document id for an attendance sheet, e.g. classValue
// "Grade 10 - Kindness" + monthValue "2026-08" → "Grade_10_Kindness_2026-08".
// Spaces in grade level / section are replaced with underscores.
function makeDocumentId(classValue, monthValue) {
  if (!classValue) return "";
  const [gradeLevel = "", section = ""] = classValue.split(" - ");
  return `${gradeLevel.replace(/ /g, "_")}_${section.replace(/ /g, "_")}_${monthValue}`;
}

// Sort comparator: lastName first, then firstName (both case-insensitive).
function byName(a, b) {
  const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
  if (last !== 0) return last;
  return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
}

// Style for a single learner×date cell button, depending on its current value.
function cellButtonStyle(value) {
  const base = {
    width: "30px",
    height: "26px",
    padding: "0",
    cursor: "pointer",
    fontSize: "13px",
    lineHeight: "1",
    borderRadius: "3px",
  };
  if (value === "A") {
    // Absent — red, matching the Delete button colors.
    return { ...base, background: "#ffebee", color: "#c62828", border: "1px solid #ef9a9a" };
  }
  if (value === "T") {
    // Tardy — amber/yellow.
    return { ...base, background: "#fff8e1", color: "#f57f17", border: "1px solid #ffe082" };
  }
  // Blank / Present.
  return { ...base, background: "#fff", color: "#333", border: "1px solid #ccc" };
}

// ---- Component -------------------------------------------------------------

function SF2({ user, goBack }) {
  // learners: full roster fetched from Firestore, each with its document id.
  const [learners, setLearners] = useState([]);
  // loading: true while the roster is being fetched on mount.
  const [loading, setLoading] = useState(true);
  // filterValue: the selected "Grade Level - Section" dropdown value (e.g. "Grade 10 - Kindness").
  const [filterValue, setFilterValue] = useState("");
  // monthValue: the raw "YYYY-MM" string from the month input, defaulting to the current month.
  const [monthValue, setMonthValue] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  // records: learnerId -> { "YYYY-MM-DD": "A" | "T" }. Only exceptions stored;
  // a date with no entry for a learner means Present (blank).
  const [records, setRecords] = useState({});
  // remarksData: learnerId -> a remark string (blank, "Dropped Out - <code>: ...",
  // "Transferred In", or "Transferred Out").
  const [remarksData, setRemarksData] = useState({});
  // summaryInputs: the four MANUAL class-summary number inputs, saved under `summary`.
  const [summaryInputs, setSummaryInputs] = useState({
    enrolmentFirstFriday: 0,
    lateEnrollment: 0,
    transferredIn: 0,
    transferredOut: 0,
  });
  // adviserName: the class adviser's name, defaulting to the logged-in email.
  const [adviserName, setAdviserName] = useState(user?.email || "");
  // showLegend: controls the collapsible "Legend & Guidelines" section (collapsed by default).
  const [showLegend, setShowLegend] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // On mount, fetch ALL documents from the "learners" collection (same as ViewLearners).
  useEffect(() => {
    async function fetchLearners() {
      try {
        const learnersRef = collection(db, "learners");
        const snapshot = await getDocs(learnersRef);
        const fetchedLearners = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setLearners(fetchedLearners);
      } catch (err) {
        console.error("Failed to fetch learners:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLearners();
  }, []);

  // Unique "Grade Level - Section" combinations for the class dropdown (deduped).
  const gradeSectionOptions = Array.from(
    new Set(
      learners
        .filter((l) => l.gradeLevel && l.section)
        .map((l) => `${l.gradeLevel} - ${l.section}`)
    )
  ).sort();

  // Split the selected "Grade - Section" string back into its parts.
  const [selectedGradeLevel = "", selectedSection = ""] = filterValue
    ? filterValue.split(" - ")
    : ["", ""];

  // Learners matching the selected class, split by sex and sorted by name.
  const filteredLearners = filterValue
    ? learners.filter((l) => `${l.gradeLevel} - ${l.section}` === filterValue)
    : [];
  const maleLearners = filteredLearners.filter((l) => l.sex === "M").sort(byName);
  const femaleLearners = filteredLearners.filter((l) => l.sex === "F").sort(byName);

  // All weekday dates within the selected month.
  const weekdays = getWeekdays(monthValue);

  // Load the existing attendance sheet for this class+month whenever either changes.
  useEffect(() => {
    async function loadAttendance() {
      if (!filterValue || !monthValue) {
        setRecords({});
        setRemarksData({});
        setSummaryInputs({
          enrolmentFirstFriday: 0,
          lateEnrollment: 0,
          transferredIn: 0,
          transferredOut: 0,
        });
        setAdviserName(user?.email || "");
        return;
      }
      const docId = makeDocumentId(filterValue, monthValue);
      try {
        const snap = await getDoc(doc(db, "attendance", docId));
        if (snap.exists()) {
          const data = snap.data();
          setRecords(data.records || {});
          setRemarksData(data.remarks || {});
          setSummaryInputs({
            enrolmentFirstFriday: data.summary?.enrolmentFirstFriday ?? 0,
            lateEnrollment: data.summary?.lateEnrollment ?? 0,
            transferredIn: data.summary?.transferredIn ?? 0,
            transferredOut: data.summary?.transferredOut ?? 0,
          });
          setAdviserName(data.adviserName || user?.email || "");
        } else {
          setRecords({});
          setRemarksData({});
          setSummaryInputs({
            enrolmentFirstFriday: 0,
            lateEnrollment: 0,
            transferredIn: 0,
            transferredOut: 0,
          });
          setAdviserName(user?.email || "");
        }
      } catch (err) {
        console.error("Failed to load attendance:", err);
        setRecords({});
        setRemarksData({});
      }
    }
    loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValue, monthValue]);

  // Cycles a learner+date cell: "" (Present) -> "A" -> "T" -> "".
  function cycleCell(learnerId, dateString) {
    setRecords((prev) => {
      const current = prev[learnerId]?.[dateString] || "";
      const nextValue = current === "" ? "A" : current === "A" ? "T" : "";

      const learnerRec = { ...(prev[learnerId] || {}) };
      if (nextValue === "") {
        delete learnerRec[dateString];
      } else {
        learnerRec[dateString] = nextValue;
      }

      const next = { ...prev };
      if (Object.keys(learnerRec).length === 0) {
        delete next[learnerId];
      } else {
        next[learnerId] = learnerRec;
      }
      return next;
    });
  }

  // Updates the remark (dropout/transfer reason) for one learner.
  function handleRemarkChange(learnerId, value) {
    setRemarksData((prev) => {
      const next = { ...prev };
      if (value === "") {
        delete next[learnerId];
      } else {
        next[learnerId] = value;
      }
      return next;
    });
  }

  // Updates one of the four MANUAL class-summary number inputs.
  function updateSummary(key, value) {
    setSummaryInputs((prev) => ({ ...prev, [key]: value }));
  }

  // Count of "A" values for one learner across the month (summary column).
  function learnerAbsentCount(learnerId) {
    const map = records[learnerId] || {};
    return Object.values(map).filter((v) => v === "A").length;
  }
  // Count of "T" values for one learner across the month (summary column).
  function learnerTardyCount(learnerId) {
    const map = records[learnerId] || {};
    return Object.values(map).filter((v) => v === "T").length;
  }

  // Count of "A" values among a group of learners on a given date (subtotal row).
  function groupAbsentOnDate(group, dateString) {
    return group.reduce(
      (sum, l) => sum + (records[l.id]?.[dateString] === "A" ? 1 : 0),
      0
    );
  }
  // Group totals for the Absent / Tardy summary columns of a subtotal row.
  function groupAbsentTotal(group) {
    return group.reduce((sum, l) => sum + learnerAbsentCount(l.id), 0);
  }
  function groupTardyTotal(group) {
    return group.reduce((sum, l) => sum + learnerTardyCount(l.id), 0);
  }

  async function handleSave() {
    if (!filterValue || !monthValue) {
      setStatusMessage("Select a class and month before saving.");
      return;
    }
    setIsSaving(true);
    setStatusMessage("");

    try {
      // Only store "A" and "T" (exceptions); drop blank/Present entries.
      const cleaned = {};
      Object.entries(records).forEach(([learnerId, dateMap]) => {
        const kept = Object.entries(dateMap).reduce((acc, [date, value]) => {
          if (value === "A" || value === "T") acc[date] = value;
          return acc;
        }, {});
        if (Object.keys(kept).length > 0) cleaned[learnerId] = kept;
      });

      const docId = makeDocumentId(filterValue, monthValue);
      await setDoc(doc(db, "attendance", docId), {
        gradeLevel: selectedGradeLevel,
        section: selectedSection,
        month: monthValue,
        records: cleaned,
        remarks: remarksData,
        summary: {
          enrolmentFirstFriday: Number(summaryInputs.enrolmentFirstFriday) || 0,
          lateEnrollment: Number(summaryInputs.lateEnrollment) || 0,
          transferredIn: Number(summaryInputs.transferredIn) || 0,
          transferredOut: Number(summaryInputs.transferredOut) || 0,
        },
        adviserName: adviserName || user?.email || "",
        updatedAt: serverTimestamp(),
      });
      setStatusMessage("Attendance saved successfully!");
    } catch (error) {
      console.error("Error saving attendance:", error);
      setStatusMessage("Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // Header for each weekday date column: day label on one line, number below.
  const weekdayHeaderStyle = {
    ...cellStyle,
    textAlign: "center",
    padding: "4px 6px",
    lineHeight: "1.2",
  };

  // One learner row (reused for both the male and female groups).
  function renderLearnerRow(learner, no) {
    return (
      <tr key={learner.id}>
        <td style={centerCellStyle}>{no}</td>
        <td style={cellStyle}>
          {learner.lastName || ""}, {learner.firstName || ""}
        </td>
        {weekdays.map((w) => {
          const value = records[learner.id]?.[w.dateString] || "";
          return (
            <td key={w.dateString} style={{ ...centerCellStyle, padding: "2px" }}>
              <button
                style={cellButtonStyle(value)}
                onClick={() => cycleCell(learner.id, w.dateString)}
                title={`${w.label} ${w.day}`}
              >
                {value === "A" ? "✕" : value === "T" ? "T" : ""}
              </button>
            </td>
          );
        })}
        <td style={centerCellStyle}>{learnerAbsentCount(learner.id)}</td>
        <td style={centerCellStyle}>{learnerTardyCount(learner.id)}</td>
        <td style={centerCellStyle}>
          <select
            value={remarksData[learner.id] || ""}
            onChange={(e) => handleRemarkChange(learner.id, e.target.value)}
            style={{ padding: "2px", fontSize: "11px", maxWidth: "150px" }}
          >
            <option value="">—</option>
            {DROPOUT_REASONS.map((r) => {
              const label = dropoutLabel(r.code);
              return (
                <option key={r.code} value={label}>
                  {label}
                </option>
              );
            })}
            <option value="Transferred In">Transferred In</option>
            <option value="Transferred Out">Transferred Out</option>
          </select>
        </td>
      </tr>
    );
  }

  // Subtotal row shown after each group (and a combined one at the end).
  function renderSubtotalRow(label, group, isCombined) {
    return (
      <tr key={label} style={isCombined ? { background: "#fff8e1" } : { background: "#fafafa" }}>
        <td colSpan={2} style={{ ...cellStyle, fontWeight: "bold" }}>
          {label}
        </td>
        {weekdays.map((w) => {
          const maleCount = groupAbsentOnDate(maleLearners, w.dateString);
          const femaleCount = groupAbsentOnDate(femaleLearners, w.dateString);
          const count = isCombined
            ? maleCount + femaleCount
            : groupAbsentOnDate(group, w.dateString);
          return (
            <td key={w.dateString} style={{ ...centerCellStyle, fontWeight: "bold" }}>
              {count}
            </td>
          );
        })}
        <td style={{ ...centerCellStyle, fontWeight: "bold" }}>
          {isCombined
            ? groupAbsentTotal(maleLearners) + groupAbsentTotal(femaleLearners)
            : groupAbsentTotal(group)}
        </td>
        <td style={{ ...centerCellStyle, fontWeight: "bold" }}>
          {isCombined
            ? groupTardyTotal(maleLearners) + groupTardyTotal(femaleLearners)
            : groupTardyTotal(group)}
        </td>
        <td style={centerCellStyle} />
      </tr>
    );
  }

  // Bold labeled group separator row (MALE / FEMALE) spanning No. + Name columns.
  function renderGroupHeader(label) {
    return (
      <tr key={label}>
        <td
          colSpan={2}
          style={{
            border: "1px solid #ccc",
            padding: "6px",
            fontWeight: "bold",
            background: "#eceff1",
            letterSpacing: "1px",
          }}
        >
          {label}
        </td>
        <td colSpan={weekdays.length + 3} style={{ border: "1px solid #ccc", padding: "6px" }} />
      </tr>
    );
  }

  const hasSelection = Boolean(filterValue && monthValue);

  const registeredLearners = maleLearners.length + femaleLearners.length;
  // Auto-computed values for the Class Summary, recalculated live from current state.
  const numberSchoolDays = weekdays.length;
  const totalDailyAttendance = weekdays.reduce((sum, w) => {
    const absentOnDate = [...maleLearners, ...femaleLearners].reduce(
      (a, l) => a + (records[l.id]?.[w.dateString] === "A" ? 1 : 0),
      0
    );
    return sum + (registeredLearners - absentOnDate);
  }, 0);
  const averageDailyAttendance =
    numberSchoolDays > 0 ? totalDailyAttendance / numberSchoolDays : 0;
  const enrolmentFirstFriday = Number(summaryInputs.enrolmentFirstFriday) || 0;
  const pctEnrolment =
    enrolmentFirstFriday > 0 ? (registeredLearners / enrolmentFirstFriday) * 100 : null;
  const pctAttendance =
    registeredLearners > 0 ? (averageDailyAttendance / registeredLearners) * 100 : null;

  // Renders the collapsible "Legend & Guidelines" section (collapsed by default).
  function renderLegend() {
    return (
      <div style={{ marginBottom: "16px", border: "1px solid #ddd", borderRadius: "6px" }}>
        <button
          type="button"
          onClick={() => setShowLegend((v) => !v)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "8px 12px",
            background: "#eceff1",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "13px",
          }}
        >
          {showLegend ? "▼" : "▶"} Legend &amp; Guidelines
        </button>
        {showLegend && (
          <div style={{ padding: "12px 16px", fontSize: "13px", lineHeight: "1.6" }}>
            <p style={{ margin: "0 0 10px" }}>
              <strong>Attendance Codes:</strong> (blank) = Present; X = Absent; T = Tardy
            </p>
            <p style={{ margin: "0 0 6px", fontWeight: "bold" }}>
              Reasons/Causes for Non-Literate/Struggling learners (NLS):
            </p>
            <p style={{ margin: "2px 0" }}>
              a. <strong>Domestic-Related Factors:</strong> a1. Had to take care of siblings, a2. Early
              marriage/pregnancy, a3. Parents&apos; attitude toward schooling, a4. Family problems
            </p>
            <p style={{ margin: "2px 0" }}>
              b. <strong>Individual-Related Factors:</strong> b1. Illness, b2. Overage, b3. Death, b4.
              Drug Abuse, b5. Poor academic performance, b6. Lack of interest/Distractions, b7.
              Hunger/Malnutrition
            </p>
            <p style={{ margin: "2px 0" }}>
              c. <strong>School-Related Factors:</strong> c1. Teacher Factor, c2. Physical condition of
              classroom, c3. Peer influence
            </p>
            <p style={{ margin: "2px 0" }}>
              d. <strong>Geographic/Environmental:</strong> d1. Distance between home and school, d2.
              Armed conflict, d3. Calamities/Disasters
            </p>
            <p style={{ margin: "2px 0" }}>
              e. <strong>Financial-Related:</strong> e1. Child labor, work
            </p>
            <p style={{ margin: "2px 0" }}>f. <strong>Others (Specify)</strong></p>
          </div>
        )}
      </div>
    );
  }

  // Renders the Class Summary: four MANUAL inputs plus auto-computed read-only values.
  function renderSummary() {
    const numberStyle = { width: "90px", padding: "4px", textAlign: "right" };
    const labelStyle = { fontSize: "12px", fontWeight: "bold" };
    const compCellStyle = {
      border: "1px solid #ddd",
      padding: "4px 8px",
      textAlign: "left",
      fontSize: "13px",
    };
    const compValueStyle = { ...compCellStyle, fontWeight: "bold", textAlign: "right" };

    const manualFields = [
      { key: "enrolmentFirstFriday", label: "Enrolment as of 1st Friday of School Year" },
      { key: "lateEnrollment", label: "Late Enrollment during month" },
      { key: "transferredIn", label: "Transferred In during month" },
      { key: "transferredOut", label: "Transferred Out during month" },
    ];

    return (
      <div style={{ marginBottom: "20px", borderTop: "1px solid #ddd", paddingTop: "12px" }}>
        <p style={{ margin: "0 0 8px", fontWeight: "bold", fontSize: "13px" }}>Class Summary</p>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
          {manualFields.map((f) => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}</label>
              <br />
              <input
                type="number"
                min="0"
                value={summaryInputs[f.key]}
                onChange={(e) => updateSummary(f.key, e.target.value)}
                style={numberStyle}
              />
            </div>
          ))}
        </div>
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={compCellStyle}>Registered Learners as of end of month</td>
              <td style={compValueStyle}>{registeredLearners}</td>
            </tr>
            <tr>
              <td style={compCellStyle}>Number of School Days</td>
              <td style={compValueStyle}>{numberSchoolDays}</td>
            </tr>
            <tr>
              <td style={compCellStyle}>Total Daily Attendance</td>
              <td style={compValueStyle}>{totalDailyAttendance}</td>
            </tr>
            <tr>
              <td style={compCellStyle}>Average Daily Attendance</td>
              <td style={compValueStyle}>{averageDailyAttendance.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={compCellStyle}>Percentage of Enrolment</td>
              <td style={compValueStyle}>
                {pctEnrolment === null ? "N/A" : `${pctEnrolment.toFixed(1)}%`}
              </td>
            </tr>
            <tr>
              <td style={compCellStyle}>Percentage of Attendance for the month</td>
              <td style={compValueStyle}>
                {pctAttendance === null ? "N/A" : `${pctAttendance.toFixed(1)}%`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Renders the Signatures block: adviser name + read-only school head name.
  function renderSignatures() {
    const labelStyle = { fontSize: "12px", fontWeight: "bold" };
    return (
      <div style={{ marginBottom: "20px", borderTop: "1px solid #ddd", paddingTop: "12px" }}>
        <p style={{ margin: "0 0 8px", fontWeight: "bold", fontSize: "13px" }}>Signatures</p>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>Adviser Name</label>
            <br />
            <input
              type="text"
              value={adviserName}
              placeholder={user?.email || "Adviser name"}
              onChange={(e) => setAdviserName(e.target.value)}
              style={{ width: "240px", padding: "4px" }}
            />
          </div>
          <div>
            <label style={labelStyle}>School Head Name</label>
            <br />
            <input
              type="text"
              value={schoolConfig.principalName}
              readOnly
              style={{ width: "240px", padding: "4px", background: "#f0f0f0" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "1100px", margin: "30px auto", padding: "0 16px" }}>
      <button onClick={goBack} style={{ marginBottom: "12px" }}>← Back to Dashboard</button>
      <h1 style={{ marginBottom: "4px" }}>School Form 2 — Daily Attendance</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Logged in as: <strong>{user.email}</strong>
      </p>

      {/* Class + month pickers */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", alignItems: "flex-end" }}>
        <div>
          <label>Class</label><br />
          <select
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            style={{ minWidth: "220px", padding: "4px" }}
          >
            <option value="">-- Select Class --</option>
            {gradeSectionOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Month</label><br />
          <input
            type="month"
            value={monthValue}
            onChange={(e) => {
              setMonthValue(e.target.value);
              setStatusMessage("");
            }}
            style={{ padding: "4px" }}
          />
        </div>
      </div>

      {/* Legend & Guidelines (collapsible, collapsed by default) */}
      {renderLegend()}

      {/* Class Summary + Signatures shown once a class with learners is selected */}
      {!loading && hasSelection && filteredLearners.length > 0 && (
        <>
          {renderSummary()}
          {renderSignatures()}
        </>
      )}

      {/* Save button — placed below the summary/signatures sections */}
      <div style={{ marginBottom: "16px" }}>
        <button onClick={handleSave} disabled={isSaving || !hasSelection} style={{ padding: "6px 14px" }}>
          {isSaving ? "Saving..." : "Save Month"}
        </button>
      </div>

      {statusMessage && (
        <p style={{ marginTop: "12px", color: statusMessage.startsWith("Attendance") ? "green" : "red" }}>
          {statusMessage}
        </p>
      )}

      {/* Guards: nothing selected vs. no learners for this class */}
      {loading && <p style={{ color: "#777" }}>Loading learners...</p>}
      {!loading && !hasSelection && (
        <p style={{ textAlign: "center", color: "#777", marginTop: "40px", fontSize: "16px" }}>
          Select a class and month to begin
        </p>
      )}
      {!loading && hasSelection && filteredLearners.length === 0 && (
        <p style={{ textAlign: "center", color: "#777", marginTop: "40px", fontSize: "16px" }}>
          No learners found for this class.
        </p>
      )}

      {/* Attendance grid */}
      {!loading && hasSelection && filteredLearners.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={centerCellStyle}>No.</th>
                <th style={cellStyle}>Name</th>
                {weekdays.map((w) => (
                  <th key={w.dateString} style={weekdayHeaderStyle}>
                    <div>{w.label}</div>
                    <div>{w.day}</div>
                  </th>
                ))}
                <th style={centerCellStyle}>Absent</th>
                <th style={centerCellStyle}>Tardy</th>
                <th style={centerCellStyle}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {/* Male section */}
              {maleLearners.length > 0 && renderGroupHeader("MALE")}
              {maleLearners.map((l, i) => renderLearnerRow(l, i + 1))}
              {maleLearners.length > 0 && renderSubtotalRow("Absent Count", maleLearners, false)}

              {/* Female section */}
              {femaleLearners.length > 0 && renderGroupHeader("FEMALE")}
              {femaleLearners.map((l, i) => renderLearnerRow(l, maleLearners.length + i + 1))}
              {femaleLearners.length > 0 && renderSubtotalRow("Absent Count", femaleLearners, false)}

              {/* Combined subtotal across both groups */}
              {renderSubtotalRow("COMBINED — Absent Count", [], true)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SF2;

