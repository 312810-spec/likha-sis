// src/ClassRecord.jsx
// Class Record page for LIKHA-SIS.
// Subject teachers enter scores and view live computed grades (PS, WS, Initial Grade, Term Grade, Description).

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import Tooltip from "./components/Tooltip.jsx";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useTeacherScope from "./hooks/useTeacherScope";
import { SUBJECT_WEIGHTS, getSubjectWeights } from "./utils/subjectWeights";
import { makeSubjectWeightsResolver } from "./utils/shsSubjectWeights";
import { transmuteGrade, getGradeDescription } from "./utils/transmutationTable";
import {
  computeComponentPS,
  computeWeightedScore,
  computeExamPS,
  computeInitialGrade,
} from "./utils/gradeComputations";
import checkAutoFlagTriggers from "./utils/autoFlagTriggers";
import { Plus, X, Save, RefreshCw, Info } from "lucide-react";
import PageHeader from "./components/PageHeader.jsx";
import Button from "./components/Button.jsx";

export default function ClassRecord({ user, initialSelection }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];

  // Setup Panel state
  const [gradeLevelChoice, setGradeLevel] = useState(gradeOptions[0] || "Grade 4");
  // useSchoolConfig() resolves asynchronously, so gradeLevelChoice above is
  // seeded from the fallback grade list before the real (possibly narrower)
  // gradeLevelsOffered loads. Deriving the effective value at render time
  // (rather than syncing it back via an effect) keeps it always valid --
  // otherwise the section list would silently query a grade with none until
  // the user manually touched the dropdown.
  const gradeLevel = gradeOptions.includes(gradeLevelChoice)
    ? gradeLevelChoice
    : gradeOptions[0] || "Grade 4";
  const [section, setSection] = useState("");
  const [subjectChoice, setSubject] = useState(Object.keys(SUBJECT_WEIGHTS)[0] || "FILIPINO");
  const [term, setTerm] = useState("Term 1");
  const [schoolYear, setSchoolYear] = useState("2026-2027");

  // Canonical adviser + subject-teacher scope. Class Record does NOT fall
  // back to an unrestricted grade/section picker: an adviser is hard-locked
  // to their advisory section, and a subject teacher only ever sees the
  // subject/grade/section combinations from their own users/{uid}.assignments.
  const teacherScope = useTeacherScope(user, schoolYear);
  const { advisorySection, adviser, subjectMap, loading: scopeLoading } = teacherScope;

  // Every grade level+section this teacher may open Class Record for, plus
  // (for subject-teacher combos) which subject(s) it's restricted to. `null`
  // subject means "adviser's own class, any subject" -- advisers commonly
  // teach every subject to their own section.
  // `terms` (null | number[]) carries SHS term coverage through -- absent
  // for adviser combos and non-SHS subject-teacher assignments, which cover
  // every term.
  const allowedCombos = [
    ...(adviser ? [{ gradeLevel: adviser.gradeLevel, section: adviser.section, subject: null, terms: null }] : []),
    ...Array.from(subjectMap.entries()).flatMap(([subj, classes]) =>
      classes.map((c) => ({ gradeLevel: c.gradeLevel, section: c.section, subject: subj, terms: c.terms }))
    ),
  ];
  const hasAnyAssignment = allowedCombos.length > 0;

  const scopedGradeLevels = [...new Set(allowedCombos.map((c) => c.gradeLevel))];
  const scopedSectionsForGrade = (gl) =>
    [...new Set(allowedCombos.filter((c) => c.gradeLevel === gl).map((c) => c.section))];
  // `termNum` (1/2/3), when given, restricts to combos actually covering
  // that term -- an SHS assignment scoped to Terms 1-2 stops appearing once
  // Term 3 is selected, unless another assignment covers Term 3.
  const scopedSubjectsForClass = (gl, sec, termNum) =>
    allowedCombos.filter(
      (c) =>
        c.gradeLevel === gl &&
        c.section === sec &&
        (termNum === undefined || !c.terms || c.terms.includes(termNum))
    );

  // Seed grade/section from scope the first time it resolves, then let the
  // teacher move between their OWN allowed combos (never outside them).
  useEffect(() => {
    if (scopeLoading || !hasAnyAssignment || section) return;
    const first = allowedCombos[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGradeLevel(first.gradeLevel);
    setSection(first.section);
    if (first.subject) setSubject(first.subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeLoading, hasAnyAssignment, section]);

  // Grid / Data state
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Sidebar "Class Record > <subject>" click: only applied when it matches
  // one of this teacher's OWN allowed combos (never lets initialSelection
  // itself grant access to something outside the resolved scope). Re-runs
  // on every new initialSelection so switching subjects from the sidebar
  // while already viewing a class record works, and drops back to the
  // setup panel (pre-filled) rather than showing the previous class's grid.
  useEffect(() => {
    if (scopeLoading || !initialSelection) return;
    const match = allowedCombos.find(
      (c) =>
        c.gradeLevel === initialSelection.gradeLevel &&
        c.section === initialSelection.section &&
        (!initialSelection.subject || c.subject === null || c.subject === initialSelection.subject)
    );
    if (!match) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGradeLevel(match.gradeLevel);
    setSection(match.section);
    if (initialSelection.subject) setSubject(initialSelection.subject);
    setIsLoaded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelection, scopeLoading]);

  const [learners, setLearners] = useState([]);
  const [wwItems, setWwItems] = useState([{ id: "ww1", hps: 0 }]);
  const [ptItems, setPtItems] = useState([{ id: "pt1", hps: 0 }]);
  const [exHPS, setExHPS] = useState({ st1: 0, st2: 0, te: 0 });
  const [scores, setScores] = useState({});
  const [pendingFlagCandidates, setPendingFlagCandidates] = useState([]);

  // DO 017 SHS: Grade 11/12 draw their subject list from the school's
  // configured SHS subjects (core + elective-cluster subjects) instead of
  // the fixed Grade 4-10 SUBJECT_WEIGHTS map, since those subject names
  // aren't known ahead of time.
  const isSHS = gradeLevel === "Grade 11" || gradeLevel === "Grade 12";
  const shsSubjectList = [
    ...(config?.shs?.subjects || []),
    ...((config?.shs?.electiveClusters || []).flatMap((cluster) => cluster.subjects || [])),
  ];
  const getSHSAwareWeights = makeSubjectWeightsResolver(shsSubjectList, getSubjectWeights);

  // Subject options from SUBJECT_WEIGHTS (Grade 4-10) or the school's
  // configured SHS subjects (Grade 11-12).
  const SUBJECT_OPTIONS = isSHS
    ? shsSubjectList.map((s) => s.name).filter(Boolean)
    : Object.keys(SUBJECT_WEIGHTS);
  // Same desync risk as gradeLevel above: subjectChoice may have been seeded
  // before config (and therefore isSHS/shsSubjectList) resolved, or the user
  // may have picked a grade level whose SUBJECT_OPTIONS no longer contains
  // the previously chosen subject. Derive the effective value at render time.
  // Term options
  const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"];
  // SHS subjects are term-based (§4-9 of the term-versioning update): an
  // assignment scoped to only some terms must drop out of Class Record once
  // an unrelated term is selected. Non-SHS combos carry `terms: null` and
  // are unaffected.
  const termNum = TERM_OPTIONS.indexOf(term) + 1 || undefined;

  // Narrow SUBJECT_OPTIONS to what this teacher is actually scoped for at
  // the currently-selected grade/section/term: adviser combos (subject:
  // null) keep the full list (advisers commonly teach every subject to
  // their own class); subject-teacher combos restrict to only their
  // assigned subjects that cover the active term.
  const combosForCurrentClass = scopedSubjectsForClass(gradeLevel, section, isSHS ? termNum : undefined);
  const isAdviserForCurrentClass = combosForCurrentClass.some((c) => c.subject === null);
  const SCOPED_SUBJECT_OPTIONS =
    !hasAnyAssignment || isAdviserForCurrentClass
      ? SUBJECT_OPTIONS
      : SUBJECT_OPTIONS.filter((s) =>
          combosForCurrentClass.some((c) => c.subject === s)
        );
  const subject = SCOPED_SUBJECT_OPTIONS.includes(subjectChoice)
    ? subjectChoice
    : SCOPED_SUBJECT_OPTIONS[0] || "";

  // Helper to construct deterministic Firestore Document ID
  // One class record per grade+section+subject+term+schoolYear -- the doc
  // belongs to the CLASS, not to whichever teacher currently teaches it.
  // `teacherId` is stored in the payload as last-editor metadata only (see
  // handleSave), never as part of the document's identity, so a mid-year
  // teacher reassignment doesn't orphan the existing scores. Firestore
  // access is authorized by matching this exact grade/section/subject
  // against the caller's own users/{uid}.assignmentKeys (see firestore.rules
  // and utils/assignmentKeys.js) -- not by who originally saved it.
  function getDocId() {
    const raw = `${gradeLevel}_${section.trim()}_${subject}_${term}_${schoolYear.trim()}`;
    return raw.toLowerCase().replace(/\s+/g, "-");
  }

  // Load class record and matching learners
  async function handleLoadClassRecord(e) {
    if (e) e.preventDefault();
    if (!section.trim()) {
      setErrorMessage("Please enter a section name.");
      return;
    }
    // Defense in depth: the pickers above already restrict grade/section/
    // subject to this teacher's own assignments, but re-check here too in
    // case client state was manipulated -- never load outside the scope.
    if (hasAnyAssignment && scopedSubjectsForClass(gradeLevel, section).length === 0) {
      setErrorMessage("You are not assigned to this class.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      // 1. Query learners collection for matching gradeLevel and section
      const learnersSnap = await getDocs(collection(db, "learners"));
      const allLearners = learnersSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const filteredLearners = allLearners.filter(
        (l) =>
          (l.gradeLevel || "").trim().toLowerCase() === gradeLevel.trim().toLowerCase() &&
          (l.section || "").trim().toLowerCase() === section.trim().toLowerCase()
      );

      // Sort alphabetically by lastName, then firstName
      filteredLearners.sort((a, b) => {
        const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
        if (last !== 0) return last;
        return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
      });

      setLearners(filteredLearners);

      // 2. Fetch classRecord document using deterministic ID
      const docId = getDocId();
      const recordRef = doc(db, "classRecords", docId);
      const recordSnap = await getDoc(recordRef);

      if (recordSnap.exists()) {
        const data = recordSnap.data();
        setWwItems(
          Array.isArray(data.wwItems) && data.wwItems.length > 0
            ? data.wwItems
            : [{ id: "ww1", hps: 0 }]
        );
        setPtItems(
          Array.isArray(data.ptItems) && data.ptItems.length > 0
            ? data.ptItems
            : [{ id: "pt1", hps: 0 }]
        );
        setExHPS(data.exHPS || { st1: 0, st2: 0, te: 0 });
        setScores(data.scores || {});
      } else {
        // Initialize with default template
        setWwItems([{ id: "ww1", hps: 0 }]);
        setPtItems([{ id: "pt1", hps: 0 }]);
        setExHPS({ st1: 0, st2: 0, te: 0 });
        setScores({});
      }

      setIsLoaded(true);
    } catch (err) {
      console.error("Error loading class record:", err);
      setErrorMessage("Failed to load class record. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Save current record to Firestore
  async function handleSave() {
    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const docId = getDocId();
      // Last-editor metadata only -- NOT part of the doc's identity (see
      // getDocId) and not what authorizes the write; firestore.rules
      // checks the caller's own assignmentKeys against subject/gradeLevel/
      // section instead, so a different teacher later assigned to this
      // exact class can open and save the same record.
      const teacherId = user?.uid || "unknown_teacher";
      const teacherEmail = user?.email || "";

      const payload = {
        teacherId,
        teacherEmail,
        subject,
        gradeLevel,
        section: section.trim(),
        term,
        schoolYear: schoolYear.trim(),
        wwItems,
        ptItems,
        exHPS,
        scores,
        updatedAt: serverTimestamp(),
      };

      const recordRef = doc(db, "classRecords", docId);
      await setDoc(recordRef, payload, { merge: true });

      setStatusMessage("Class record saved successfully!");
      setTimeout(() => setStatusMessage(""), 4000);

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

  // --- Item Column Handlers ---

  function addWWItem() {
    const newId = `ww_${Date.now()}`;
    setWwItems([...wwItems, { id: newId, hps: 0 }]);
  }

  function removeWWItem(itemId) {
    if (wwItems.length <= 1) {
      setErrorMessage("At least one Written Work column is required.");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
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
    const updated = [...wwItems];
    const num = val === "" ? 0 : Number(val);
    updated[idx] = { ...updated[idx], hps: isNaN(num) ? 0 : num };
    setWwItems(updated);
  }

  function addPTItem() {
    const newId = `pt_${Date.now()}`;
    setPtItems([...ptItems, { id: newId, hps: 0 }]);
  }

  function removePTItem(itemId) {
    if (ptItems.length <= 1) {
      setErrorMessage("At least one Performance Task column is required.");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
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
    const updated = [...ptItems];
    const num = val === "" ? 0 : Number(val);
    updated[idx] = { ...updated[idx], hps: isNaN(num) ? 0 : num };
    setPtItems(updated);
  }

  function updateExHPS(field, val) {
    const num = val === "" ? 0 : Number(val);
    setExHPS((prev) => ({
      ...prev,
      [field]: isNaN(num) ? 0 : num,
    }));
  }

  // --- Learner Score Handlers ---

  function updateLearnerWWScore(learnerId, itemId, val) {
    const num = val === "" ? "" : Number(val);
    setScores((prev) => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        ww: {
          ...prev[learnerId]?.ww,
          [itemId]: isNaN(num) ? "" : num,
        },
      },
    }));
  }

  function updateLearnerPTScore(learnerId, itemId, val) {
    const num = val === "" ? "" : Number(val);
    setScores((prev) => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        pt: {
          ...prev[learnerId]?.pt,
          [itemId]: isNaN(num) ? "" : num,
        },
      },
    }));
  }

  function updateLearnerExamScore(learnerId, field, val) {
    const num = val === "" ? "" : Number(val);
    setScores((prev) => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        [field]: isNaN(num) ? "" : num,
      },
    }));
  }

  // Helper to format computed values cleanly
  function formatComputed(val, decimals = 2) {
    if (val === null || val === undefined || typeof val !== "number" || isNaN(val)) {
      return "—";
    }
    return val.toFixed(decimals);
  }

  const subjectWeights = getSHSAwareWeights(subject) || { ww: 0.2, pt: 0.5, ex: 0.3 };

  // Shared by the live grid render and the post-save auto-flag check, so the
  // Initial Grade used for both never drifts apart.
  function computeLearnerGrade(learner) {
    const learnerScore = scores[learner.id] || {};

    const wwRaw = wwItems.map((item) => {
      const val = learnerScore.ww?.[item.id];
      return typeof val === "number" && !isNaN(val) ? val : 0;
    });
    const wwHPSArr = wwItems.map((item) => Number(item.hps) || 0);
    const wwPS = computeComponentPS(wwRaw, wwHPSArr);
    const wwWS = computeWeightedScore(wwPS, subjectWeights.ww);

    const ptRaw = ptItems.map((item) => {
      const val = learnerScore.pt?.[item.id];
      return typeof val === "number" && !isNaN(val) ? val : 0;
    });
    const ptHPSArr = ptItems.map((item) => Number(item.hps) || 0);
    const ptPS = computeComponentPS(ptRaw, ptHPSArr);
    const ptWS = computeWeightedScore(ptPS, subjectWeights.pt);

    const st1Raw = typeof learnerScore.st1 === "number" && !isNaN(learnerScore.st1) ? learnerScore.st1 : 0;
    const st2Raw = typeof learnerScore.st2 === "number" && !isNaN(learnerScore.st2) ? learnerScore.st2 : 0;
    const teRaw = typeof learnerScore.te === "number" && !isNaN(learnerScore.te) ? learnerScore.te : 0;

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

  return (
    <div className="space-y-6 max-w-none w-full">
      {/* Top Banner / Navigation */}
      <PageHeader
        description="Enter scores and calculate DepEd grades live based on subject weights."
        actions={
          isLoaded && (
            <>
              <Button variant="secondary" size="small" onClick={() => setIsLoaded(false)}>
                <RefreshCw size={16} />
                Change Setup
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save size={18} />
                {isSaving ? "Saving..." : "Save Class Record"}
              </Button>
            </>
          )
        }
      />

      {/* Global Status Banner */}
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

      {/* Auto-flag confirmation banners (Initial Grade below 70) */}
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

      {/* SETUP PANEL */}
      {!isLoaded && scopeLoading ? (
        <div className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-6 text-sm text-gray-500 dark:text-gray-400">
          Loading your class assignments…
        </div>
      ) : !isLoaded && !hasAnyAssignment ? (
        <div className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            No class assignment yet
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You haven't been assigned as an adviser or subject teacher for any class. Ask your ICT
            Coordinator to set this up in User Management or Class Program.
          </p>
        </div>
      ) : !isLoaded ? (
        <div className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-3">
            Select Class &amp; Subject Parameters
          </h2>

          {advisorySection && (
            <p className="text-xs text-primary dark:text-primary-light bg-primary/10 dark:bg-primary/20 rounded-lg px-3 py-2 -mt-2">
              Your advisory: {advisorySection.gradeLevel} — {advisorySection.name}
            </p>
          )}

          <form onSubmit={handleLoadClassRecord} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Grade Level
                </label>
                {scopedGradeLevels.length <= 1 ? (
                  <p className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm">
                    {gradeLevel}
                  </p>
                ) : (
                  <select
                    value={gradeLevel}
                    onChange={(e) => {
                      const nextGrade = e.target.value;
                      setGradeLevel(nextGrade);
                      const nextSections = scopedSectionsForGrade(nextGrade);
                      setSection(nextSections[0] || "");
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none transition-colors"
                  >
                    {scopedGradeLevels.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Section
                </label>
                {scopedSectionsForGrade(gradeLevel).length <= 1 ? (
                  <p className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm">
                    {section}
                  </p>
                ) : (
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none transition-colors"
                    required
                  >
                    {scopedSectionsForGrade(gradeLevel).map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Subject
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none transition-colors"
                >
                  {SCOPED_SUBJECT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Term
                </label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none transition-colors"
                >
                  {TERM_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  School Year
                </label>
                <input
                  type="text"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  required
                />
              </div>
            </div>

            {isLoading && (
              <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            )}

            <div className="pt-2">
              <Button type="submit" disabled={isLoading} className="w-full justify-center">
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading Class Record...</span>
                  </>
                ) : (
                  "Load Class Record"
                )}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        /* SCORE GRID VIEW */
        <div className="space-y-4">
          {/* Info Summary Strip */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-sm shadow-card">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase block font-semibold">Class</span>
                <span className="font-bold text-gray-800 dark:text-gray-100">{gradeLevel} — {section}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase block font-semibold">Subject</span>
                <span className="font-bold text-gray-800 dark:text-gray-100">{subject}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase block font-semibold">Term &amp; SY</span>
                <span className="font-bold text-gray-800 dark:text-gray-100">{term} ({schoolYear})</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase block font-semibold">Weights</span>
                <span className="text-gray-700 dark:text-gray-300">
                  WW: {(subjectWeights.ww * 100).toFixed(0)}% | PT: {(subjectWeights.pt * 100).toFixed(0)}% | EX: {(subjectWeights.ex * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">
              Learners: <span className="font-bold text-gray-800 dark:text-gray-100">{learners.length}</span>
            </div>
          </div>

          {/* Grid Container */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full border-collapse text-xs text-left">
                {/* Header Group 1: Category Sections */}
                <thead>
                  <tr className="bg-primary text-white sticky top-0 z-20 font-semibold border-b border-primary-dark">
                    <th className="px-3 py-2 border-r border-white/20 sticky left-0 z-30 bg-primary min-w-[200px]" rowSpan={2}>
                      Learner Name
                    </th>
                    {/* Written Work Section */}
                    <th className="px-2 py-1.5 text-center border-r border-white/20" colSpan={wwItems.length + 2}>
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span>WRITTEN WORK ({(subjectWeights.ww * 100).toFixed(0)}%)</span>
                        <button
                          onClick={addWWItem}
                          className="px-1.5 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded text-[11px] font-normal transition-colors duration-150 active:scale-[0.98] transition-transform flex items-center gap-1"
                          title="Add WW Column"
                          type="button"
                        >
                          <Plus size={12} /> Add WW
                        </button>
                      </div>
                    </th>

                    {/* Performance Tasks Section */}
                    <th className="px-2 py-1.5 text-center border-r border-white/20" colSpan={ptItems.length + 2}>
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span>PERFORMANCE TASKS ({(subjectWeights.pt * 100).toFixed(0)}%)</span>
                        <button
                          onClick={addPTItem}
                          className="px-1.5 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded text-[11px] font-normal transition-colors duration-150 active:scale-[0.98] transition-transform flex items-center gap-1"
                          title="Add PT Column"
                          type="button"
                        >
                          <Plus size={12} /> Add PT
                        </button>
                      </div>
                    </th>

                    {/* Quarterly Assessment / Exam Section */}
                    <th className="px-2 py-1.5 text-center border-r border-white/20" colSpan={5}>
                      QUARTERLY EXAM ({(subjectWeights.ex * 100).toFixed(0)}%)
                    </th>

                    {/* Final Grade Summary Section */}
                    <th className="px-2 py-1.5 text-center" colSpan={3}>
                      SUMMARY
                    </th>
                  </tr>

                  {/* Header Group 2: Sub-headers */}
                  <tr className="bg-primary-light text-white sticky top-[33px] z-20 text-[11px] font-semibold border-b border-primary-dark">
                    {/* WW sub-headers */}
                    {wwItems.map((item, idx) => (
                      <th key={item.id} className="px-2 py-1.5 text-center border-r border-white/20 min-w-[60px]">
                        <div className="flex items-center justify-center gap-1">
                          <span>WW{idx + 1}</span>
                          <button
                            onClick={() => removeWWItem(item.id)}
                            className="text-white/60 hover:text-white transition-colors duration-150 active:scale-[0.98] transition-transform"
                            title="Remove column"
                            type="button"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">
                      <Tooltip position="bottom" label="Written Work Percentage Score">WW PS</Tooltip>
                    </th>
                    <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">
                      <Tooltip position="bottom" label="Written Work Weighted Score">WW WS</Tooltip>
                    </th>

                    {/* PT sub-headers */}
                    {ptItems.map((item, idx) => (
                      <th key={item.id} className="px-2 py-1.5 text-center border-r border-white/20 min-w-[60px]">
                        <div className="flex items-center justify-center gap-1">
                          <span>PT{idx + 1}</span>
                          <button
                            onClick={() => removePTItem(item.id)}
                            className="text-white/60 hover:text-white transition-colors duration-150 active:scale-[0.98] transition-transform"
                            title="Remove column"
                            type="button"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">
                      <Tooltip position="bottom" label="Performance Task Percentage Score">PT PS</Tooltip>
                    </th>
                    <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">
                      <Tooltip position="bottom" label="Performance Task Weighted Score">PT WS</Tooltip>
                    </th>

                    {/* EX sub-headers */}
                    <th className="px-2 py-1.5 text-center border-r border-white/20 min-w-[55px]">
                      <Tooltip position="bottom" label="Summative Test 1 — 30% of the Exam component">ST1</Tooltip>
                    </th>
                    <th className="px-2 py-1.5 text-center border-r border-white/20 min-w-[55px]">
                      <Tooltip position="bottom" label="Summative Test 2 — 30% of the Exam component">ST2</Tooltip>
                    </th>
                    <th className="px-2 py-1.5 text-center border-r border-white/20 min-w-[55px]">
                      <Tooltip position="bottom" label="Term Exam — 40% of the Exam component">TE</Tooltip>
                    </th>
                    <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">
                      <Tooltip position="bottom" label="Exam Percentage Score">EX PS</Tooltip>
                    </th>
                    <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">
                      <Tooltip position="bottom" label="Exam Weighted Score">EX WS</Tooltip>
                    </th>

                    {/* Summary sub-headers */}
                    <th className="px-2 py-1.5 text-center border-r border-white/20 bg-accent-dark/80 min-w-[70px]">
                      <Tooltip position="bottom" label="Raw computed grade before DO 15 transmutation">Init Grade</Tooltip>
                    </th>
                    <th className="px-2 py-1.5 text-center border-r border-white/20 bg-accent-dark/90 min-w-[70px]">
                      <Tooltip position="bottom" label="Final grade after transmutation table">Term Grade</Tooltip>
                    </th>
                    <th className="px-2 py-1.5 text-center min-w-[130px]">Description</th>
                  </tr>
                </thead>

                <tbody>
                  {/* HPS (Highest Possible Score) Row */}
                  <tr className="bg-accent/10 dark:bg-accent/20 font-semibold border-b-2 border-gray-300 dark:border-gray-600">
                    <td className="px-3 py-1.5 border-r border-gray-200 dark:border-gray-700 sticky left-0 z-10 bg-amber-50/90 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      Highest Possible Score (HPS)
                    </td>

                    {/* WW HPS Inputs */}
                    {wwItems.map((item, idx) => (
                      <td key={item.id} className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.hps || ""}
                          onChange={(e) => updateWWHPS(idx, e.target.value)}
                          className="w-14 px-1 py-0.5 border border-accent/40 rounded text-center text-xs font-bold text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/5 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500">—</td>
                    <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/5 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500">—</td>

                    {/* PT HPS Inputs */}
                    {ptItems.map((item, idx) => (
                      <td key={item.id} className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.hps || ""}
                          onChange={(e) => updatePTHPS(idx, e.target.value)}
                          className="w-14 px-1 py-0.5 border border-accent/40 rounded text-center text-xs font-bold text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/5 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500">—</td>
                    <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/5 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500">—</td>

                    {/* Exam HPS Inputs -- disabled when this subject's weight profile
                        has no exam component (Tech-Pro, DO 15's 20/80/0 profile) */}
                    <td className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                      <input
                        type="number"
                        min="0"
                        value={exHPS.st1 || ""}
                        onChange={(e) => updateExHPS("st1", e.target.value)}
                        disabled={subjectWeights.ex === 0}
                        title={subjectWeights.ex === 0 ? "N/A — this subject has no written exam component" : undefined}
                        className="w-12 px-1 py-0.5 border border-accent/40 rounded text-center text-xs font-bold text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary bg-white dark:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        placeholder={subjectWeights.ex === 0 ? "N/A" : "0"}
                      />
                    </td>
                    <td className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                      <input
                        type="number"
                        min="0"
                        value={exHPS.st2 || ""}
                        onChange={(e) => updateExHPS("st2", e.target.value)}
                        disabled={subjectWeights.ex === 0}
                        title={subjectWeights.ex === 0 ? "N/A — this subject has no written exam component" : undefined}
                        className="w-12 px-1 py-0.5 border border-accent/40 rounded text-center text-xs font-bold text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary bg-white dark:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        placeholder={subjectWeights.ex === 0 ? "N/A" : "0"}
                      />
                    </td>
                    <td className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                      <input
                        type="number"
                        min="0"
                        value={exHPS.te || ""}
                        onChange={(e) => updateExHPS("te", e.target.value)}
                        disabled={subjectWeights.ex === 0}
                        title={subjectWeights.ex === 0 ? "N/A — this subject has no written exam component" : undefined}
                        className="w-12 px-1 py-0.5 border border-accent/40 rounded text-center text-xs font-bold text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary bg-white dark:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        placeholder={subjectWeights.ex === 0 ? "N/A" : "0"}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/5 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500">—</td>
                    <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/5 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500">—</td>

                    {/* Summary HPS row place-holders */}
                    <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/5 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500">—</td>
                    <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/5 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500">—</td>
                    <td className="px-2 py-1.5 text-center bg-accent/5 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500">—</td>
                  </tr>

                  {/* Learner Rows */}
                  {learners.length === 0 ? (
                    <tr>
                      <td
                        colSpan={wwItems.length + ptItems.length + 14}
                        className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                      >
                        No learners found in Grade Level &quot;{gradeLevel}&quot; and Section &quot;{section}&quot;.
                      </td>
                    </tr>
                  ) : (
                    learners.map((learner, index) => {
                      const learnerScore = scores[learner.id] || {};
                      const { wwPS, wwWS, ptPS, ptWS, exPS, exWS, initialGrade, termGrade, description } =
                        computeLearnerGrade(learner);

                      const nameDisplay = `${learner.lastName || ""}, ${learner.firstName || ""} ${learner.middleName ? learner.middleName.charAt(0) + "." : ""}`;

                      return (
                        <tr
                          key={learner.id}
                          className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150 even:bg-gray-50/50 dark:even:bg-gray-800/30 bg-white dark:bg-gray-900"
                        >
                          {/* Name Column */}
                          <td className="px-3 py-1.5 border-r border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-gray-100 sticky left-0 z-10 bg-inherit break-words max-w-[220px]" title={nameDisplay}>
                            <span className="text-gray-400 dark:text-gray-500 font-normal mr-2">{index + 1}.</span>
                            {nameDisplay}
                          </td>

                          {/* WW Score Inputs */}
                          {wwItems.map((item) => (
                            <td key={item.id} className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                              <input
                                type="number"
                                min="0"
                                max={item.hps || undefined}
                                value={learnerScore.ww?.[item.id] ?? ""}
                                onChange={(e) => updateLearnerWWScore(learner.id, item.id, e.target.value)}
                                className="w-14 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-center text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono text-gray-700 dark:text-gray-300">
                            {formatComputed(wwPS)}
                          </td>
                          <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono text-gray-700 dark:text-gray-300">
                            {formatComputed(wwWS)}
                          </td>

                          {/* PT Score Inputs */}
                          {ptItems.map((item) => (
                            <td key={item.id} className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                              <input
                                type="number"
                                min="0"
                                max={item.hps || undefined}
                                value={learnerScore.pt?.[item.id] ?? ""}
                                onChange={(e) => updateLearnerPTScore(learner.id, item.id, e.target.value)}
                                className="w-14 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-center text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono text-gray-700 dark:text-gray-300">
                            {formatComputed(ptPS)}
                          </td>
                          <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono text-gray-700 dark:text-gray-300">
                            {formatComputed(ptWS)}
                          </td>

                          {/* Exam Score Inputs */}
                          <td className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                            <input
                              type="number"
                              min="0"
                              max={exHPS.st1 || undefined}
                              value={learnerScore.st1 ?? ""}
                              onChange={(e) => updateLearnerExamScore(learner.id, "st1", e.target.value)}
                              className="w-12 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-center text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            />
                          </td>
                          <td className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                            <input
                              type="number"
                              min="0"
                              max={exHPS.st2 || undefined}
                              value={learnerScore.st2 ?? ""}
                              onChange={(e) => updateLearnerExamScore(learner.id, "st2", e.target.value)}
                              className="w-12 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-center text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            />
                          </td>
                          <td className="px-1 py-1.5 border-r border-gray-200 dark:border-gray-700 text-center">
                            <input
                              type="number"
                              min="0"
                              max={exHPS.te || undefined}
                              value={learnerScore.te ?? ""}
                              onChange={(e) => updateLearnerExamScore(learner.id, "te", e.target.value)}
                              className="w-12 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-center text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono text-gray-700 dark:text-gray-300">
                            {formatComputed(exPS)}
                          </td>
                          <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono text-gray-700 dark:text-gray-300">
                            {formatComputed(exWS)}
                          </td>

                          {/* Summary Columns */}
                          <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/10 dark:bg-accent/20 font-mono font-medium text-gray-800 dark:text-gray-200">
                            {formatComputed(initialGrade)}
                          </td>
                          <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/20 dark:bg-accent/30 font-bold text-gray-900 dark:text-gray-100">
                            {termGrade !== null ? termGrade : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-left bg-gray-50 dark:bg-gray-800/40 text-[11px] text-gray-700 dark:text-gray-300 font-medium break-words max-w-[150px]" title={description || ""}>
                            {description || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
