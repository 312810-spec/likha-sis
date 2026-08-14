// src/LardoTracking.jsx
// Learners At Risk of Dropping Out (LARDO) tracking module for LIKHA-SIS.
// Manages flagging learners, risk factors, status tracking, and append-only intervention logs.

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import {
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  ArrowLeft,
  MessageSquare,
  Send,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

const FIXED_RISK_FACTORS = [
  "Financial difficulty",
  "Distance to school",
  "Family problems",
  "Health condition",
  "Academic difficulty",
  "Child labor",
  "Early pregnancy/marriage",
  "Bullying/peer issues",
  "Other",
];

export default function LardoTracking({ user, goBack }) {
  const { config } = useSchoolConfig();
  const gradeOptions = ["All", ...(config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"])];
  const GRADE_OPTIONS = gradeOptions;
  // Filter bar state
  const [gradeLevelFilter, setGradeLevelFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("");
  const [schoolYearFilter, setSchoolYearFilter] = useState("2026-2027");

  // LARDO Records state
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [expandedRecordId, setExpandedRecordId] = useState(null);

  // Note text inputs per record for adding intervention log entries
  const [noteInputs, setNoteInputs] = useState({});
  const [updatingRecordId, setUpdatingRecordId] = useState(null);

  // Form / Modal state for "+ Flag a Learner"
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [allLearners, setAllLearners] = useState([]);
  const [loadingLearners, setLoadingLearners] = useState(false);
  const [learnerSearchTerm, setLearnerSearchTerm] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [selectedRiskFactors, setSelectedRiskFactors] = useState([]);
  const [otherRiskFactorNote, setOtherRiskFactorNote] = useState("");
  const [initialNote, setInitialNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Fetch LARDO records on mount
  useEffect(() => {
    async function fetchLardoRecords() {
      setLoadingRecords(true);
      setRecordsError("");
      try {
        const recordsRef = collection(db, "lardoRecords");
        const snapshot = await getDocs(recordsRef);
        const fetched = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setRecords(fetched);
      } catch (err) {
        console.error("Error fetching LARDO records:", err);
        setRecordsError("Could not load LARDO records. Please check your connection.");
      } finally {
        setLoadingRecords(false);
      }
    }
    fetchLardoRecords();
  }, []);

  // Fetch learners list for the Flag modal
  async function handleOpenForm() {
    setIsFormOpen(true);
    setSelectedLearnerId("");
    setSelectedRiskFactors([]);
    setOtherRiskFactorNote("");
    setInitialNote("");
    setFormError("");
    setLearnerSearchTerm("");

    if (allLearners.length === 0) {
      setLoadingLearners(true);
      try {
        const learnersSnap = await getDocs(collection(db, "learners"));
        const list = learnersSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setAllLearners(list);
      } catch (err) {
        console.error("Error fetching learners:", err);
        setFormError("Failed to load learners list for selection.");
      } finally {
        setLoadingLearners(false);
      }
    }
  }

  // Risk factor checkbox toggle
  function toggleRiskFactor(factor) {
    setSelectedRiskFactors((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  }

  // Handle Flag Learner form submission
  async function handleSaveFlag(e) {
    if (e) e.preventDefault();
    setFormError("");

    if (!selectedLearnerId) {
      setFormError("Please select a learner to flag.");
      return;
    }

    if (selectedRiskFactors.length === 0) {
      setFormError("Please select at least one risk factor.");
      return;
    }

    if (selectedRiskFactors.includes("Other") && !otherRiskFactorNote.trim()) {
      setFormError("Please specify details for the 'Other' risk factor.");
      return;
    }

    const selectedLearner = allLearners.find((l) => l.id === selectedLearnerId);
    if (!selectedLearner) {
      setFormError("Selected learner details not found.");
      return;
    }

    setIsSaving(true);
    try {
      const learnerId = selectedLearner.id;
      const schoolYear = schoolYearFilter.trim() || "2026-2027";
      const docId = `${learnerId}_${schoolYear}`;

      const lastName = selectedLearner.lastName || "";
      const firstName = selectedLearner.firstName || "";
      const learnerName =
        lastName || firstName
          ? `${lastName}, ${firstName}`.trim()
          : selectedLearner.name || selectedLearner.learnerName || "Unknown Learner";

      const learnerLRN = selectedLearner.lrn || selectedLearner.learnerLRN || "";
      const gradeLevel =
        selectedLearner.gradeLevel ||
        (gradeLevelFilter !== "All" ? gradeLevelFilter : "Grade 4");
      const section = selectedLearner.section || "";

      const nowIso = new Date().toISOString();
      const firstInterventionNote = initialNote.trim() || "Learner flagged for LARDO monitoring.";

      const newRecordData = {
        learnerId,
        learnerLRN,
        learnerName,
        gradeLevel,
        section,
        schoolYear,
        riskFactors: selectedRiskFactors,
        otherRiskFactorNote: selectedRiskFactors.includes("Other") ? otherRiskFactorNote.trim() : "",
        status: "monitoring",
        interventions: [
          {
            date: nowIso,
            note: firstInterventionNote,
          },
        ],
        flaggedDate: nowIso,
        flaggedByEmail: user?.email || "",
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "lardoRecords", docId), newRecordData, { merge: true });

      // Update local records state
      const localRecord = { id: docId, ...newRecordData };
      setRecords((prev) => {
        const existingIdx = prev.findIndex((r) => r.id === docId);
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = localRecord;
          return copy;
        }
        return [localRecord, ...prev];
      });

      setIsFormOpen(false);
    } catch (err) {
      console.error("Error flagging learner:", err);
      setFormError("Failed to save LARDO record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // Add a new intervention note to a record
  async function handleAddNote(recordId) {
    const noteText = noteInputs[recordId]?.trim();
    if (!noteText) return;

    setUpdatingRecordId(recordId);
    try {
      const newEntry = {
        date: new Date().toISOString(),
        note: noteText,
      };

      const recordRef = doc(db, "lardoRecords", recordId);
      await updateDoc(recordRef, {
        interventions: arrayUnion(newEntry),
        updatedAt: serverTimestamp(),
      });

      // Update local state
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id === recordId) {
            const currentInterventions = Array.isArray(r.interventions) ? r.interventions : [];
            return {
              ...r,
              interventions: [...currentInterventions, newEntry],
            };
          }
          return r;
        })
      );

      setNoteInputs((prev) => ({ ...prev, [recordId]: "" }));
    } catch (err) {
      console.error("Failed to add intervention note:", err);
      alert("Failed to add note. Please try again.");
    } finally {
      setUpdatingRecordId(null);
    }
  }

  // Change status of a record
  async function handleStatusChange(recordId, newStatus) {
    setUpdatingRecordId(recordId);
    try {
      const recordRef = doc(db, "lardoRecords", recordId);
      await updateDoc(recordRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingRecordId(null);
    }
  }

  // Filter & Sort records for main list
  const filteredRecords = records
    .filter((r) => {
      // Filter by School Year
      if (schoolYearFilter.trim() && r.schoolYear !== schoolYearFilter.trim()) {
        return false;
      }
      // Filter by Grade Level
      if (gradeLevelFilter !== "All" && r.gradeLevel !== gradeLevelFilter) {
        return false;
      }
      // Filter by Section
      if (
        sectionFilter.trim() &&
        !(r.section || "").toLowerCase().includes(sectionFilter.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = a.flaggedDate ? new Date(a.flaggedDate).getTime() : 0;
      const dateB = b.flaggedDate ? new Date(b.flaggedDate).getTime() : 0;
      return dateB - dateA;
    });

  // Learners list for flag form search/select
  const availableLearners = allLearners
    .filter((l) => {
      // Grade filter match
      if (gradeLevelFilter !== "All" && l.gradeLevel && l.gradeLevel !== gradeLevelFilter) {
        return false;
      }
      // Search term filter
      if (learnerSearchTerm.trim()) {
        const term = learnerSearchTerm.toLowerCase();
        const fullName = `${l.lastName || ""} ${l.firstName || ""}`.toLowerCase();
        const lrn = (l.lrn || l.learnerLRN || "").toLowerCase();
        return fullName.includes(term) || lrn.includes(term);
      }
      return true;
    })
    .sort((a, b) => {
      const lastA = (a.lastName || "").toLowerCase();
      const lastB = (b.lastName || "").toLowerCase();
      if (lastA !== lastB) return lastA.localeCompare(lastB);
      return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-slide-up">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          {goBack && (
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light font-medium mb-2 transition-colors duration-150 active:scale-[0.98] transition-transform"
              type="button"
            >
              <ArrowLeft size={14} /> Back to Dashboard
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent/10 dark:bg-accent/20 rounded-lg text-accent-dark dark:text-accent-light border border-accent/20">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">LARDO Tracking</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Learners At Risk of Dropping Out — Monitoring &amp; Intervention System
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenForm}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] transition-transform text-sm"
          type="button"
        >
          <Plus size={16} /> Flag a Learner
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          <Filter size={14} /> Filter Records
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Grade Level</label>
            <select
              value={gradeLevelFilter}
              onChange={(e) => setGradeLevelFilter(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Section <span className="text-gray-400 dark:text-gray-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="Filter by section..."
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">School Year</label>
            <input
              type="text"
              placeholder="e.g. 2026-2027"
              value={schoolYearFilter}
              onChange={(e) => setSchoolYearFilter(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Flagged Learners ({filteredRecords.length})
          </div>
          {loadingRecords && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs text-gray-400 dark:text-gray-500">Loading records...</span>
            </div>
          )}
        </div>

        {recordsError && (
          <div className="animate-fade-in p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 text-sm border-b border-red-100 dark:border-red-800">
            {recordsError}
          </div>
        )}

        {loadingRecords ? (
          <div className="p-5 space-y-3">
            <div className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
            <div className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
            <div className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 space-y-2">
            <AlertTriangle className="mx-auto text-gray-300 dark:text-gray-600" size={40} />
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">No LARDO records found.</div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              No learners have been flagged for the selected filters. Click &quot;+ Flag a Learner&quot; to create a new record.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRecords.map((r) => {
              const isExpanded = expandedRecordId === r.id;
              const interventionsList = Array.isArray(r.interventions) ? r.interventions : [];

              return (
                <div key={r.id} className="transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/50">
                  {/* Summary Row */}
                  <div
                    onClick={() => setExpandedRecordId(isExpanded ? null : r.id)}
                    className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{r.learnerName}</span>
                        {r.learnerLRN && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                            LRN: {r.learnerLRN}
                          </span>
                        )}
                        <span className="text-xs font-medium bg-primary/10 text-primary-dark dark:bg-primary/20 dark:text-primary-light px-2 py-0.5 rounded border border-primary/20">
                          {r.gradeLevel} {r.section ? `- ${r.section}` : ""}
                        </span>
                      </div>

                      {/* Risk factors tags */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {(r.riskFactors || []).map((rf) => (
                          <span
                            key={rf}
                            className="inline-block bg-primary/10 text-primary-dark dark:bg-primary/20 dark:text-primary-light border border-primary/20 text-xs px-2 py-0.5 rounded font-medium"
                          >
                            {rf === "Other" && r.otherRiskFactorNote
                              ? `Other: ${r.otherRiskFactorNote}`
                              : rf}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {/* Status colored badge */}
                      <div>
                        {r.status === "monitoring" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent-dark dark:bg-accent/20 dark:text-accent-light border border-accent/20">
                            monitoring
                          </span>
                        )}
                        {r.status === "resolved" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-leaf/10 text-leaf-dark dark:bg-leaf/20 dark:text-leaf-light border border-leaf/20">
                            resolved
                          </span>
                        )}
                        {r.status === "dropped" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                            dropped
                          </span>
                        )}
                      </div>

                      <div className="text-right hidden sm:block text-xs text-gray-400 dark:text-gray-500">
                        <div>Flagged: {r.flaggedDate ? new Date(r.flaggedDate).toLocaleDateString() : "N/A"}</div>
                      </div>

                      <button
                        type="button"
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Interventions & Status Panel */}
                  {isExpanded && (
                    <div className="bg-gray-50/80 dark:bg-gray-800/40 p-4 sm:p-5 border-t border-gray-200/80 dark:border-gray-700 space-y-4 text-xs sm:text-sm">
                      {/* Meta info */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-200 dark:border-gray-700">
                        <div>
                          <strong>Flagged By:</strong> {r.flaggedByEmail || "N/A"}
                        </div>
                        <div>
                          <strong>School Year:</strong> {r.schoolYear}
                        </div>
                        <div>
                          <strong>Flagged Date:</strong>{" "}
                          {r.flaggedDate ? new Date(r.flaggedDate).toLocaleString() : "N/A"}
                        </div>
                      </div>

                      {/* Status Change Selector */}
                      <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 max-w-xs">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Update Status:</label>
                        <select
                          value={r.status || "monitoring"}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          disabled={updatingRecordId === r.id}
                          className="text-xs font-semibold rounded border border-gray-300 dark:border-gray-700 px-2 py-1 focus:ring-1 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none"
                        >
                          <option value="monitoring">monitoring</option>
                          <option value="resolved">resolved</option>
                          <option value="dropped">dropped</option>
                        </select>
                      </div>

                      {/* Interventions Log */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                          <MessageSquare size={14} /> Interventions Log ({interventionsList.length})
                        </div>

                        {interventionsList.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No interventions logged yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {interventionsList.map((entry, idx) => (
                              <div
                                key={idx}
                                className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200/80 dark:border-gray-700 shadow-2xs space-y-1"
                              >
                                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                                  <span className="font-mono">
                                    {entry.date ? new Date(entry.date).toLocaleString() : "N/A"}
                                  </span>
                                  <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                    Entry #{idx + 1}
                                  </span>
                                </div>
                                <p className="text-gray-800 dark:text-gray-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                                  {entry.note}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add Note Input */}
                      <div className="pt-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Add Intervention Note
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter new intervention note..."
                            value={noteInputs[r.id] || ""}
                            onChange={(e) =>
                              setNoteInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddNote(r.id);
                              }
                            }}
                            className="flex-1 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddNote(r.id)}
                            disabled={updatingRecordId === r.id || !noteInputs[r.id]?.trim()}
                            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors duration-150 active:scale-[0.98] transition-transform shadow-sm"
                          >
                            <Send size={14} /> Add note
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Flag a Learner */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-xl w-full p-6 space-y-5 my-8 border border-gray-200 dark:border-gray-700 animate-slide-up">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <AlertTriangle className="text-accent" size={20} /> Flag a Learner (LARDO)
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="animate-fade-in p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 text-xs rounded-lg border border-red-100 dark:border-red-800 font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveFlag} className="space-y-4">
              {/* Step 1: Learner selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Select Learner *
                </label>
                {loadingLearners ? (
                  <div className="space-y-2 py-2">
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                      />
                      <input
                        type="text"
                        placeholder="Search learner by name or LRN..."
                        value={learnerSearchTerm}
                        onChange={(e) => setLearnerSearchTerm(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors"
                      />
                    </div>

                    <select
                      value={selectedLearnerId}
                      onChange={(e) => setSelectedLearnerId(e.target.value)}
                      className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none max-h-40 transition-colors"
                    >
                      <option value="">-- Choose a Learner ({availableLearners.length} available) --</option>
                      {availableLearners.map((l) => {
                        const nameStr = `${l.lastName || ""}, ${l.firstName || ""}`.trim() || l.name || "Unknown";
                        const lrnStr = l.lrn || l.learnerLRN ? ` (${l.lrn || l.learnerLRN})` : "";
                        const sectionStr = l.gradeLevel ? ` - ${l.gradeLevel} ${l.section || ""}` : "";
                        return (
                          <option key={l.id} value={l.id}>
                            {nameStr}
                            {lrnStr}
                            {sectionStr}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Step 2: Risk factors checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Risk Factors *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                  {FIXED_RISK_FACTORS.map((factor) => {
                    const isChecked = selectedRiskFactors.includes(factor);
                    return (
                      <label
                        key={factor}
                        className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRiskFactor(factor)}
                          className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary bg-white dark:bg-gray-700"
                        />
                        <span>{factor}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Other note */}
              {selectedRiskFactors.includes("Other") && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Other Risk Factor Details *
                  </label>
                  <input
                    type="text"
                    placeholder="Specify other risk factor..."
                    value={otherRiskFactorNote}
                    onChange={(e) => setOtherRiskFactorNote(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors"
                  />
                </div>
              )}

              {/* Step 3: Initial Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Initial Intervention / Note
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter initial observation or intervention action..."
                  value={initialNote}
                  onChange={(e) => setInitialNote(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-150 active:scale-[0.98] transition-transform"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-medium bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-lg transition-colors duration-150 active:scale-[0.98] transition-transform shadow-sm"
                >
                  {isSaving ? "Saving..." : "Save LARDO Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
