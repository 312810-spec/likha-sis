// src/ClassRecord.jsx
// Class Record page for LIKHA-SIS -- the Guided Class Record Workspace.
// Subject teachers enter scores across focused tabs (Written Works,
// Performance Tasks, Summative Tests & Term Exam), review computed Results,
// and can open the Official ECR Preview for the familiar combined view.
// Grading math is never duplicated here -- every tab composes the same
// verified utils/gradeComputations.js + utils/transmutationTable.js pipeline
// via computeLearnerGrade below.

import { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useTeacherScope from "./hooks/useTeacherScope";
import useAcademicCalendar from "./hooks/useAcademicCalendar";
import { findClassRecordAssignment } from "./utils/teacherScope";
import { buildClassRecordId } from "./utils/classRecordId";
import { getSubjectWeights } from "./utils/subjectWeights";
import { makeSubjectWeightsResolver } from "./utils/shsSubjectWeights";
import { transmuteGrade, getGradeDescription } from "./utils/transmutationTable";
import {
  computeComponentPS,
  computeWeightedScore,
  computeExamPS,
  computeInitialGrade,
} from "./utils/gradeComputations";
import checkAutoFlagTriggers from "./utils/autoFlagTriggers";
import { Save, RotateCcw, RotateCw, RefreshCw, Info } from "lucide-react";
import PageHeader from "./components/PageHeader.jsx";
import Button from "./components/Button.jsx";
import WrittenWorksPanel from "./components/classRecord/WrittenWorksPanel.jsx";
import PerformanceTasksPanel from "./components/classRecord/PerformanceTasksPanel.jsx";
import ExamPanel from "./components/classRecord/ExamPanel.jsx";
import ResultsPanel from "./components/classRecord/ResultsPanel.jsx";
import ECRPreview from "./components/classRecord/ECRPreview.jsx";

const DEFAULT_WEIGHTS = { ww: 0.2, pt: 0.5, ex: 0.3 };
const MAX_HISTORY = 20;
const AUTOSAVE_DEBOUNCE_MS = 3000;

// A brand-new Class Record starts with 3 Written Works and 3 Performance
// Task columns already in place -- most subjects need more than one anyway,
// and it's still just a starting point (Add/Remove both stay available).
function makeDefaultWWItems() {
  return [
    { id: "ww1", hps: 0 },
    { id: "ww2", hps: 0 },
    { id: "ww3", hps: 0 },
  ];
}
function makeDefaultPTItems() {
  return [
    { id: "pt1", hps: 0 },
    { id: "pt2", hps: 0 },
    { id: "pt3", hps: 0 },
  ];
}

const TABS = [
  { key: "ww", label: "Written Works" },
  { key: "pt", label: "Performance Tasks" },
  { key: "exam", label: "Summative Tests & Term Exam" },
  { key: "results", label: "Results" },
  { key: "ecr", label: "Official ECR Preview" },
];

// Turns a caught Firestore error into an honest, teacher-facing message.
// Permission and offline/network problems are recognized from the actual
// Firebase error code (never assumed), everything else falls back to a
// message naming the specific step that failed -- so "check your
// connection" is only ever shown when the problem is actually the
// connection. The full technical error still goes to console.error at the
// call site for developer debugging.
function describeLoadError(err, { step, gradeLevel, section }) {
  const code = err?.code;
  if (code === "permission-denied") {
    return "You do not have permission to open this Class Record. Please contact the ICT Coordinator.";
  }
  if (code === "unavailable" || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    return "LIKHA-SIS could not reach the school database. Check your connection and try again.";
  }
  if (step === "learners") {
    return `The learner list for ${gradeLevel} — ${section} could not be loaded.`;
  }
  return "The Class Record could not be opened.";
}

export default function ClassRecord({ user, initialSelection }) {
  const { config } = useSchoolConfig();
  const { schoolYears } = useAcademicCalendar();

  // Grade Level, Subject, and Section are fixed by the Sidebar leaf that
  // opened this page -- Class Record no longer offers a picker for any of
  // the three. School Year stays a live control: the same assigned class
  // can have a record from a different school year.
  const [schoolYear, setSchoolYear] = useState("2026-2027");

  const { classRecordCombos, loading: scopeLoading } = useTeacherScope(user, schoolYear);
  const hasAnyAssignment = classRecordCombos.length > 0;

  // Security check: initialSelection comes from the Sidebar leaf click (or,
  // in principle, manipulated client state) and is never trusted on its
  // own. Only a payload matching one of this teacher's own
  // classRecordCombos unlocks the record -- anything else fails closed.
  const matchedAssignment = initialSelection
    ? findClassRecordAssignment(classRecordCombos, initialSelection)
    : null;

  const gradeLevel = matchedAssignment?.gradeLevel || "";
  const subject = matchedAssignment?.subject || "";
  const section = matchedAssignment?.section || "";
  const isTleGrade9or10 = subject === "TLE" && (gradeLevel === "Grade 9" || gradeLevel === "Grade 10");

  const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"];
  const allowedTermOptions = matchedAssignment?.terms
    ? TERM_OPTIONS.filter((_, idx) => matchedAssignment.terms.includes(idx + 1))
    : TERM_OPTIONS;
  const [termChoice, setTerm] = useState("Term 1");
  const term = allowedTermOptions.includes(termChoice) ? termChoice : allowedTermOptions[0] || "Term 1";

  const [activeTab, setActiveTab] = useState("ww");

  // Grid / Data state
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [learners, setLearners] = useState([]);
  const [wwItems, setWwItems] = useState(makeDefaultWWItems());
  const [ptItems, setPtItems] = useState(makeDefaultPTItems());
  const [exHPS, setExHPS] = useState({ st1: 0, st2: 0, te: 0 });
  const [scores, setScores] = useState({});
  const [tleMajor, setTleMajor] = useState("");
  const [pendingFlagCandidates, setPendingFlagCandidates] = useState([]);

  // In-session Undo: a short history of prior {wwItems, ptItems, exHPS,
  // scores} snapshots, capped at MAX_HISTORY. This undoes typing, not a
  // database rollback -- it never reaches back past a completed Save
  // (handleSave doesn't push a history entry; it's the new starting point).
  const [history, setHistory] = useState([]);
  // Redo stays available only for as long as nothing new has been typed
  // since the last Undo -- any real edit (pushHistoryAndMarkDirty) clears
  // this, since "redo" no longer means anything once the timeline branches.
  const [redoStack, setRedoStack] = useState([]);
  // Bumped by every edit; drives the autosave debounce below. Reset to 0 on
  // load and after a manual save so autosave never fires for data that's
  // already exactly what's in the database.
  const [changeVersion, setChangeVersion] = useState(0);
  // changeVersion value as of the last successful persist (auto or manual)
  // -- "Unsaved changes" is simply changeVersion > savedVersion, so no
  // separate state has to be kept in sync with it.
  const [savedVersion, setSavedVersion] = useState(0);
  const [autosavePhase, setAutosavePhase] = useState("idle"); // idle | saving
  const [lastAutosaveAt, setLastAutosaveAt] = useState(null);
  const autosaveTimerRef = useRef(null);

  // DO 017 SHS: Grade 11/12 draw their subject weight profile from the
  // school's configured SHS subjects (core + elective-cluster subjects)
  // instead of the fixed Grade 4-10 SUBJECT_WEIGHTS map.
  const shsSubjectList = [
    ...(config?.shs?.subjects || []),
    ...((config?.shs?.electiveClusters || []).flatMap((cluster) => cluster.subjects || [])),
  ];
  const getSHSAwareWeights = makeSubjectWeightsResolver(shsSubjectList, getSubjectWeights);
  const resolvedWeights = subject ? getSHSAwareWeights(subject) : null;
  const subjectWeights = resolvedWeights || DEFAULT_WEIGHTS;
  const usedFallbackWeights = !!matchedAssignment && !resolvedWeights;

  // Deterministic Firestore Document ID, built by the one canonical helper
  // shared with the Dashboard's Class Record widget (see utils/
  // classRecordId.js) -- one class record per grade+section+subject+term+
  // schoolYear.
  function getDocId() {
    return buildClassRecordId({ gradeLevel, section, subject, term, schoolYear });
  }

  function buildPayload() {
    return {
      teacherId: user?.uid || "unknown_teacher",
      teacherEmail: user?.email || "",
      subject,
      gradeLevel,
      section: section.trim(),
      term,
      schoolYear: schoolYear.trim(),
      wwItems,
      ptItems,
      exHPS,
      scores,
      tleMajor,
      updatedAt: serverTimestamp(),
    };
  }

  // Snapshots pre-edit state onto the Undo stack and marks the record dirty
  // (which arms the autosave timer). Must be called BEFORE the state setter
  // in every mutating handler, using this render's own closure values.
  function pushHistoryAndMarkDirty() {
    setHistory((prev) => {
      const next = [...prev, { wwItems, ptItems, exHPS, scores }];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    // A real edit invalidates any pending Redo -- the timeline has branched.
    setRedoStack([]);
    setChangeVersion((v) => v + 1);
  }

  function handleUndo() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setRedoStack((prev) => [...prev, { wwItems, ptItems, exHPS, scores }]);
    setWwItems(last.wwItems);
    setPtItems(last.ptItems);
    setExHPS(last.exHPS);
    setScores(last.scores);
    setHistory((prev) => prev.slice(0, -1));
    setChangeVersion((v) => v + 1);
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, { wwItems, ptItems, exHPS, scores }]);
    setWwItems(next.wwItems);
    setPtItems(next.ptItems);
    setExHPS(next.exHPS);
    setScores(next.scores);
    setRedoStack((prev) => prev.slice(0, -1));
    setChangeVersion((v) => v + 1);
  }

  // Loads the assigned class record + its roster. Re-runs whenever the
  // Sidebar leaf changes (a different initialSelection) or the live Term /
  // School Year controls change, replacing the page in place -- no full
  // reload, and no manual "Load" step.
  useEffect(() => {
    let cancelled = false;

    async function loadClassRecord() {
      // Defense in depth: re-verified on every load in case client state
      // was manipulated -- never load outside this teacher's own combos.
      if (!matchedAssignment || !schoolYear.trim()) {
        setIsLoaded(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setStatusMessage("");

      // Step 1: learners for this exact grade+section -- never the whole
      // school. Its own try/catch so a roster failure is never reported as
      // "the Class Record could not be opened" (a different step).
      let scopedLearners;
      try {
        const learnersSnap = await getDocs(
          query(
            collection(db, "learners"),
            where("gradeLevel", "==", gradeLevel),
            where("section", "==", section)
          )
        );
        scopedLearners = learnersSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        scopedLearners.sort((a, b) => {
          const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
          if (last !== 0) return last;
          return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
        });
      } catch (err) {
        console.error("Error loading learner roster:", err);
        if (!cancelled) {
          setErrorMessage(describeLoadError(err, { step: "learners", gradeLevel, section }));
          setIsLoading(false);
        }
        return;
      }
      if (cancelled) return;
      setLearners(scopedLearners);

      // Step 2: fetch the classRecord document using the canonical ID.
      try {
        const docId = buildClassRecordId({ gradeLevel, section, subject, term, schoolYear });
        const recordRef = doc(db, "classRecords", docId);
        const recordSnap = await getDoc(recordRef);
        if (cancelled) return;

        if (recordSnap.exists()) {
          const data = recordSnap.data();
          setWwItems(
            Array.isArray(data.wwItems) && data.wwItems.length > 0
              ? data.wwItems
              : makeDefaultWWItems()
          );
          setPtItems(
            Array.isArray(data.ptItems) && data.ptItems.length > 0
              ? data.ptItems
              : makeDefaultPTItems()
          );
          setExHPS(data.exHPS || { st1: 0, st2: 0, te: 0 });
          setScores(data.scores || {});
          setTleMajor(data.tleMajor || "");
        } else {
          // Initialize with default template
          setWwItems(makeDefaultWWItems());
          setPtItems(makeDefaultPTItems());
          setExHPS({ st1: 0, st2: 0, te: 0 });
          setScores({});
          setTleMajor("");
        }

        // A freshly-loaded record has no unsaved edits and no undo/redo
        // history of its own yet.
        setHistory([]);
        setRedoStack([]);
        setChangeVersion(0);
        setSavedVersion(0);
        setAutosavePhase("idle");
        setLastAutosaveAt(null);
        setIsLoaded(true);
      } catch (err) {
        console.error("Error loading class record:", err);
        if (!cancelled) {
          setErrorMessage(describeLoadError(err, { step: "record", gradeLevel, section }));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadClassRecord();
    return () => {
      cancelled = true;
    };
  }, [initialSelection, matchedAssignment, gradeLevel, subject, section, term, schoolYear]);

  // Quiet background autosave, debounced AUTOSAVE_DEBOUNCE_MS after the
  // last edit (changeVersion only increments on an actual teacher edit --
  // see pushHistoryAndMarkDirty). Persists raw scores only; never runs the
  // LARDO risk check (that stays tied to a deliberate Save Class Record
  // press, per the "don't generate LARDO candidates from every keystroke"
  // rule) and never shows the loud "Class record saved!" banner.
  useEffect(() => {
    if (changeVersion === 0 || !matchedAssignment) return undefined;
    const versionAtSchedule = changeVersion;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosavePhase("saving");
      try {
        const docId = getDocId();
        await setDoc(doc(db, "classRecords", docId), buildPayload(), { merge: true });
        setSavedVersion(versionAtSchedule);
        setLastAutosaveAt(new Date());
      } catch (err) {
        console.error("Autosave failed:", err);
      } finally {
        setAutosavePhase("idle");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(autosaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeVersion]);

  // Save current record to Firestore (the full, deliberate save -- the only
  // one that evaluates the LARDO auto-flag trigger).
  async function handleSave() {
    // Defense in depth: re-verified here too, in case client state was
    // manipulated -- never save outside this teacher's own classRecordCombos.
    if (!matchedAssignment) {
      setErrorMessage("You are not assigned to this class record.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const docId = getDocId();
      const recordRef = doc(db, "classRecords", docId);
      await setDoc(recordRef, buildPayload(), { merge: true });

      setStatusMessage("Class record saved successfully!");
      setTimeout(() => setStatusMessage(""), 4000);
      setChangeVersion(0);
      setSavedVersion(0);
      setLastAutosaveAt(null);

      // DO 15 s.2026 closed-loop check: Initial Grade below the 70
      // intervention threshold suggests a LARDO risk flag.
      await Promise.all(
        learners.map(async (learner) => {
          const { initialGrade } = computeLearnerGrade(learner);
          const trigger = checkAutoFlagTriggers({ initialGrade });
          if (!trigger) return;

          const lardoDocId = `${learner.id}_${schoolYear.trim()}`;
          try {
            const existing = await getDoc(doc(db, "lardoRecords", lardoDocId));
            const existsMonitoring = existing.exists() && existing.data()?.status === "monitoring";
            if (existsMonitoring) return;

            setPendingFlagCandidates((prev) => {
              if (prev.find((p) => p.docId === lardoDocId)) return prev;
              const nameDisplay = `${learner.lastName || ""}, ${learner.firstName || ""}`.trim();
              return [...prev, { docId: lardoDocId, learner, learnerId: learner.id, learnerName: nameDisplay, trigger }];
            });
          } catch (err) {
            console.error("Auto-flag check failed for learner:", learner.id, err);
          }
        })
      );
    } catch (err) {
      console.error("Failed to save class record:", err);
      setErrorMessage("Failed to save class record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // --- Assessment (WW/PT) management: add, remove (with confirmation when
  // the assessment already has scores), HPS edits. ---

  function addWWItem() {
    pushHistoryAndMarkDirty();
    setWwItems((prev) => [...prev, { id: `ww_${Date.now()}`, hps: 0 }]);
  }

  function removeWWItem(itemId) {
    if (wwItems.length <= 1) {
      setErrorMessage("At least one Written Work column is required.");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
    const idx = wwItems.findIndex((item) => item.id === itemId);
    const scoredCount = learners.filter((l) => {
      const v = scores[l.id]?.ww?.[itemId];
      return typeof v === "number" && !Number.isNaN(v);
    }).length;
    if (scoredCount > 0) {
      const confirmed = window.confirm(
        `WW${idx + 1} already contains scores for ${scoredCount} learner${scoredCount === 1 ? "" : "s"}. Remove this assessment and its scores?`
      );
      if (!confirmed) return;
    }
    pushHistoryAndMarkDirty();
    setWwItems((prev) => prev.filter((item) => item.id !== itemId));
    setScores((prev) => {
      const updated = { ...prev };
      for (const lId in updated) {
        if (updated[lId]?.ww) {
          const newWW = { ...updated[lId].ww };
          delete newWW[itemId];
          updated[lId] = { ...updated[lId], ww: newWW };
        }
      }
      return updated;
    });
  }

  function updateWWHPS(idx, val) {
    pushHistoryAndMarkDirty();
    const num = val === "" ? 0 : Number(val);
    setWwItems((prev) => prev.map((item, i) => (i === idx ? { ...item, hps: Number.isNaN(num) ? 0 : num } : item)));
  }

  function addPTItem() {
    pushHistoryAndMarkDirty();
    setPtItems((prev) => [...prev, { id: `pt_${Date.now()}`, hps: 0 }]);
  }

  function removePTItem(itemId) {
    if (ptItems.length <= 1) {
      setErrorMessage("At least one Performance Task column is required.");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
    const idx = ptItems.findIndex((item) => item.id === itemId);
    const scoredCount = learners.filter((l) => {
      const v = scores[l.id]?.pt?.[itemId];
      return typeof v === "number" && !Number.isNaN(v);
    }).length;
    if (scoredCount > 0) {
      const confirmed = window.confirm(
        `PT${idx + 1} already contains scores for ${scoredCount} learner${scoredCount === 1 ? "" : "s"}. Remove this assessment and its scores?`
      );
      if (!confirmed) return;
    }
    pushHistoryAndMarkDirty();
    setPtItems((prev) => prev.filter((item) => item.id !== itemId));
    setScores((prev) => {
      const updated = { ...prev };
      for (const lId in updated) {
        if (updated[lId]?.pt) {
          const newPT = { ...updated[lId].pt };
          delete newPT[itemId];
          updated[lId] = { ...updated[lId], pt: newPT };
        }
      }
      return updated;
    });
  }

  function updatePTHPS(idx, val) {
    pushHistoryAndMarkDirty();
    const num = val === "" ? 0 : Number(val);
    setPtItems((prev) => prev.map((item, i) => (i === idx ? { ...item, hps: Number.isNaN(num) ? 0 : num } : item)));
  }

  function updateExHPS(field, val) {
    pushHistoryAndMarkDirty();
    const num = val === "" ? 0 : Number(val);
    setExHPS((prev) => ({ ...prev, [field]: Number.isNaN(num) ? 0 : num }));
  }

  // --- Learner score handlers. Each rejects (rather than silently clamps)
  // a score above that item's HPS, per the Score Input Safety requirement. ---

  function showScoreTooHighError(hps) {
    setErrorMessage(`Score cannot be higher than the Highest Possible Score of ${hps}.`);
    setTimeout(() => setErrorMessage(""), 4000);
  }

  function updateLearnerWWScore(learnerId, itemId, val) {
    if (val !== "") {
      const num = Number(val);
      if (Number.isNaN(num)) return;
      const hps = Number(wwItems.find((i) => i.id === itemId)?.hps) || 0;
      if (hps > 0 && num > hps) {
        showScoreTooHighError(hps);
        return;
      }
    }
    pushHistoryAndMarkDirty();
    const num = val === "" ? "" : Number(val);
    setScores((prev) => ({
      ...prev,
      [learnerId]: { ...prev[learnerId], ww: { ...prev[learnerId]?.ww, [itemId]: num } },
    }));
  }

  function updateLearnerPTScore(learnerId, itemId, val) {
    if (val !== "") {
      const num = Number(val);
      if (Number.isNaN(num)) return;
      const hps = Number(ptItems.find((i) => i.id === itemId)?.hps) || 0;
      if (hps > 0 && num > hps) {
        showScoreTooHighError(hps);
        return;
      }
    }
    pushHistoryAndMarkDirty();
    const num = val === "" ? "" : Number(val);
    setScores((prev) => ({
      ...prev,
      [learnerId]: { ...prev[learnerId], pt: { ...prev[learnerId]?.pt, [itemId]: num } },
    }));
  }

  function updateLearnerExamScore(learnerId, field, val) {
    if (val !== "") {
      const num = Number(val);
      if (Number.isNaN(num)) return;
      const hps = Number(exHPS[field]) || 0;
      if (hps > 0 && num > hps) {
        showScoreTooHighError(hps);
        return;
      }
    }
    pushHistoryAndMarkDirty();
    const num = val === "" ? "" : Number(val);
    setScores((prev) => ({
      ...prev,
      [learnerId]: { ...prev[learnerId], [field]: num },
    }));
  }

  // Shared by every tab and the post-save auto-flag check, so the Initial
  // Grade used everywhere never drifts apart.
  function computeLearnerGrade(learner) {
    const learnerScore = scores[learner.id] || {};

    const wwRaw = wwItems.map((item) => {
      const val = learnerScore.ww?.[item.id];
      return typeof val === "number" && !Number.isNaN(val) ? val : 0;
    });
    const wwHPSArr = wwItems.map((item) => Number(item.hps) || 0);
    const wwPS = computeComponentPS(wwRaw, wwHPSArr);
    const wwWS = computeWeightedScore(wwPS, subjectWeights.ww);

    const ptRaw = ptItems.map((item) => {
      const val = learnerScore.pt?.[item.id];
      return typeof val === "number" && !Number.isNaN(val) ? val : 0;
    });
    const ptHPSArr = ptItems.map((item) => Number(item.hps) || 0);
    const ptPS = computeComponentPS(ptRaw, ptHPSArr);
    const ptWS = computeWeightedScore(ptPS, subjectWeights.pt);

    const st1Raw = typeof learnerScore.st1 === "number" && !Number.isNaN(learnerScore.st1) ? learnerScore.st1 : 0;
    const st2Raw = typeof learnerScore.st2 === "number" && !Number.isNaN(learnerScore.st2) ? learnerScore.st2 : 0;
    const teRaw = typeof learnerScore.te === "number" && !Number.isNaN(learnerScore.te) ? learnerScore.te : 0;

    const st1HPS = Number(exHPS.st1) || 0;
    const st2HPS = Number(exHPS.st2) || 0;
    const teHPS = Number(exHPS.te) || 0;

    const exPS = computeExamPS(st1Raw, st1HPS, st2Raw, st2HPS, teRaw, teHPS);
    // A weight of exactly 0 (Tech-Pro subjects, DO 15's 20/80/0 profile)
    // means there is legitimately no exam component -- short-circuit rather
    // than letting the all-zero exHPS null out the whole grade.
    const exWS = subjectWeights.ex === 0 ? 0 : computeWeightedScore(exPS, subjectWeights.ex);

    const initialGrade = computeInitialGrade(wwWS, ptWS, exWS);
    const termGrade = transmuteGrade(initialGrade);
    const description = getGradeDescription(termGrade);

    return { wwPS, wwWS, ptPS, ptWS, exPS, exWS, initialGrade, termGrade, description };
  }

  function getWWScore(learnerId, itemId) {
    return scores[learnerId]?.ww?.[itemId] ?? "";
  }
  function getPTScore(learnerId, itemId) {
    return scores[learnerId]?.pt?.[itemId] ?? "";
  }
  function getExamScore(learnerId, field) {
    return scores[learnerId]?.[field] ?? "";
  }

  const autosaveLabel = (() => {
    if (autosavePhase === "saving") return "Saving…";
    if (changeVersion > savedVersion) return "Unsaved changes";
    if (lastAutosaveAt) return `Saved automatically at ${lastAutosaveAt.toLocaleTimeString()}`;
    return "";
  })();

  return (
    <div className="space-y-6 max-w-none w-full">
      <PageHeader
        description="Enter scores and review DepEd grades, organized by Written Works, Performance Tasks, Summative Tests & Term Exam, and Results."
        actions={
          isLoaded && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleUndo} disabled={history.length === 0}>
                <RotateCcw size={16} />
                Undo
              </Button>
              <Button variant="secondary" onClick={handleRedo} disabled={redoStack.length === 0}>
                <RotateCw size={16} />
                Redo
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save size={18} />
                {isSaving ? "Saving..." : "Save Class Record"}
              </Button>
            </div>
          )
        }
      />

      {statusMessage && (
        <div className="animate-fade-in p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm font-medium">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="animate-fade-in p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-sm font-medium">
          {errorMessage}
        </div>
      )}
      {usedFallbackWeights && (
        <div className="animate-fade-in p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-sm font-medium">
          This subject's DepEd weight profile could not be determined automatically. Using the default
          Core weighting (20% / 50% / 30%). Contact your ICT Coordinator if this looks wrong.
        </div>
      )}

      {pendingFlagCandidates.map((c) => (
        <div
          key={c.docId}
          className="animate-fade-in bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg text-sm flex items-center gap-4"
        >
          <Info className="w-4 h-4 shrink-0 text-yellow-700" />
          <div className="flex-1">
            <div className="font-medium">This learner's Initial Grade suggests a LARDO risk flag.</div>
            <div className="text-xs mt-0.5">Flag {c.learnerName || "this learner"} for monitoring?</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              onClick={async () => {
                try {
                  const nowIso = new Date().toISOString();
                  const newRecordData = {
                    learnerId: c.learnerId,
                    learnerLRN: c.learner.lrn || c.learner.learnerLRN || "",
                    learnerName: c.learnerName || "Unknown Learner",
                    gradeLevel,
                    section: section.trim(),
                    schoolYear: schoolYear.trim(),
                    riskFactors: c.trigger.riskFactors,
                    status: "monitoring",
                    interventions: [{ date: nowIso, note: c.trigger.suggestedNote }],
                    flaggedDate: nowIso,
                    flaggedByEmail: user?.email || "",
                    updatedAt: serverTimestamp(),
                  };
                  await setDoc(doc(db, "lardoRecords", c.docId), newRecordData, { merge: true });
                  setPendingFlagCandidates((prev) => prev.filter((p) => p.docId !== c.docId));
                } catch (err) {
                  console.error("Failed to create LARDO record:", err);
                  setErrorMessage("Failed to create LARDO record. Please try again.");
                }
              }}
            >
              Confirm
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

      {scopeLoading ? (
        <div className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-6 text-sm text-gray-500 dark:text-gray-400">
          Loading your class assignments…
        </div>
      ) : !hasAnyAssignment ? (
        <div className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">No class records assigned.</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You haven't been assigned as a subject teacher for any class. Ask your ICT Coordinator to
            set this up in User Management. An advisory assignment alone does not grant Class Record
            access.
          </p>
        </div>
      ) : !initialSelection ? (
        <div className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Select a Class Record</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Open the Class Record menu in the sidebar and pick a Grade Level, then a Subject, then a
            Section.
          </p>
        </div>
      ) : !matchedAssignment ? (
        <div className="max-w-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl shadow-card p-6">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
            You are not assigned to this class record.
          </p>
        </div>
      ) : !isLoaded ? (
        <div className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-6 space-y-2 animate-pulse">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top context strip */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-sm shadow-card">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase block font-semibold">Class Record</span>
                <span className="font-bold text-base text-gray-800 dark:text-gray-100">
                  {gradeLevel} <span className="text-gray-400 dark:text-gray-500 font-normal">›</span> {subject}{" "}
                  <span className="text-gray-400 dark:text-gray-500 font-normal">›</span> {section}
                </span>
              </div>
              <div>
                <label htmlFor="crTerm" className="text-gray-500 dark:text-gray-400 text-xs uppercase block font-semibold mb-1">
                  Term
                </label>
                <select
                  id="crTerm"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                >
                  {allowedTermOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="crSchoolYear" className="text-gray-500 dark:text-gray-400 text-xs uppercase block font-semibold mb-1">
                  School Year
                </label>
                <select
                  id="crSchoolYear"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                >
                  {schoolYears.map((sy) => (
                    <option key={sy} value={sy}>{sy}</option>
                  ))}
                </select>
              </div>
              {isTleGrade9or10 && (
                <div>
                  <label htmlFor="crTleMajor" className="text-gray-500 dark:text-gray-400 text-xs uppercase block font-semibold mb-1">
                    TLE Major (this term)
                  </label>
                  <select
                    id="crTleMajor"
                    value={tleMajor}
                    onChange={(e) => {
                      pushHistoryAndMarkDirty();
                      setTleMajor(e.target.value);
                    }}
                    className="px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                  >
                    <option value="">Not set</option>
                    {(config?.tleMajors || []).map((major) => (
                      <option key={major} value={major}>{major}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase block font-semibold">Weights</span>
                <span className="text-gray-700 dark:text-gray-300">
                  Written Works {(subjectWeights.ww * 100).toFixed(0)}% · Performance Tasks{" "}
                  {(subjectWeights.pt * 100).toFixed(0)}% · Summative Tests &amp; Term Exam{" "}
                  {(subjectWeights.ex * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 text-xs">
              {isLoading && (
                <span className="inline-flex items-center gap-1.5 text-primary dark:text-primary-light">
                  <RefreshCw size={12} className="animate-spin" /> Reloading…
                </span>
              )}
              {autosaveLabel && <span>{autosaveLabel}</span>}
              Learners: <span className="font-bold text-gray-800 dark:text-gray-100">{learners.length}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-700" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary dark:text-primary-light"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "ww" && (
            <WrittenWorksPanel
              weightPercent={(subjectWeights.ww * 100).toFixed(0)}
              learners={learners}
              wwItems={wwItems}
              onAddItem={addWWItem}
              onHPSChange={updateWWHPS}
              onRemoveItem={removeWWItem}
              getScore={getWWScore}
              onScoreChange={updateLearnerWWScore}
            />
          )}
          {activeTab === "pt" && (
            <PerformanceTasksPanel
              weightPercent={(subjectWeights.pt * 100).toFixed(0)}
              learners={learners}
              ptItems={ptItems}
              onAddItem={addPTItem}
              onHPSChange={updatePTHPS}
              onRemoveItem={removePTItem}
              getScore={getPTScore}
              onScoreChange={updateLearnerPTScore}
            />
          )}
          {activeTab === "exam" && (
            <ExamPanel
              weightPercent={Number((subjectWeights.ex * 100).toFixed(0))}
              learners={learners}
              exHPS={exHPS}
              onHPSChange={updateExHPS}
              getScore={getExamScore}
              onScoreChange={updateLearnerExamScore}
            />
          )}
          {activeTab === "results" && (
            <ResultsPanel learners={learners} computeLearnerGrade={computeLearnerGrade} term={term} />
          )}
          {activeTab === "ecr" && (
            <ECRPreview
              learners={learners}
              wwItems={wwItems}
              ptItems={ptItems}
              scores={scores}
              subjectWeights={subjectWeights}
              computeLearnerGrade={computeLearnerGrade}
            />
          )}
        </div>
      )}
    </div>
  );
}
