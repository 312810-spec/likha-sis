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

// Common table cell style, consistent with SF1.jsx / ViewLearners.jsx.
const cellStyle = { border: "1px solid #ccc", padding: "6px", textAlign: "left" };
// Center-aligned variant used for the compact weekday date columns.
const centerCellStyle = { ...cellStyle, textAlign: "center" };

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
        return;
      }
      const docId = makeDocumentId(filterValue, monthValue);
      try {
        const snap = await getDoc(doc(db, "attendance", docId));
        if (snap.exists()) {
          setRecords(snap.data().records || {});
        } else {
          setRecords({});
        }
      } catch (err) {
        console.error("Failed to load attendance:", err);
        setRecords({});
      }
    }
    loadAttendance();
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
        <td colSpan={weekdays.length + 2} style={{ border: "1px solid #ccc", padding: "6px" }} />
      </tr>
    );
  }

  const hasSelection = Boolean(filterValue && monthValue);

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

