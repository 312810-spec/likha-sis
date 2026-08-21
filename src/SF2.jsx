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
import useSchoolConfig from "./hooks/useSchoolConfig";
import useTeacherScope from "./hooks/useTeacherScope";
import { Info } from "lucide-react";
import PageHeader from "./components/PageHeader.jsx";
import Button from "./components/Button.jsx";
import { inputClass } from "./components/settings/settingsStyles.js";

import checkAutoFlagTriggers from "./utils/autoFlagTriggers";
import { getWeekdays, makeAttendanceDocId, schoolYearFromMonth } from "./utils/attendanceDates";
import buildAttendanceYearOverview from "./utils/attendanceYearOverview";

// The importer stores sex as "Male"/"Female"; the roster below groups by M/F.
function sexLetter(sex) {
  const s = String(sex || "").trim().toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return "";
}

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

// Sort comparator: lastName first, then firstName (both case-insensitive).
function byName(a, b) {
  const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
  if (last !== 0) return last;
  return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
}

// Formats a "YYYY-MM" month string into a human-readable label, e.g. "2026-08" -> "August 2026".
function formatMonthLabel(monthValue) {
  if (!monthValue) return "";
  const [year, month] = monthValue.split("-");
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName = monthNames[Number(month) - 1];
  return monthName && year ? `${monthName} ${year}` : monthValue;
}

// ---- Component -------------------------------------------------------------

function SF2({ user, userRoles }) {
  const { config } = useSchoolConfig();
  const currentSchool = { ...schoolConfig, ...config };
  // Only the adviser marks attendance; other roles granted sf2 access
  // (principal, masterTeacher, smeaCoordinator, guidance, ictCoordinator)
  // only see the read-only Year Overview tab.
  const isAdviser = Array.isArray(userRoles) && userRoles.includes("adviser");
  const [activeTab, setActiveTab] = useState(isAdviser ? "grid" : "overview");
  const [yearOverviewDocs, setYearOverviewDocs] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(false);
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
  // showPrintArea: renders the printable SF2 report block and triggers window.print().
  const [showPrintArea, setShowPrintArea] = useState(false);
  // pendingFlagCandidates: learners whose attendance rate auto-flagged a LARDO
  // risk during the last save, awaiting explicit confirmation (same shape as
  // ConsolidatedGrades): { docId, learner, learnerId, schoolYear, trigger }.
  const [pendingFlagCandidates, setPendingFlagCandidates] = useState([]);

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
  // An adviser (the only role that marks attendance -- see isAdviser above)
  // is restricted to their own advisory section only, never every section
  // in the school; the other roles keep the full school-wide list since
  // they legitimately review any section's Year Overview.
  const { adviser } = useTeacherScope(user, schoolYearFromMonth(monthValue));
  const advisoryFilterValue = adviser ? `${adviser.gradeLevel} - ${adviser.section}` : null;
  const gradeSectionOptions = isAdviser && adviser
    ? [advisoryFilterValue]
    : Array.from(
        new Set(
          learners
            .filter((l) => l.gradeLevel && l.section)
            .map((l) => `${l.gradeLevel} - ${l.section}`)
        )
      ).sort();

  // Lock the adviser's filterValue to their own section once resolved.
  useEffect(() => {
    if (isAdviser && advisoryFilterValue && filterValue !== advisoryFilterValue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilterValue(advisoryFilterValue);
    }
  }, [isAdviser, advisoryFilterValue, filterValue]);

  // Split the selected "Grade - Section" string back into its parts.
  const [selectedGradeLevel = "", selectedSection = ""] = filterValue
    ? filterValue.split(" - ")
    : ["", ""];

  // Learners matching the selected class, split by sex and sorted by name.
  const filteredLearners = filterValue
    ? learners.filter((l) => `${l.gradeLevel} - ${l.section}` === filterValue)
    : [];
  const maleLearners = filteredLearners.filter((l) => sexLetter(l.sex) === "M").sort(byName);
  const femaleLearners = filteredLearners.filter((l) => sexLetter(l.sex) === "F").sort(byName);

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
      const docId = makeAttendanceDocId(filterValue, monthValue);
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

  // Load every attendance doc for the selected class across the current
  // school year (all months, not just the one picked above) to power the
  // Year Overview tab.
  useEffect(() => {
    if (activeTab !== "overview" || !filterValue) {
      return;
    }
    let cancelled = false;

    async function loadYearOverview() {
      setLoadingOverview(true);
      try {
        const snapshot = await getDocs(collection(db, "attendance"));
        if (cancelled) return;
        const targetSchoolYear = schoolYearFromMonth(monthValue);
        const docs = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.gradeLevel !== selectedGradeLevel) return;
          if (d.section !== selectedSection) return;
          if (schoolYearFromMonth(d.month) !== targetSchoolYear) return;
          docs.push(d);
        });
        setYearOverviewDocs(docs);
      } catch (err) {
        console.error("Failed to load attendance year overview:", err);
        if (!cancelled) setYearOverviewDocs([]);
      } finally {
        if (!cancelled) setLoadingOverview(false);
      }
    }

    loadYearOverview();
    return () => {
      cancelled = true;
    };
  }, [activeTab, filterValue, selectedGradeLevel, selectedSection, monthValue]);

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
    // Defense in depth: the class picker is already disabled/locked for an
    // adviser, but re-check here in case client state was manipulated --
    // never save attendance outside the adviser's own advisory section.
    if (isAdviser && adviser && filterValue !== advisoryFilterValue) {
      setStatusMessage("You may only mark attendance for your own advisory section.");
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

      const docId = makeAttendanceDocId(filterValue, monthValue);
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

      // Auto-flag LARDO risk based on each learner's attendance rate for the month.
      // Attendance rate = present days / total weekdays * 100; Tardy is NOT counted
      // as absent. Guard against a zero-weekday month to avoid division by zero.
      const totalWeekdays = weekdays.length;
      if (totalWeekdays > 0) {
        for (const learner of filteredLearners) {
          try {
            const presentDays = totalWeekdays - learnerAbsentCount(learner.id);
            const attendanceRate = (presentDays / totalWeekdays) * 100;
            const trigger = checkAutoFlagTriggers({
              attendanceRate,
              generalAverage: null,
              subjectFinalGrades: null,
              nutritionStatus: null,
            });
            if (!trigger) continue;

            const schoolYear = (learner.schoolYear || "").trim();
            const lardoDocId = `${learner.id}_${schoolYear}`;
            const existing = await getDoc(doc(db, "lardoRecords", lardoDocId));
            const existsMonitoring =
              existing.exists() && existing.data()?.status === "monitoring";
            if (existsMonitoring) continue;

            setPendingFlagCandidates((prev) => {
              if (prev.find((p) => p.docId === lardoDocId)) return prev;
              return [
                ...prev,
                {
                  docId: lardoDocId,
                  learner,
                  learnerId: learner.id,
                  schoolYear,
                  trigger,
                },
              ];
            });
          } catch (err) {
            console.error("Auto-flag check failed for learner:", err);
          }
        }
      }

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

  // ---- Printable Daily Attendance Report (SF2) -----------------------------

  // One learner row for the printable grid: X = Absent, shaded cell = Tardy, blank = Present.
  function renderPrintLearnerRow(learner, no) {
    return (
      <tr key={learner.id}>
        <td>{no}</td>
        <td className="sf2-cell-left">
          {learner.lastName || ""}, {learner.firstName || ""}
        </td>
        {weekdays.map((w) => {
          const value = records[learner.id]?.[w.dateString] || "";
          return (
            <td key={w.dateString} className={value === "T" ? "sf2-tardy" : ""}>
              {value === "A" ? "X" : ""}
            </td>
          );
        })}
        <td className="sf2-cell-total">{learnerAbsentCount(learner.id)}</td>
      </tr>
    );
  }

  // Full attendance grid for the printout: Male/Female learner groups, a per-day
  // total row for each group, and a combined per-day total row.
  function renderPrintGrid() {
    const combinedOnDate = (dateString) =>
      groupAbsentOnDate(maleLearners, dateString) +
      groupAbsentOnDate(femaleLearners, dateString);
    const combinedTotal = () =>
      groupAbsentTotal(maleLearners) + groupAbsentTotal(femaleLearners);

    return (
      <table className="sf2-table">
        <thead>
          <tr>
            <th>No.</th>
            <th className="sf2-cell-left">Name</th>
            {weekdays.map((w) => (
              <th key={w.dateString}>
                {w.label}
                <br />
                {w.day}
              </th>
            ))}
            <th className="sf2-cell-total">
              Total for the Month
              <br />
              (Absent count)
            </th>
          </tr>
        </thead>
        <tbody>
          {maleLearners.map((l, i) => renderPrintLearnerRow(l, i + 1))}
          <tr className="sf2-subtotal">
            <td colSpan={2} className="sf2-cell-left">
              {"<== MALE | TOTAL Per Day ===>"}
            </td>
            {weekdays.map((w) => (
              <td key={w.dateString}>{groupAbsentOnDate(maleLearners, w.dateString)}</td>
            ))}
            <td className="sf2-cell-total">{groupAbsentTotal(maleLearners)}</td>
          </tr>
          {femaleLearners.map((l, i) => renderPrintLearnerRow(l, i + 1))}
          <tr className="sf2-subtotal">
            <td colSpan={2} className="sf2-cell-left">
              {"<== FEMALE | TOTAL Per Day ===>"}
            </td>
            {weekdays.map((w) => (
              <td key={w.dateString}>{groupAbsentOnDate(femaleLearners, w.dateString)}</td>
            ))}
            <td className="sf2-cell-total">{groupAbsentTotal(femaleLearners)}</td>
          </tr>
          <tr className="sf2-combined">
            <td colSpan={2} className="sf2-cell-left">
              Combined TOTAL Per Day
            </td>
            {weekdays.map((w) => (
              <td key={w.dateString}>{combinedOnDate(w.dateString)}</td>
            ))}
            <td className="sf2-cell-total">{combinedTotal()}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  // Summary block under the grid: codes box + enrolment table + formula lines.
  function renderPrintSummary() {
    return (
      <div>
        <div className="sf2-summary-row">
          <div className="sf2-codes-box">
            <div className="sf2-box-title">1. CODES FOR CHECKING ATTENDANCE</div>
            <div>
              (blank) - Present; (x) - Absent; Tardy (half shaded = Upper for Late
              Comer, Lower for Cutting Classes)
            </div>
          </div>
          <table className="sf2-table sf2-summary-table">
            <tbody>
              <tr>
                <td className="sf2-cell-left">Month</td>
                <td colSpan={2}>{formatMonthLabel(monthValue)}</td>
              </tr>
              <tr>
                <td className="sf2-cell-left">No. of Days of Classes</td>
                <td colSpan={2}>{numberSchoolDays}</td>
              </tr>
              <tr>
                <th>M</th>
                <th>F</th>
                <th>Total</th>
              </tr>
              <tr>
                <td>{maleLearners.length}</td>
                <td>{femaleLearners.length}</td>
                <td>{registeredLearners}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="sf2-formulas">
          <div>
            Percentage of Enrolment:{" "}
            <strong>
              {pctEnrolment === null || pctEnrolment === undefined
                ? "—"
                : `${pctEnrolment.toFixed(2)}%`}
            </strong>
          </div>
          <div>
            Average Daily Attendance:{" "}
            <strong>
              {averageDailyAttendance === null || averageDailyAttendance === undefined
                ? "—"
                : averageDailyAttendance.toFixed(2)}
            </strong>
          </div>
          <div>
            Percentage of Attendance for the month:{" "}
            <strong>
              {pctAttendance === null || pctAttendance === undefined
                ? "—"
                : `${pctAttendance.toFixed(2)}%`}
            </strong>
          </div>
        </div>
      </div>
    );
  }

  // Certification + signature lines for the printout.
  function renderPrintSignature() {
    return (
      <div>
        <div className="sf2-cert">I certify that this is a true and correct report.</div>
        <div className="sf2-sig">
          <div className="sf2-sig-box">
            <div className="sf2-sig-line">{adviserName || user?.email || ""}</div>
            <div className="sf2-sig-label">(Signature of Adviser over Printed Name)</div>
          </div>
          <div className="sf2-sig-box">
            <div className="sf2-sig-label sf2-sig-head-label">Attested by:</div>
            <div className="sf2-sig-line" />
            <div className="sf2-sig-label">(Signature of School Head over Printed Name)</div>
          </div>
        </div>
      </div>
    );
  }
  const hasSelection = Boolean(filterValue && monthValue);
  const yearOverview = buildAttendanceYearOverview({
    monthDocs: yearOverviewDocs,
    learners: filteredLearners,
  });

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
              value={currentSchool.principalName}
              readOnly
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 px-3 py-2 cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-none w-full">
      {/* Print CSS — screen chrome hides, the printable SF2 report stays plain. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .sf2-print-area, .sf2-print-area * { visibility: visible; }
          .sf2-print-area {
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
          @page { size: landscape; }
        }
        .sf2-table { border-collapse: collapse; width: 100%; }
        .sf2-table th, .sf2-table td {
          border: 1px solid #000;
          padding: 1px 2px;
          font-size: 7.5pt;
          text-align: center;
          line-height: 1.15;
          color: #000;
          background: #fff;
        }
        .sf2-table th { background: #e8e8e8; font-weight: bold; }
        .sf2-cell-left { text-align: left !important; }
        .sf2-cell-total { white-space: nowrap; font-weight: bold; }
        .sf2-tardy { background: #b9b9b9 !important; font-weight: bold; }
        .sf2-subtotal td { background: #e8e8e8 !important; font-weight: bold; }
        .sf2-combined td { background: #cfcfcf !important; font-weight: bold; }
        .sf2-title { font-weight: bold; font-size: 12pt; text-align: center; margin-bottom: 6px; }
        .sf2-header { margin-bottom: 8px; font-size: 8.5pt; line-height: 1.5; color: #000; }
        .sf2-summary-row { display: flex; gap: 8px; align-items: stretch; margin-top: 8px; }
        .sf2-codes-box {
          flex: 1 1 58%;
          border: 1px solid #000;
          padding: 4px 6px;
          font-size: 7.5pt;
          line-height: 1.4;
          color: #000;
        }
        .sf2-box-title { font-weight: bold; font-size: 8pt; margin-bottom: 3px; }
        .sf2-summary-table { flex: 1 1 42%; }
        .sf2-formulas { margin-top: 6px; font-size: 7.5pt; line-height: 1.5; color: #000; }
        .sf2-cert { font-weight: bold; font-size: 9pt; text-align: center; margin-top: 12px; margin-bottom: 8px; color: #000; }
        .sf2-sig { display: flex; gap: 50px; margin-top: 8px; color: #000; }
        .sf2-sig-box { flex: 1; text-align: center; }
        .sf2-sig-line {
          border-bottom: 1px solid #000;
          min-height: 24px;
          padding-top: 10px;
          font-weight: bold;
          font-size: 9pt;
        }
        .sf2-sig-label { font-size: 7pt; margin-top: 2px; }
        .sf2-sig-head-label { margin-bottom: 18px; margin-top: 0; }
      `}</style>

      {/* Header + class/month pickers */}
      <div className="no-print">
        <PageHeader description="Daily Attendance">
          <select
            aria-label="Select class"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            disabled={isAdviser && !!adviser}
            className={inputClass}
          >
            <option value="">-- Select Class --</option>
            {gradeSectionOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <input
            aria-label="Select month"
            type="month"
            value={monthValue}
            onChange={(e) => {
              setMonthValue(e.target.value);
              setStatusMessage("");
            }}
            className={inputClass}
          />
        </PageHeader>
      </div>

      {/* Tab bar — adviser can switch between marking attendance and the
          year-long trend; other sf2-access roles only ever see Year Overview. */}
      {isAdviser && (
        <div className="no-print flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: "grid", label: "Attendance Grid" },
            { id: "overview", label: "Year Overview" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150 ${
                activeTab === tab.id
                  ? "border-primary text-primary dark:text-primary-light"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "overview" && (
        <div className="no-print bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Attendance Year Overview{filterValue ? ` — ${filterValue}` : ""}
          </h2>
          {!filterValue && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a class above to see its attendance trend.
            </p>
          )}
          {filterValue && loadingOverview && (
            <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          )}
          {filterValue && !loadingOverview && yearOverview.months.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No saved attendance found yet for this class this school year.
            </p>
          )}
          {filterValue && !loadingOverview && yearOverview.months.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-primary/5 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold">
                    <th className="p-2 text-left border-b border-gray-200 dark:border-gray-700">Learner</th>
                    {yearOverview.months.map((m) => (
                      <th key={m} className="p-2 text-center border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">
                        {formatMonthLabel(m)}
                      </th>
                    ))}
                    <th className="p-2 text-center border-b border-gray-200 dark:border-gray-700">Year Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
                  {yearOverview.perLearner.map((l) => (
                    <tr key={l.learnerId}>
                      <td className="p-2">{l.name}</td>
                      {yearOverview.months.map((m) => (
                        <td key={m} className="p-2 text-center font-mono">
                          {l.monthlyRates[m] === null ? "—" : `${l.monthlyRates[m].toFixed(1)}%`}
                        </td>
                      ))}
                      <td className="p-2 text-center font-mono font-semibold">
                        {l.yearAverage === null ? "—" : `${l.yearAverage.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-800/60 font-bold">
                    <td className="p-2">Class Average</td>
                    {yearOverview.months.map((m) => (
                      <td key={m} className="p-2 text-center font-mono">
                        {yearOverview.classAverage[m] === null
                          ? "—"
                          : `${yearOverview.classAverage[m].toFixed(1)}%`}
                      </td>
                    ))}
                    <td className="p-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isAdviser && activeTab === "grid" && (
        <>
      {/* Legend & Guidelines */}
      <div className="no-print">{renderLegend()}</div>

      {/* Class Summary + Signatures shown once a class with learners is selected */}
      {!loading && hasSelection && filteredLearners.length > 0 && (
        <div className="no-print bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
          {renderSummary()}
          {renderSignatures()}
        </div>
      )}

      {/* Save button, Print Report & Status */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={isSaving || !hasSelection}>
          {isSaving ? "Saving..." : "Save Month"}
        </Button>
        {hasSelection && (
          <button
            onClick={() => {
              setShowPrintArea(true);
              setTimeout(() => window.print(), 150);
            }}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98]"
            type="button"
          >
            🖨 Print Report
          </button>
        )}
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

      {/* Auto-flag confirmation banners */}
      {pendingFlagCandidates.map((c) => (
        <div key={c.docId} className="no-print animate-fade-in bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg text-sm flex items-center gap-4">
          <Info className="w-4 h-4 shrink-0 text-yellow-700" />
          <div className="flex-1">
            <div className="font-medium">This learner's attendance suggests a LARDO risk flag.</div>
            <div className="text-xs mt-0.5">Flag {c.learner.lastName || ""}, {c.learner.firstName || ""} for monitoring?</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              onClick={async () => {
                try {
                  const nowIso = new Date().toISOString();
                  const lastName = c.learner.lastName || "";
                  const firstName = c.learner.firstName || "";
                  const learnerName = `${lastName}, ${firstName}`.trim();
                  const learnerLRN = c.learner.lrn || c.learner.learnerLRN || "";
                  const gradeLvl = c.learner.gradeLevel || selectedGradeLevel;
                  const sectionName = c.learner.section || selectedSection;

                  const newRecordData = {
                    learnerId: c.learnerId,
                    learnerLRN,
                    learnerName,
                    gradeLevel: gradeLvl,
                    section: sectionName,
                    schoolYear: c.schoolYear,
                    riskFactors: c.trigger.riskFactors,
                    status: "monitoring",
                    interventions: [
                      {
                        date: nowIso,
                        note: c.trigger.suggestedNote,
                      },
                    ],
                    flaggedDate: nowIso,
                    flaggedByEmail: user?.email || "",
                    updatedAt: serverTimestamp(),
                  };

                  await setDoc(doc(db, "lardoRecords", c.docId), newRecordData, { merge: true });
                  setPendingFlagCandidates((prev) => prev.filter((p) => p.docId !== c.docId));
                } catch (err) {
                  console.error("Failed to create LARDO record:", err);
                  setStatusMessage("Failed to create LARDO record. Please try again.");
                }
              }}
            >
              Flag for monitoring
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setPendingFlagCandidates((prev) => prev.filter((p) => p.docId !== c.docId))}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}

      {/* Loading state */}
      {loading && (
        <div className="no-print space-y-3 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      )}

      {/* Guards: nothing selected vs. no learners for this class */}
      {!loading && !hasSelection && (
        <div className="no-print p-8 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm">
          Select a class and month to begin
        </div>
      )}
      {!loading && hasSelection && filteredLearners.length === 0 && (
        <div className="no-print p-8 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm">
          No learners found for this class.
        </div>
      )}

      {/* Attendance grid */}
      {!loading && hasSelection && filteredLearners.length > 0 && (
        <div className="no-print bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
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
{/* Printable Daily Attendance Report — only rendered while printing. */}
      {showPrintArea && hasSelection && filteredLearners.length > 0 && (
        <div className="sf2-print-area">
          <div
            style={{
              padding: "0.35in 0.4in",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            {/* Header */}
            <div className="sf2-header">
              <div className="sf2-title">
                School Form 2 (SF2) Daily Attendance Report of Learners
              </div>
              <div>
                School ID: <strong>{currentSchool.schoolId || ""}</strong>
              </div>
              <div>
                School Name: <strong>{currentSchool.schoolName}</strong>
              </div>
              <div>
                School Year: <strong>{schoolYearFromMonth(monthValue)}</strong>
              </div>
              <div>
                Report for the Month of{" "}
                <strong>{formatMonthLabel(monthValue)}</strong>
              </div>
              <div>
                Grade Level: <strong>{selectedGradeLevel}</strong> &nbsp;&nbsp;{" "}
                Section: <strong>{selectedSection}</strong>
              </div>
            </div>

            {/* Attendance grid */}
            {renderPrintGrid()}

            {/* Summary block */}
            {renderPrintSummary()}

            {/* Signature block */}
            {renderPrintSignature()}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

export default SF2;
