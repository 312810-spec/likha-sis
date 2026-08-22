// src/SF2.jsx
// School Form 2 — Daily Attendance.
// Three views for an adviser: Daily Attendance (the everyday workspace),
// Monthly SF2 (the official DepEd sheet -- review, correct, print), and
// Year Overview (the existing attendance trend monitor). Adviser-only, per
// pageAccess.js -- non-advisers never reach this component (App.jsx blocks
// them at the route level), so no non-adviser view is built here.
//
// Storage is unchanged: one Firestore doc per class+month at
// attendance/{gradeLevel}_{section}_{month}, records: learnerId ->
// { "YYYY-MM-DD": "A" | "T" } (blank/missing = Present). The whole month is
// loaded into memory up front and the complete in-memory state is written
// back on every save, so marking one day never loses any other day's data.

import { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
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
import Button from "./components/Button.jsx";

import checkAutoFlagTriggers from "./utils/autoFlagTriggers";
import {
  getWeekdays,
  makeAttendanceDocId,
  schoolYearFromMonth,
  todayDateString,
  shiftSchoolDay,
} from "./utils/attendanceDates";
import buildAttendanceYearOverview from "./utils/attendanceYearOverview";
import { cycleAttendanceValue, monthlyLearnerCounts, computeMonthlySummary } from "./utils/sf2Summary.js";
import { SF2_SHEET_NATURAL_WIDTH_PX } from "./utils/sf2Layout.js";
import { computeFitScale } from "./utils/sf1FitScale.js";
import SF2DailyAttendanceView from "./components/sf2/SF2DailyAttendanceView.jsx";
import SF2MonthlyView from "./components/sf2/SF2MonthlyView.jsx";
import SF2RemarksDialog from "./components/sf2/SF2RemarksDialog.jsx";

function sexLetter(sex) {
  const s = String(sex || "").trim().toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return "";
}

function byName(a, b) {
  const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
  if (last !== 0) return last;
  return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
}

function formatMonthLabel(monthValue) {
  if (!monthValue) return "";
  const [year, month] = monthValue.split("-");
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthName = monthNames[Number(month) - 1];
  return monthName && year ? `${monthName} ${year}` : monthValue;
}

function formatDateLabel(dateString) {
  if (!dateString) return "";
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

const EMPTY_SUMMARY_INPUTS = {
  enrolmentFirstFriday: 0,
  lateEnrollment: 0,
  transferredIn: 0,
  transferredOut: 0,
};

function SF2({ user, userRoles }) {
  const { config } = useSchoolConfig();
  const currentSchool = { ...schoolConfig, ...config };
  // pageAccess.js already blocks non-advisers before this component ever
  // mounts; this is a second, client-side check, defense in depth only.
  const hasAdviserRole = !Array.isArray(userRoles) || userRoles.includes("adviser");

  const [activeTab, setActiveTab] = useState("daily"); // "daily" | "monthly" | "overview"
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(() => todayDateString());
  const [unlockedDate, setUnlockedDate] = useState(() => todayDateString());
  const monthValue = selectedDate.slice(0, 7);

  const [records, setRecords] = useState({});
  const [remarksData, setRemarksData] = useState({});
  const [summaryInputs, setSummaryInputs] = useState(EMPTY_SUMMARY_INPUTS);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [remarksTarget, setRemarksTarget] = useState(null);
  const returnFocusRef = useRef(null);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const pendingActionRef = useRef(null);

  const [fitMode, setFitMode] = useState("fit");
  const previewContainerRef = useRef(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  const [yearOverviewDocs, setYearOverviewDocs] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [pendingFlagCandidates, setPendingFlagCandidates] = useState([]);

  const { adviser, profile, loading: scopeLoading } = useTeacherScope(user, schoolYearFromMonth(monthValue));
  const advisoryFilterValue = adviser ? `${adviser.gradeLevel} - ${adviser.section}` : null;
  const preparedBy = profile?.fullName || user?.displayName || user?.email || "[Class Adviser Name]";
  const certifiedBy = currentSchool.principalName || "[School Head Name]";

  // ---- Roster: adviser's own advisory section only ----
  useEffect(() => {
    let cancelled = false;
    async function fetchLearners() {
      if (scopeLoading) return;
      if (!adviser) {
        if (!cancelled) { setLearners([]); setLoading(false); }
        return;
      }
      try {
        const snapshot = await getDocs(
          query(
            collection(db, "learners"),
            where("gradeLevel", "==", adviser.gradeLevel),
            where("section", "==", adviser.section)
          )
        );
        if (!cancelled) setLearners(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to fetch learners:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLearners();
    return () => { cancelled = true; };
  }, [adviser, scopeLoading]);

  const maleLearners = learners.filter((l) => sexLetter(l.sex) === "M").sort(byName);
  const femaleLearners = learners.filter((l) => sexLetter(l.sex) === "F").sort(byName);
  const unresolvedSexLearners = learners.filter((l) => sexLetter(l.sex) === "").sort(byName);
  const weekdays = getWeekdays(monthValue);

  // ---- Load the month's attendance doc ----
  useEffect(() => {
    let cancelled = false;
    async function loadAttendance() {
      if (!advisoryFilterValue || !monthValue) {
        setRecords({});
        setRemarksData({});
        setSummaryInputs(EMPTY_SUMMARY_INPUTS);
        return;
      }
      const docId = makeAttendanceDocId(advisoryFilterValue, monthValue);
      try {
        const snap = await getDoc(doc(db, "attendance", docId));
        if (cancelled) return;
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
        } else {
          setRecords({});
          setRemarksData({});
          setSummaryInputs(EMPTY_SUMMARY_INPUTS);
        }
        setIsDirty(false);
      } catch (err) {
        console.error("Failed to load attendance:", err);
        if (!cancelled) { setRecords({}); setRemarksData({}); }
      }
    }
    loadAttendance();
    return () => { cancelled = true; };
  }, [advisoryFilterValue, monthValue, reloadKey]);

  // ---- Year Overview data (adviser's own section, current school year) ----
  useEffect(() => {
    if (activeTab !== "overview" || !advisoryFilterValue) return;
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
          if (d.gradeLevel !== adviser?.gradeLevel) return;
          if (d.section !== adviser?.section) return;
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
    return () => { cancelled = true; };
  }, [activeTab, advisoryFilterValue, adviser, monthValue]);

  // ---- Fit to Screen measurement (Monthly SF2 tab only) ----
  useEffect(() => {
    if (activeTab !== "monthly") return;
    const el = previewContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setPreviewWidth(entries[0]?.contentRect?.width || 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab]);
  const fitScale = fitMode === "actual" ? 1 : computeFitScale(previewWidth, SF2_SHEET_NATURAL_WIDTH_PX);

  // ---- Unsaved-changes guard ----
  function guardedNavigate(action) {
    if (isDirty) {
      pendingActionRef.current = action;
      setShowLeaveConfirm(true);
    } else {
      action();
    }
  }
  function handleStayHere() {
    setShowLeaveConfirm(false);
    pendingActionRef.current = null;
  }
  function handleLeaveWithoutSaving() {
    setShowLeaveConfirm(false);
    setIsDirty(false);
    setReloadKey((k) => k + 1);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) action();
  }

  // ---- Date navigation ----
  function goToDate(nextDate) {
    guardedNavigate(() => { setSelectedDate(nextDate); setUnlockedDate(null); });
  }
  function handlePrevDay() { goToDate(shiftSchoolDay(selectedDate, -1)); }
  function handleNextDay() { goToDate(shiftSchoolDay(selectedDate, 1)); }
  function handleDateChange(nextDate) { if (nextDate) goToDate(nextDate); }
  function handleToday() {
    guardedNavigate(() => { setSelectedDate(todayDateString()); setUnlockedDate(todayDateString()); });
  }
  function handleMonthChange(nextMonthValue) {
    const wd = getWeekdays(nextMonthValue);
    const nextDate = wd.length > 0 ? wd[0].dateString : `${nextMonthValue}-01`;
    goToDate(nextDate);
  }
  function handleTabChange(tab) {
    guardedNavigate(() => setActiveTab(tab));
  }
  function handleEditDay() { setUnlockedDate(selectedDate); }

  // ---- Attendance edits ----
  function setLearnerMark(learnerId, dateString, value) {
    setRecords((prev) => {
      const dateMap = { ...(prev[learnerId] || {}) };
      if (value === "") delete dateMap[dateString]; else dateMap[dateString] = value;
      const next = { ...prev };
      if (Object.keys(dateMap).length === 0) delete next[learnerId]; else next[learnerId] = dateMap;
      return next;
    });
    setIsDirty(true);
  }
  function handleSetAttendance(learnerId, value) { setLearnerMark(learnerId, selectedDate, value); }
  function handleMonthlyCellClick(learnerId, dateString) {
    const current = records[learnerId]?.[dateString] || "";
    setLearnerMark(learnerId, dateString, cycleAttendanceValue(current));
  }
  function handleMarkEveryonePresent() {
    const allIds = [...maleLearners, ...femaleLearners, ...unresolvedSexLearners].map((l) => l.id);
    setRecords((prev) => {
      const next = { ...prev };
      allIds.forEach((id) => {
        if (!next[id]) return;
        const dateMap = { ...next[id] };
        delete dateMap[selectedDate];
        if (Object.keys(dateMap).length === 0) delete next[id]; else next[id] = dateMap;
      });
      return next;
    });
    setIsDirty(true);
  }

  function openRemarks(learner, triggerEl) {
    returnFocusRef.current = triggerEl || document.activeElement;
    setRemarksTarget(learner);
  }
  function handleRemarksSave(remarkString) {
    setRemarksData((prev) => {
      const next = { ...prev };
      if (remarkString === "") delete next[remarksTarget.id]; else next[remarksTarget.id] = remarkString;
      return next;
    });
    setIsDirty(true);
    setRemarksTarget(null);
  }

  function updateSummaryInput(key, value) {
    setSummaryInputs((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  // ---- Save (shared by Daily Attendance and Monthly SF2) ----
  async function handleSaveAttendance() {
    if (!adviser || !advisoryFilterValue) {
      setStatusMessage("Could not save attendance. Please try again.");
      return;
    }
    setIsSaving(true);
    setStatusMessage("");
    try {
      const cleaned = {};
      Object.entries(records).forEach(([learnerId, dateMap]) => {
        const kept = Object.entries(dateMap).reduce((acc, [date, value]) => {
          if (value === "A" || value === "T") acc[date] = value;
          return acc;
        }, {});
        if (Object.keys(kept).length > 0) cleaned[learnerId] = kept;
      });

      const docId = makeAttendanceDocId(advisoryFilterValue, monthValue);
      await setDoc(doc(db, "attendance", docId), {
        gradeLevel: adviser.gradeLevel,
        section: adviser.section,
        month: monthValue,
        records: cleaned,
        remarks: remarksData,
        summary: {
          enrolmentFirstFriday: Number(summaryInputs.enrolmentFirstFriday) || 0,
          lateEnrollment: Number(summaryInputs.lateEnrollment) || 0,
          transferredIn: Number(summaryInputs.transferredIn) || 0,
          transferredOut: Number(summaryInputs.transferredOut) || 0,
        },
        adviserName: preparedBy,
        updatedAt: serverTimestamp(),
      });

      setIsDirty(false);
      setUnlockedDate(null);
      setStatusMessage("Attendance saved.");

      // LARDO auto-flag check -- only after a successful save (CLAUDE.md §4B.6).
      const totalWeekdays = weekdays.length;
      if (totalWeekdays > 0) {
        for (const learner of [...maleLearners, ...femaleLearners]) {
          try {
            const counts = monthlyLearnerCounts(cleaned, learner.id, weekdays);
            const attendanceRate = (counts.present / totalWeekdays) * 100;
            const trigger = checkAutoFlagTriggers({
              attendanceRate, generalAverage: null, subjectFinalGrades: null, nutritionStatus: null,
            });
            if (!trigger) continue;

            const schoolYear = (learner.schoolYear || "").trim();
            const lardoDocId = `${learner.id}_${schoolYear}`;
            const existing = await getDoc(doc(db, "lardoRecords", lardoDocId));
            const existsMonitoring = existing.exists() && existing.data()?.status === "monitoring";
            if (existsMonitoring) continue;

            setPendingFlagCandidates((prev) => {
              if (prev.find((p) => p.docId === lardoDocId)) return prev;
              return [...prev, { docId: lardoDocId, learner, learnerId: learner.id, schoolYear, trigger }];
            });
          } catch (err) {
            console.error("Auto-flag check failed for learner:", err);
          }
        }
      }
    } catch (error) {
      console.error("Error saving attendance:", error);
      setStatusMessage("Could not save attendance. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const yearOverview = buildAttendanceYearOverview({
    monthDocs: yearOverviewDocs,
    learners: [...maleLearners, ...femaleLearners],
  });

  const summary = computeMonthlySummary({
    maleLearnerIds: maleLearners.map((l) => l.id),
    femaleLearnerIds: femaleLearners.map((l) => l.id),
    weekdays,
    records,
    remarksData,
    enrolmentFirstFriday: summaryInputs.enrolmentFirstFriday,
  });

  if (!hasAdviserRole) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          You don't have access to this page. Contact your ICT Coordinator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  if (!scopeLoading && !adviser) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          No advisory class is assigned to your account. Please contact the ICT Coordinator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-none w-full">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden !important; }
          .sf2-print-view, .sf2-print-view * { visibility: visible !important; }
          .sf2-print-view {
            position: absolute; left: 0; top: 0; width: 100%;
            margin: 0; padding: 0; box-sizing: border-box;
          }
          .sf2-fit-wrapper { zoom: 1 !important; }
        }
      `}</style>

      {statusMessage && (
        <div
          className={`no-print animate-fade-in p-3.5 rounded-lg border text-sm font-medium ${
            statusMessage === "Attendance saved."
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          {statusMessage}
        </div>
      )}

      <div className="no-print bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap items-center gap-6">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Advisory Class</p>
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{advisoryFilterValue || "—"}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">School Year</p>
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{schoolYearFromMonth(monthValue)}</p>
        </div>
      </div>

      <div className="no-print flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: "daily", label: "Daily Attendance" },
          { id: "monthly", label: "Monthly SF2" },
          { id: "overview", label: "Year Overview" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors duration-150 min-h-[44px] ${
              activeTab === tab.id
                ? "border-primary text-primary dark:text-primary-light"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {pendingFlagCandidates.map((c) => (
        <div key={c.docId} className="no-print animate-fade-in bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg text-sm flex items-center gap-4">
          <Info className="w-4 h-4 shrink-0 text-yellow-700" />
          <div className="flex-1">
            <div className="font-medium">This learner's attendance suggests a monitoring risk.</div>
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
                  await setDoc(doc(db, "lardoRecords", c.docId), {
                    learnerId: c.learnerId,
                    learnerLRN,
                    learnerName,
                    gradeLevel: c.learner.gradeLevel || adviser?.gradeLevel,
                    section: c.learner.section || adviser?.section,
                    schoolYear: c.schoolYear,
                    riskFactors: c.trigger.riskFactors,
                    status: "monitoring",
                    interventions: [{ date: nowIso, note: c.trigger.suggestedNote }],
                    flaggedDate: nowIso,
                    flaggedByEmail: user?.email || "",
                    updatedAt: serverTimestamp(),
                  }, { merge: true });
                  setPendingFlagCandidates((prev) => prev.filter((p) => p.docId !== c.docId));
                } catch (err) {
                  console.error("Failed to create LARDO record:", err);
                  setStatusMessage("Failed to create LARDO record. Please try again.");
                }
              }}
            >
              Flag for Monitoring
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

      {loading && (
        <div className="no-print space-y-3 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      )}

      {!loading && learners.length === 0 && (
        <div className="no-print p-8 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm">
          No learners found for this class.
        </div>
      )}

      {!loading && learners.length > 0 && activeTab === "daily" && (
        <div className="no-print">
          <SF2DailyAttendanceView
            dateLabel={formatDateLabel(selectedDate)}
            dateString={selectedDate}
            isLocked={unlockedDate !== selectedDate}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onToday={handleToday}
            onDateChange={handleDateChange}
            maleLearners={maleLearners}
            femaleLearners={femaleLearners}
            unresolvedSexLearners={unresolvedSexLearners}
            records={records}
            remarksData={remarksData}
            onSetValue={handleSetAttendance}
            onRemarks={(learner) => openRemarks(learner)}
            onEditDay={handleEditDay}
            onMarkEveryonePresent={handleMarkEveryonePresent}
            onSave={handleSaveAttendance}
            isSaving={isSaving}
            isDirty={isDirty}
          />
        </div>
      )}

      {!loading && learners.length > 0 && activeTab === "monthly" && (
        <>
          <div className="no-print flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={monthValue}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 min-h-[44px]"
            />
            <button
              type="button"
              onClick={() => setFitMode("fit")}
              aria-pressed={fitMode === "fit"}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors min-h-[44px] ${
                fitMode === "fit"
                  ? "bg-primary text-white border-primary"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Fit to Screen
            </button>
            <button
              type="button"
              onClick={() => setFitMode("actual")}
              aria-pressed={fitMode === "actual"}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors min-h-[44px] ${
                fitMode === "actual"
                  ? "bg-primary text-white border-primary"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Actual Size
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
            >
              Print SF2
            </button>
            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={!isDirty || isSaving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {isDirty ? "Unsaved changes" : "Saved"}
            </span>
          </div>

          {unresolvedSexLearners.length > 0 && (
            <p className="no-print text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              {unresolvedSexLearners.length} learner{unresolvedSexLearners.length === 1 ? "" : "s"} excluded from the official register below until their Male/Female information is corrected in SF1.
            </p>
          )}

          <div ref={previewContainerRef} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto bg-gray-50 dark:bg-gray-950 p-3">
            <div className="sf2-fit-wrapper" style={{ zoom: fitScale }}>
              <SF2MonthlyView
                school={{
                  schoolId: currentSchool.schoolId || "",
                  schoolName: currentSchool.schoolName || "",
                  schoolYear: schoolYearFromMonth(monthValue),
                  gradeLevel: adviser?.gradeLevel || "",
                  section: adviser?.section || "",
                  monthLabel: formatMonthLabel(monthValue),
                }}
                maleLearners={maleLearners}
                femaleLearners={femaleLearners}
                weekdays={weekdays}
                records={records}
                remarksData={remarksData}
                editable
                onCellClick={handleMonthlyCellClick}
                onRemarksClick={(learner) => openRemarks(learner)}
                summary={summary}
                summaryInputs={summaryInputs}
                onSummaryInputChange={updateSummaryInput}
                preparedBy={preparedBy}
                certifiedBy={certifiedBy}
              />
            </div>
          </div>
        </>
      )}

      {activeTab === "overview" && (
        <div className="no-print bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Attendance Year Overview{advisoryFilterValue ? ` — ${advisoryFilterValue}` : ""}
          </h2>
          {loadingOverview && <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />}
          {!loadingOverview && yearOverview.months.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No saved attendance found yet for this class this school year.
            </p>
          )}
          {!loadingOverview && yearOverview.months.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-primary/5 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold">
                    <th className="p-2 text-left border-b border-gray-200 dark:border-gray-700 sticky left-0 bg-primary/5 dark:bg-gray-800">Learner</th>
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
                      <td className="p-2 sticky left-0 bg-white dark:bg-gray-900">{l.name}</td>
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
                    <td className="p-2 sticky left-0 bg-gray-50 dark:bg-gray-800/60">Class Average</td>
                    {yearOverview.months.map((m) => (
                      <td key={m} className="p-2 text-center font-mono">
                        {yearOverview.classAverage[m] === null ? "—" : `${yearOverview.classAverage[m].toFixed(1)}%`}
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

      {showLeaveConfirm && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="sf2-leave-title" className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-xl p-5">
            <h2 id="sf2-leave-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
              You have attendance changes that have not been saved.
            </h2>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleStayHere}
                className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
              >
                Stay Here
              </button>
              <button
                type="button"
                onClick={handleLeaveWithoutSaving}
                className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      {remarksTarget && (
        <SF2RemarksDialog
          learner={remarksTarget}
          currentRemark={remarksData[remarksTarget.id]}
          transferredOutHint={remarksTarget.enrollmentStatus === "transferred-out"}
          onSave={handleRemarksSave}
          onCancel={() => setRemarksTarget(null)}
          returnFocusRef={returnFocusRef}
        />
      )}
    </div>
  );
}

export default SF2;
