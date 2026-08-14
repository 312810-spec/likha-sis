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

  // One learner row (reused for both the male and female groups).
  function renderLearnerRow(learner, no) {
    return (
      <tr key={learner.id} className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
        <td className="p-2 text-center border-r border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-mono">
          {no}
        </td>
        <td className="p-2 border-r border-gray-200 dark:border-gray-700 font-medium text-gray-900 dark:text-gray-100">
          {learner.lastName || ""}, {learner.firstName || ""}
        </td>
        {weekdays.map((w) => {
          const value = records[learner.id]?.[w.dateString] || "";
          return (
            <td key={w.dateString} className="p-1 text-center border-r border-gray-200 dark:border-gray-700">
              <button
                type="button"
                className={`w-7 h-6 p-0 text-xs rounded transition-colors duration-150 active:scale-[0.98] inline-flex items-center justify-center font-bold ${
                  value === "A"
                    ? "bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-400 border border-red-300 dark:border-red-800"
                    : value === "T"
                    ? "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => cycleCell(learner.id, w.dateString)}
                title={`${w.label} ${w.day}`}
              >
                {value === "A" ? "✕" : value === "T" ? "T" : ""}
              </button>
            </td>
          );
        })}
        <td className="p-2 text-center border-r border-gray-200 dark:border-gray-700 font-mono font-semibold">
          {learnerAbsentCount(learner.id) > 0 ? (
            <span className="inline-block px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-400">
              {learnerAbsentCount(learner.id)}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">0</span>
          )}
        </td>
        <td className="p-2 text-center border-r border-gray-200 dark:border-gray-700 font-mono font-semibold">
          {learnerTardyCount(learner.id) > 0 ? (
            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
              {learnerTardyCount(learner.id)}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">0</span>
          )}
        </td>
        <td className="p-1.5 text-center">
          <select
            value={remarksData[learner.id] || ""}
            onChange={(e) => handleRemarkChange(learner.id, e.target.value)}
            className="w-full text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-colors max-w-[150px]"
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
      <tr
        key={label}
        className={
          isCombined
            ? "bg-primary/10 dark:bg-primary/20 font-bold text-gray-900 dark:text-gray-100 border-t-2 border-gray-300 dark:border-gray-600"
            : "bg-gray-50 dark:bg-gray-800/60 font-bold text-gray-800 dark:text-gray-200"
        }
      >
        <td colSpan={2} className="p-2 border-r border-gray-200 dark:border-gray-700 font-bold">
          {label}
        </td>
        {weekdays.map((w) => {
          const maleCount = groupAbsentOnDate(maleLearners, w.dateString);
          const femaleCount = groupAbsentOnDate(femaleLearners, w.dateString);
          const count = isCombined
            ? maleCount + femaleCount
            : groupAbsentOnDate(group, w.dateString);
          return (
            <td key={w.dateString} className="p-1 text-center border-r border-gray-200 dark:border-gray-700 font-mono font-bold">
              {count}
            </td>
          );
        })}
        <td className="p-2 text-center border-r border-gray-200 dark:border-gray-700 font-mono font-bold text-red-700 dark:text-red-400">
          {isCombined
            ? groupAbsentTotal(maleLearners) + groupAbsentTotal(femaleLearners)
            : groupAbsentTotal(group)}
        </td>
        <td className="p-2 text-center border-r border-gray-200 dark:border-gray-700 font-mono font-bold text-amber-700 dark:text-amber-400">
          {isCombined
            ? groupTardyTotal(maleLearners) + groupTardyTotal(femaleLearners)
            : groupTardyTotal(group)}
        </td>
        <td className="p-2 text-center" />
      </tr>
    );
  }

  // Bold labeled group separator row (MALE / FEMALE) spanning No. + Name columns.
  function renderGroupHeader(label) {
    return (
      <tr key={label} className="bg-gray-100 dark:bg-gray-800/80 font-bold text-gray-700 dark:text-gray-200 tracking-wider">
        <td
          colSpan={2}
          className="p-2 border-r border-gray-200 dark:border-gray-700 uppercase"
        >
          {label}
        </td>
        <td colSpan={weekdays.length + 3} className="p-2 border-t border-b border-gray-200 dark:border-gray-700" />
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
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setShowLegend((v) => !v)}
          className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold text-xs flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors duration-150 active:scale-[0.98]"
        >
          <span>{showLegend ? "▼" : "▶"} Legend &amp; Guidelines</span>
        </button>
        {showLegend && (
          <div className="p-4 text-xs leading-relaxed text-gray-700 dark:text-gray-300 space-y-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              <strong>Attendance Codes:</strong> (blank) = Present; X = Absent; T = Tardy
            </p>
            <p className="font-semibold text-gray-900 dark:text-gray-100 pt-1">
              Reasons/Causes for Non-Literate/Struggling learners (NLS):
            </p>
            <p>
              a. <strong>Domestic-Related Factors:</strong> a1. Had to take care of siblings, a2. Early
              marriage/pregnancy, a3. Parents&apos; attitude toward schooling, a4. Family problems
            </p>
            <p>
              b. <strong>Individual-Related Factors:</strong> b1. Illness, b2. Overage, b3. Death, b4.
              Drug Abuse, b5. Poor academic performance, b6. Lack of interest/Distractions, b7.
              Hunger/Malnutrition
            </p>
            <p>
              c. <strong>School-Related Factors:</strong> c1. Teacher Factor, c2. Physical condition of
              classroom, c3. Peer influence
            </p>
            <p>
              d. <strong>Geographic/Environmental:</strong> d1. Distance between home and school, d2.
              Armed conflict, d3. Calamities/Disasters
            </p>
            <p>
              e. <strong>Financial-Related:</strong> e1. Child labor, work
            </p>
            <p>f. <strong>Others (Specify)</strong></p>
          </div>
        )}
      </div>
    );
  }

  // Renders the Class Summary: four MANUAL inputs plus auto-computed read-only values.
  function renderSummary() {
    const manualFields = [
      { key: "enrolmentFirstFriday", label: "Enrolment as of 1st Friday of School Year" },
      { key: "lateEnrollment", label: "Late Enrollment during month" },
      { key: "transferredIn", label: "Transferred In during month" },
      { key: "transferredOut", label: "Transferred Out during month" },
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Class Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {manualFields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
              <input
                type="number"
                min="0"
                value={summaryInputs[f.key]}
                onChange={(e) => updateSummary(f.key, e.target.value)}
                className="w-full text-sm text-right rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
              />
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 max-w-xl">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Registered Learners as of end of month</td>
                <td className="px-3 py-2 font-bold text-right text-gray-900 dark:text-gray-100">{registeredLearners}</td>
              </tr>
              <tr className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Number of School Days</td>
                <td className="px-3 py-2 font-bold text-right text-gray-900 dark:text-gray-100">{numberSchoolDays}</td>
              </tr>
              <tr className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Total Daily Attendance</td>
                <td className="px-3 py-2 font-bold text-right text-gray-900 dark:text-gray-100">{totalDailyAttendance}</td>
              </tr>
              <tr className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Average Daily Attendance</td>
                <td className="px-3 py-2 font-bold text-right text-gray-900 dark:text-gray-100">{averageDailyAttendance.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Percentage of Enrolment</td>
                <td className="px-3 py-2 font-bold text-right text-gray-900 dark:text-gray-100">
                  {pctEnrolment === null ? "N/A" : `${pctEnrolment.toFixed(1)}%`}
                </td>
              </tr>
              <tr className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Percentage of Attendance for the month</td>
                <td className="px-3 py-2 font-bold text-right text-gray-900 dark:text-gray-100">
                  {pctAttendance === null ? "N/A" : `${pctAttendance.toFixed(1)}%`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Renders the Signatures block: adviser name + read-only school head name.
  function renderSignatures() {
    return (
      <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Signatures</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Adviser Name</label>
            <input
              type="text"
              value={adviserName}
              placeholder={user?.email || "Adviser name"}
              onChange={(e) => setAdviserName(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">School Head Name</label>
            <input
              type="text"
              value={schoolConfig.principalName}
              readOnly
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 px-3 py-2 cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-slide-up">
      {/* Header Bar */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        {goBack && (
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light font-medium mb-2 transition-colors duration-150 active:scale-[0.98]"
            type="button"
          >
            ← Back to Dashboard
          </button>
        )}
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          School Form 2 — Daily Attendance
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Logged in as: <strong className="text-gray-700 dark:text-gray-300">{user?.email || ""}</strong>
        </p>
      </div>

      {/* Class + month pickers */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Class</label>
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            >
              <option value="">-- Select Class --</option>
              {gradeSectionOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Month</label>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => {
                setMonthValue(e.target.value);
                setStatusMessage("");
              }}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Legend & Guidelines */}
      {renderLegend()}

      {/* Class Summary + Signatures shown once a class with learners is selected */}
      {!loading && hasSelection && filteredLearners.length > 0 && (
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
          {renderSummary()}
          {renderSignatures()}
        </div>
      )}

      {/* Save button & Status */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasSelection}
          className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
          type="button"
        >
          {isSaving ? "Saving..." : "Save Month"}
        </button>
        {statusMessage && (
          <span
            className={`text-xs font-medium px-3 py-1.5 rounded-lg animate-fade-in ${
              statusMessage.startsWith("Attendance")
                ? "bg-leaf/10 text-leaf-dark dark:bg-leaf/20 dark:text-leaf-light"
                : "bg-red-500/10 text-red-700 dark:text-red-400"
            }`}
          >
            {statusMessage}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      )}

      {/* Guards: nothing selected vs. no learners for this class */}
      {!loading && !hasSelection && (
        <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm">
          Select a class and month to begin
        </div>
      )}
      {!loading && hasSelection && filteredLearners.length === 0 && (
        <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm">
          No learners found for this class.
        </div>
      )}

      {/* Attendance grid */}
      {!loading && hasSelection && filteredLearners.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold sticky top-0 z-10">
                  <th className="p-2 text-center border-r border-gray-200 dark:border-gray-700 w-10">No.</th>
                  <th className="p-2 text-left border-r border-gray-200 dark:border-gray-700 min-w-[160px]">Name</th>
                  {weekdays.map((w) => (
                    <th key={w.dateString} className="p-1 text-center border-r border-gray-200 dark:border-gray-700 min-w-[32px]">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{w.label}</div>
                      <div className="leading-tight">{w.day}</div>
                    </th>
                  ))}
                  <th className="p-2 text-center border-r border-gray-200 dark:border-gray-700 w-14">Absent</th>
                  <th className="p-2 text-center border-r border-gray-200 dark:border-gray-700 w-14">Tardy</th>
                  <th className="p-2 text-center min-w-[140px]">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
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
        </div>
      )}
    </div>
  );
}

export default SF2;
