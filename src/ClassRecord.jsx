// src/ClassRecord.jsx
// Class Record page for LIKHA-SIS.
// Subject teachers enter scores and view live computed grades (PS, WS, Initial Grade, Term Grade, Description).

import { useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { SUBJECT_WEIGHTS, getSubjectWeights } from "./utils/subjectWeights";
import { transmuteGrade, getGradeDescription } from "./utils/transmutationTable";
import {
  computeComponentPS,
  computeWeightedScore,
  computeExamPS,
  computeInitialGrade,
} from "./utils/gradeComputations";
import { Plus, X, Save, ArrowLeft, RefreshCw, BookOpen } from "lucide-react";

export default function ClassRecord({ user, goBack }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];

  // Setup Panel state
  const [gradeLevel, setGradeLevel] = useState(gradeOptions[0] || "Grade 4");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState(Object.keys(SUBJECT_WEIGHTS)[0] || "FILIPINO");
  const [term, setTerm] = useState("Term 1");
  const [schoolYear, setSchoolYear] = useState("2026-2027");

  // Grid / Data state
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [learners, setLearners] = useState([]);
  const [wwItems, setWwItems] = useState([{ id: "ww1", hps: 0 }]);
  const [ptItems, setPtItems] = useState([{ id: "pt1", hps: 0 }]);
  const [exHPS, setExHPS] = useState({ st1: 0, st2: 0, te: 0 });
  const [scores, setScores] = useState({});

  const GRADE_OPTIONS = gradeOptions;

  // Subject options from SUBJECT_WEIGHTS
  const SUBJECT_OPTIONS = Object.keys(SUBJECT_WEIGHTS);

  // Term options
  const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"];

  // Helper to construct deterministic Firestore Document ID
  function getDocId() {
    const teacherId = user?.uid || "unknown_teacher";
    const raw = `${teacherId}_${subject}_${gradeLevel}_${section.trim()}_${term}_${schoolYear.trim()}`;
    return raw.toLowerCase().replace(/\s+/g, "-");
  }

  // Load class record and matching learners
  async function handleLoadClassRecord(e) {
    if (e) e.preventDefault();
    if (!section.trim()) {
      setErrorMessage("Please enter a section name.");
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

  const subjectWeights = getSubjectWeights(subject) || { ww: 0.2, pt: 0.5, ex: 0.3 };

  return (
    <div className="space-y-6">
      {/* Top Banner / Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {goBack && (
            <button
              onClick={goBack}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Back to Dashboard"
              type="button"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="text-primary" size={26} />
              Class Record
            </h1>
            <p className="text-sm text-slate-500">
              Enter scores and calculate DepEd grades live based on subject weights.
            </p>
          </div>
        </div>

        {isLoaded && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLoaded(false)}
              className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
              type="button"
            >
              <RefreshCw size={16} />
              Change Setup
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-primary-dark bg-accent hover:bg-accent-dark rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              type="button"
            >
              <Save size={18} />
              {isSaving ? "Saving..." : "Save Class Record"}
            </button>
          </div>
        )}
      </div>

      {/* Global Status Banner */}
      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* SETUP PANEL */}
      {!isLoaded ? (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-800 border-b pb-3">
            Select Class & Subject Parameters
          </h2>

          <form onSubmit={handleLoadClassRecord} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Grade Level
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Section
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kindness"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Subject
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  {SUBJECT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Term
                </label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  {TERM_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  School Year
                </label>
                <input
                  type="text"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg shadow-sm transition-colors text-sm disabled:opacity-50"
              >
                {isLoading ? "Loading Class Record..." : "Load Class Record"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* SCORE GRID VIEW */
        <div className="space-y-4">
          {/* Info Summary Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-sm shadow-sm">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-slate-500 text-xs uppercase block font-semibold">Class</span>
                <span className="font-bold text-slate-800">{gradeLevel} — {section}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase block font-semibold">Subject</span>
                <span className="font-bold text-slate-800">{subject}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase block font-semibold">Term & SY</span>
                <span className="font-bold text-slate-800">{term} ({schoolYear})</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase block font-semibold">Weights</span>
                <span className="text-slate-700">
                  WW: {(subjectWeights.ww * 100).toFixed(0)}% | PT: {(subjectWeights.pt * 100).toFixed(0)}% | EX: {(subjectWeights.ex * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="text-slate-500 text-xs">
              Learners: <span className="font-bold text-slate-800">{learners.length}</span>
            </div>
          </div>

          {/* Grid Container */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full border-collapse text-xs text-left">
                {/* Header Group 1: Category Sections */}
                <thead>
                  <tr className="bg-primary text-white sticky top-0 z-20 font-semibold border-b border-primary-dark">
                    <th className="px-3 py-2 border-r border-white/20 sticky left-0 z-30 bg-primary min-w-[200px]" rowSpan={2}>
                      Learner Name
                    </th>
                    {/* Written Work Section */}
                    <th className="px-2 py-1 text-center border-r border-white/20" colSpan={wwItems.length + 2}>
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span>WRITTEN WORK ({(subjectWeights.ww * 100).toFixed(0)}%)</span>
                        <button
                          onClick={addWWItem}
                          className="px-1.5 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded text-[11px] font-normal transition-colors flex items-center gap-1"
                          title="Add WW Column"
                          type="button"
                        >
                          <Plus size={12} /> Add WW
                        </button>
                      </div>
                    </th>

                    {/* Performance Tasks Section */}
                    <th className="px-2 py-1 text-center border-r border-white/20" colSpan={ptItems.length + 2}>
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span>PERFORMANCE TASKS ({(subjectWeights.pt * 100).toFixed(0)}%)</span>
                        <button
                          onClick={addPTItem}
                          className="px-1.5 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded text-[11px] font-normal transition-colors flex items-center gap-1"
                          title="Add PT Column"
                          type="button"
                        >
                          <Plus size={12} /> Add PT
                        </button>
                      </div>
                    </th>

                    {/* Quarterly Assessment / Exam Section */}
                    <th className="px-2 py-1 text-center border-r border-white/20" colSpan={5}>
                      QUARTERLY EXAM ({(subjectWeights.ex * 100).toFixed(0)}%)
                    </th>

                    {/* Final Grade Summary Section */}
                    <th className="px-2 py-1 text-center" colSpan={3}>
                      SUMMARY
                    </th>
                  </tr>

                  {/* Header Group 2: Sub-headers */}
                  <tr className="bg-primary-light text-white sticky top-[33px] z-20 text-[11px] font-semibold border-b border-primary-dark">
                    {/* WW sub-headers */}
                    {wwItems.map((item, idx) => (
                      <th key={item.id} className="px-2 py-1 text-center border-r border-white/20 min-w-[60px]">
                        <div className="flex items-center justify-center gap-1">
                          <span>WW{idx + 1}</span>
                          <button
                            onClick={() => removeWWItem(item.id)}
                            className="text-white/60 hover:text-white transition-colors"
                            title="Remove column"
                            type="button"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-1 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">WW PS</th>
                    <th className="px-2 py-1 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">WW WS</th>

                    {/* PT sub-headers */}
                    {ptItems.map((item, idx) => (
                      <th key={item.id} className="px-2 py-1 text-center border-r border-white/20 min-w-[60px]">
                        <div className="flex items-center justify-center gap-1">
                          <span>PT{idx + 1}</span>
                          <button
                            onClick={() => removePTItem(item.id)}
                            className="text-white/60 hover:text-white transition-colors"
                            title="Remove column"
                            type="button"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-1 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">PT PS</th>
                    <th className="px-2 py-1 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">PT WS</th>

                    {/* EX sub-headers */}
                    <th className="px-2 py-1 text-center border-r border-white/20 min-w-[55px]">ST1</th>
                    <th className="px-2 py-1 text-center border-r border-white/20 min-w-[55px]">ST2</th>
                    <th className="px-2 py-1 text-center border-r border-white/20 min-w-[55px]">TE</th>
                    <th className="px-2 py-1 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">EX PS</th>
                    <th className="px-2 py-1 text-center border-r border-white/20 bg-primary-dark/40 min-w-[60px]">EX WS</th>

                    {/* Summary sub-headers */}
                    <th className="px-2 py-1 text-center border-r border-white/20 bg-amber-600/60 min-w-[70px]">Init Grade</th>
                    <th className="px-2 py-1 text-center border-r border-white/20 bg-amber-600/80 min-w-[70px]">Term Grade</th>
                    <th className="px-2 py-1 text-center min-w-[130px]">Description</th>
                  </tr>
                </thead>

                <tbody>
                  {/* HPS (Highest Possible Score) Row */}
                  <tr className="bg-amber-50 font-semibold border-b-2 border-slate-300">
                    <td className="px-3 py-1.5 border-r border-slate-200 sticky left-0 z-10 bg-amber-50 text-slate-900">
                      Highest Possible Score (HPS)
                    </td>

                    {/* WW HPS Inputs */}
                    {wwItems.map((item, idx) => (
                      <td key={item.id} className="px-1 py-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.hps || ""}
                          onChange={(e) => updateWWHPS(idx, e.target.value)}
                          className="w-14 px-1 py-0.5 border border-amber-300 rounded text-center text-xs font-bold text-slate-900 focus:ring-1 focus:ring-primary bg-white"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-100/50 text-slate-400">—</td>
                    <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-100/50 text-slate-400">—</td>

                    {/* PT HPS Inputs */}
                    {ptItems.map((item, idx) => (
                      <td key={item.id} className="px-1 py-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.hps || ""}
                          onChange={(e) => updatePTHPS(idx, e.target.value)}
                          className="w-14 px-1 py-0.5 border border-amber-300 rounded text-center text-xs font-bold text-slate-900 focus:ring-1 focus:ring-primary bg-white"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-100/50 text-slate-400">—</td>
                    <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-100/50 text-slate-400">—</td>

                    {/* Exam HPS Inputs */}
                    <td className="px-1 py-1 border-r border-slate-200 text-center">
                      <input
                        type="number"
                        min="0"
                        value={exHPS.st1 || ""}
                        onChange={(e) => updateExHPS("st1", e.target.value)}
                        className="w-12 px-1 py-0.5 border border-amber-300 rounded text-center text-xs font-bold text-slate-900 focus:ring-1 focus:ring-primary bg-white"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-1 py-1 border-r border-slate-200 text-center">
                      <input
                        type="number"
                        min="0"
                        value={exHPS.st2 || ""}
                        onChange={(e) => updateExHPS("st2", e.target.value)}
                        className="w-12 px-1 py-0.5 border border-amber-300 rounded text-center text-xs font-bold text-slate-900 focus:ring-1 focus:ring-primary bg-white"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-1 py-1 border-r border-slate-200 text-center">
                      <input
                        type="number"
                        min="0"
                        value={exHPS.te || ""}
                        onChange={(e) => updateExHPS("te", e.target.value)}
                        className="w-12 px-1 py-0.5 border border-amber-300 rounded text-center text-xs font-bold text-slate-900 focus:ring-1 focus:ring-primary bg-white"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-100/50 text-slate-400">—</td>
                    <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-100/50 text-slate-400">—</td>

                    {/* Summary HPS row place-holders */}
                    <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-100/50 text-slate-400">—</td>
                    <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-100/50 text-slate-400">—</td>
                    <td className="px-2 py-1 text-center bg-amber-100/50 text-slate-400">—</td>
                  </tr>

                  {/* Learner Rows */}
                  {learners.length === 0 ? (
                    <tr>
                      <td
                        colSpan={wwItems.length + ptItems.length + 14}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No learners found in Grade Level &quot;{gradeLevel}&quot; and Section &quot;{section}&quot;.
                      </td>
                    </tr>
                  ) : (
                    learners.map((learner, index) => {
                      const learnerScore = scores[learner.id] || {};

                      // Compute WW
                      const wwRaw = wwItems.map((item) => {
                        const val = learnerScore.ww?.[item.id];
                        return typeof val === "number" && !isNaN(val) ? val : 0;
                      });
                      const wwHPSArr = wwItems.map((item) => Number(item.hps) || 0);
                      const wwPS = computeComponentPS(wwRaw, wwHPSArr);
                      const wwWS = computeWeightedScore(wwPS, subjectWeights.ww);

                      // Compute PT
                      const ptRaw = ptItems.map((item) => {
                        const val = learnerScore.pt?.[item.id];
                        return typeof val === "number" && !isNaN(val) ? val : 0;
                      });
                      const ptHPSArr = ptItems.map((item) => Number(item.hps) || 0);
                      const ptPS = computeComponentPS(ptRaw, ptHPSArr);
                      const ptWS = computeWeightedScore(ptPS, subjectWeights.pt);

                      // Compute EX
                      const st1Raw = typeof learnerScore.st1 === "number" && !isNaN(learnerScore.st1) ? learnerScore.st1 : 0;
                      const st2Raw = typeof learnerScore.st2 === "number" && !isNaN(learnerScore.st2) ? learnerScore.st2 : 0;
                      const teRaw = typeof learnerScore.te === "number" && !isNaN(learnerScore.te) ? learnerScore.te : 0;

                      const st1HPS = Number(exHPS.st1) || 0;
                      const st2HPS = Number(exHPS.st2) || 0;
                      const teHPS = Number(exHPS.te) || 0;

                      const exPS = computeExamPS(st1Raw, st1HPS, st2Raw, st2HPS, teRaw, teHPS);
                      const exWS = computeWeightedScore(exPS, subjectWeights.ex);

                      // Compute Final
                      const initialGrade = computeInitialGrade(wwWS, ptWS, exWS);
                      const termGrade = transmuteGrade(initialGrade);
                      const description = getGradeDescription(termGrade);

                      const nameDisplay = `${learner.lastName || ""}, ${learner.firstName || ""} ${learner.middleName ? learner.middleName.charAt(0) + "." : ""}`;

                      return (
                        <tr
                          key={learner.id}
                          className={`hover:bg-blue-50/50 transition-colors ${
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/70"
                          }`}
                        >
                          {/* Name Column */}
                          <td className="px-3 py-1.5 border-r border-slate-200 font-medium text-slate-800 sticky left-0 z-10 bg-inherit truncate max-w-[220px]" title={nameDisplay}>
                            <span className="text-slate-400 font-normal mr-2">{index + 1}.</span>
                            {nameDisplay}
                          </td>

                          {/* WW Score Inputs */}
                          {wwItems.map((item) => (
                            <td key={item.id} className="px-1 py-1 border-r border-slate-200 text-center">
                              <input
                                type="number"
                                min="0"
                                max={item.hps || undefined}
                                value={learnerScore.ww?.[item.id] ?? ""}
                                onChange={(e) => updateLearnerWWScore(learner.id, item.id, e.target.value)}
                                className="w-14 px-1 py-0.5 border border-slate-300 rounded text-center text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1 text-center border-r border-slate-200 bg-slate-100/60 font-mono text-slate-700">
                            {formatComputed(wwPS)}
                          </td>
                          <td className="px-2 py-1 text-center border-r border-slate-200 bg-slate-100/60 font-mono text-slate-700">
                            {formatComputed(wwWS)}
                          </td>

                          {/* PT Score Inputs */}
                          {ptItems.map((item) => (
                            <td key={item.id} className="px-1 py-1 border-r border-slate-200 text-center">
                              <input
                                type="number"
                                min="0"
                                max={item.hps || undefined}
                                value={learnerScore.pt?.[item.id] ?? ""}
                                onChange={(e) => updateLearnerPTScore(learner.id, item.id, e.target.value)}
                                className="w-14 px-1 py-0.5 border border-slate-300 rounded text-center text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1 text-center border-r border-slate-200 bg-slate-100/60 font-mono text-slate-700">
                            {formatComputed(ptPS)}
                          </td>
                          <td className="px-2 py-1 text-center border-r border-slate-200 bg-slate-100/60 font-mono text-slate-700">
                            {formatComputed(ptWS)}
                          </td>

                          {/* Exam Score Inputs */}
                          <td className="px-1 py-1 border-r border-slate-200 text-center">
                            <input
                              type="number"
                              min="0"
                              max={exHPS.st1 || undefined}
                              value={learnerScore.st1 ?? ""}
                              onChange={(e) => updateLearnerExamScore(learner.id, "st1", e.target.value)}
                              className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </td>
                          <td className="px-1 py-1 border-r border-slate-200 text-center">
                            <input
                              type="number"
                              min="0"
                              max={exHPS.st2 || undefined}
                              value={learnerScore.st2 ?? ""}
                              onChange={(e) => updateLearnerExamScore(learner.id, "st2", e.target.value)}
                              className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </td>
                          <td className="px-1 py-1 border-r border-slate-200 text-center">
                            <input
                              type="number"
                              min="0"
                              max={exHPS.te || undefined}
                              value={learnerScore.te ?? ""}
                              onChange={(e) => updateLearnerExamScore(learner.id, "te", e.target.value)}
                              className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </td>
                          <td className="px-2 py-1 text-center border-r border-slate-200 bg-slate-100/60 font-mono text-slate-700">
                            {formatComputed(exPS)}
                          </td>
                          <td className="px-2 py-1 text-center border-r border-slate-200 bg-slate-100/60 font-mono text-slate-700">
                            {formatComputed(exWS)}
                          </td>

                          {/* Summary Columns */}
                          <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-50/70 font-mono font-medium text-slate-800">
                            {formatComputed(initialGrade)}
                          </td>
                          <td className="px-2 py-1 text-center border-r border-slate-200 bg-amber-100/80 font-bold text-slate-900">
                            {termGrade !== null ? termGrade : "—"}
                          </td>
                          <td className="px-2 py-1 text-left bg-slate-50 text-[11px] text-slate-700 font-medium truncate max-w-[150px]" title={description || ""}>
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
