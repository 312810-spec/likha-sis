// src/AnecdotalRecords.jsx
// DepEd Phase 5 — Anecdotal Records & Student Behavioral / Counseling Logs.
// Allows authorized staff (Adviser, Guidance, Principal, Master Teacher) to log,
// track, search, filter, and review learner behavioral observations, counseling
// notes, actions taken, and follow-up interventions.

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import {
  Search,
  Filter,
  Plus,
  X,
  NotebookPen,
  Calendar,
  Clock,
  CheckCircle2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import {
  ANECDOTAL_INCIDENT_TYPES,
  ANECDOTAL_STATUS_OPTIONS,
} from "./anecdotalConstants.js";
import PageHeader from "./components/PageHeader.jsx";
import Button from "./components/Button.jsx";

export default function AnecdotalRecords({ user }) {
  const { config } = useSchoolConfig();
  const gradeOptions = [
    "All",
    ...(config?.gradeLevelsOffered || [
      "Grade 4",
      "Grade 5",
      "Grade 6",
      "Grade 7",
      "Grade 8",
      "Grade 9",
      "Grade 10",
    ]),
  ];

  // Filter state
  const [gradeLevelFilter, setGradeLevelFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("");
  const [schoolYearFilter] = useState("2026-2027");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const { sections: availableSections } = useAvailableSections(
    gradeLevelFilter,
    schoolYearFilter
  );

  // Records state
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [expandedRecordId, setExpandedRecordId] = useState(null);

  // Form / Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [allLearners, setAllLearners] = useState([]);
  const [loadingLearners, setLoadingLearners] = useState(false);
  const [learnerSearchTerm, setLearnerSearchTerm] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [recordDate, setRecordDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [incidentType, setIncidentType] = useState("Behavioral / Conduct");
  const [observation, setObservation] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [followUpPlan, setFollowUpPlan] = useState("");
  const [status, setStatus] = useState("Open / Under Observation");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Quick follow-up note input state per record
  const [followUpNotes, setFollowUpNotes] = useState({});
  const [updatingRecordId, setUpdatingRecordId] = useState(null);

  // Selected learner history view modal
  const [historyLearner, setHistoryLearner] = useState(null);

  // Fetch all anecdotal records
  useEffect(() => {
    async function fetchRecords() {
      setLoadingRecords(true);
      setRecordsError("");
      try {
        const snap = await getDocs(collection(db, "anecdotalRecords"));
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        // Sort descending by recordDate / createdAt
        list.sort((a, b) => (b.recordDate || "").localeCompare(a.recordDate || ""));
        setRecords(list);
      } catch (err) {
        console.error("Failed to load anecdotal records:", err);
        setRecordsError("Could not load anecdotal records. Please check connection.");
      } finally {
        setLoadingRecords(false);
      }
    }
    fetchRecords();
  }, []);

  // Ensure learners list is loaded when modal opens
  async function loadLearners() {
    if (allLearners.length > 0) return;
    setLoadingLearners(true);
    try {
      const snap = await getDocs(collection(db, "learners"));
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAllLearners(list);
    } catch (err) {
      console.error("Failed to load learners list:", err);
      setFormError("Could not load learners list.");
    } finally {
      setLoadingLearners(false);
    }
  }

  function handleOpenForm() {
    setIsFormOpen(true);
    setSelectedLearnerId("");
    setRecordDate(new Date().toISOString().split("T")[0]);
    setIncidentType("Behavioral / Conduct");
    setObservation("");
    setActionTaken("");
    setFollowUpPlan("");
    setStatus("Open / Under Observation");
    setFormError("");
    setLearnerSearchTerm("");
    loadLearners();
  }

  // Filtered learners for modal dropdown
  const filteredLearnerOptions = useMemo(() => {
    if (!learnerSearchTerm.trim()) return allLearners.slice(0, 30);
    const q = learnerSearchTerm.toLowerCase();
    return allLearners.filter((l) => {
      const fullName = `${l.lastName || ""}, ${l.firstName || ""}`.toLowerCase();
      const lrn = (l.lrn || l.learnerLRN || "").toLowerCase();
      return fullName.includes(q) || lrn.includes(q);
    });
  }, [allLearners, learnerSearchTerm]);

  async function handleSaveRecord(e) {
    if (e) e.preventDefault();
    setFormError("");

    if (!selectedLearnerId) {
      setFormError("Please select a learner.");
      return;
    }
    if (!observation.trim()) {
      setFormError("Please enter the observation / event details.");
      return;
    }
    if (!actionTaken.trim()) {
      setFormError("Please describe the action taken / intervention.");
      return;
    }

    const learner = allLearners.find((l) => l.id === selectedLearnerId);
    if (!learner) {
      setFormError("Selected learner details not found.");
      return;
    }

    setIsSaving(true);
    try {
      const lastName = learner.lastName || "";
      const firstName = learner.firstName || "";
      const learnerName =
        lastName || firstName
          ? `${lastName}, ${firstName}`.trim()
          : learner.name || learner.learnerName || "Unknown Learner";
      const learnerLRN = learner.lrn || learner.learnerLRN || "";
      const gradeLevel =
        learner.gradeLevel ||
        (gradeLevelFilter !== "All" ? gradeLevelFilter : "Grade 4");
      const section = learner.section || "";

      const newRecord = {
        learnerId: learner.id,
        learnerLRN,
        learnerName,
        gradeLevel,
        section,
        schoolYear: schoolYearFilter || "2026-2027",
        recordDate,
        incidentType,
        observation: observation.trim(),
        actionTaken: actionTaken.trim(),
        followUpPlan: followUpPlan.trim(),
        status,
        followUps: [],
        recordedByEmail: user?.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "anecdotalRecords"), newRecord);
      const createdItem = { id: docRef.id, ...newRecord };
      setRecords((prev) => [createdItem, ...prev]);
      setIsFormOpen(false);
    } catch (err) {
      console.error("Error creating anecdotal record:", err);
      setFormError("Failed to save record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddFollowUp(recordId) {
    const noteText = followUpNotes[recordId]?.trim();
    if (!noteText) return;

    setUpdatingRecordId(recordId);
    try {
      const entry = {
        date: new Date().toISOString(),
        note: noteText,
        recordedBy: user?.email || "",
      };

      await updateDoc(doc(db, "anecdotalRecords", recordId), {
        followUps: arrayUnion(entry),
        updatedAt: serverTimestamp(),
      });

      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== recordId) return r;
          const list = Array.isArray(r.followUps) ? r.followUps : [];
          return { ...r, followUps: [...list, entry] };
        })
      );
      setFollowUpNotes((prev) => ({ ...prev, [recordId]: "" }));
    } catch (err) {
      console.error("Failed to add follow-up:", err);
      alert("Failed to add follow-up. Please try again.");
    } finally {
      setUpdatingRecordId(null);
    }
  }

  async function handleStatusChange(recordId, newStatus) {
    setUpdatingRecordId(recordId);
    try {
      await updateDoc(doc(db, "anecdotalRecords", recordId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status.");
    } finally {
      setUpdatingRecordId(null);
    }
  }

  // Filtered records based on controls
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (gradeLevelFilter !== "All" && r.gradeLevel !== gradeLevelFilter)
        return false;
      if (sectionFilter && r.section !== sectionFilter) return false;
      if (schoolYearFilter && r.schoolYear !== schoolYearFilter) return false;
      if (typeFilter !== "All" && r.incidentType !== typeFilter) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const nameMatch = (r.learnerName || "").toLowerCase().includes(q);
        const lrnMatch = (r.learnerLRN || "").toLowerCase().includes(q);
        const obsMatch = (r.observation || "").toLowerCase().includes(q);
        const actionMatch = (r.actionTaken || "").toLowerCase().includes(q);
        if (!nameMatch && !lrnMatch && !obsMatch && !actionMatch) return false;
      }
      return true;
    });
  }, [
    records,
    gradeLevelFilter,
    sectionFilter,
    schoolYearFilter,
    typeFilter,
    statusFilter,
    searchTerm,
  ]);

  // Status badge styling helper
  function getStatusBadge(st) {
    switch (st) {
      case "Resolved":
        return "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30";
      case "In Progress / Counseling":
        return "bg-sky-500/10 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border-sky-500/30";
      case "Referred to Guidance":
        return "bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/30";
      default:
        return "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30";
    }
  }

  // Learner history records
  const learnerHistoryRecords = useMemo(() => {
    if (!historyLearner) return [];
    return records.filter(
      (r) =>
        r.learnerId === historyLearner.learnerId ||
        (r.learnerLRN && r.learnerLRN === historyLearner.learnerLRN)
    );
  }, [records, historyLearner]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <PageHeader
        description="DepEd Behavioral, Counseling & Intervention Log Tracking"
        actions={
          <Button onClick={handleOpenForm}>
            <Plus size={16} /> Log Anecdotal Record
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-card space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
          <Filter size={14} /> Filter Records
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
              Grade Level
            </label>
            <select
              value={gradeLevelFilter}
              onChange={(e) => {
                setGradeLevelFilter(e.target.value);
                setSectionFilter("");
              }}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary"
            >
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
              Section
            </label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Sections</option>
              {availableSections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
              Incident / Entry Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Types</option>
              {ANECDOTAL_INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Statuses</option>
              {ANECDOTAL_STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
              Search
            </label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-2.5 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search learner, LRN, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main List */}
      {loadingRecords ? (
        <div className="space-y-3 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-card animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      ) : recordsError ? (
        <div className="p-6 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {recordsError}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 space-y-2">
          <NotebookPen size={32} className="mx-auto text-gray-400" />
          <div className="font-semibold text-gray-700 dark:text-gray-300 text-base">
            No Anecdotal Records Found
          </div>
          <p className="text-xs max-w-sm mx-auto">
            No entries match your current search and filter settings. Click "+ Log
            Anecdotal Record" to create a new observation log.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((r) => {
            const isExpanded = expandedRecordId === r.id;
            const followUps = Array.isArray(r.followUps) ? r.followUps : [];

            return (
              <div
                key={r.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-card overflow-hidden transition-all"
              >
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-gray-100 text-base">
                        {r.learnerName}
                      </span>
                      {r.learnerLRN && (
                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                          LRN: {r.learnerLRN}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {r.gradeLevel} — {r.section || "No section"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Calendar size={13} /> {r.recordDate}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary dark:bg-primary/20">
                        {r.incidentType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(
                          r.status
                        )}`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => setHistoryLearner(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      title="View all records for this learner"
                    >
                      <FileText size={14} /> History
                    </button>
                    <button
                      onClick={() =>
                        setExpandedRecordId(isExpanded ? null : r.id)
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-colors"
                    >
                      {isExpanded ? "Collapse" : "Details"}
                      {isExpanded ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
                      <div className="space-y-1 md:pr-4">
                        <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 text-xs">
                          <NotebookPen size={13} className="text-primary" />
                          Observation / Event
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {r.observation}
                        </p>
                      </div>

                      <div className="space-y-1 pt-3 md:pt-0 md:px-4">
                        <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 text-xs">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          Action / Intervention Taken
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {r.actionTaken}
                        </p>
                      </div>

                      <div className="space-y-1 pt-3 md:pt-0 md:pl-4">
                        <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 text-xs">
                          <Clock size={13} className="text-sky-600" />
                          Follow-up Plan
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {r.followUpPlan || "None specified"}
                        </p>
                      </div>
                    </div>

                    {/* Status update controller */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          Update Status:
                        </span>
                        <select
                          value={r.status}
                          disabled={updatingRecordId === r.id}
                          onChange={(e) =>
                            handleStatusChange(r.id, e.target.value)
                          }
                          className="text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1 outline-none focus:ring-1 focus:ring-primary"
                        >
                          {ANECDOTAL_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="text-gray-400 dark:text-gray-500 text-[11px]">
                        Recorded by: {r.recordedByEmail || "Staff"}
                      </div>
                    </div>

                    {/* Follow-up notes log */}
                    <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <MessageSquare size={13} /> Follow-up Intervention Notes (
                        {followUps.length})
                      </div>

                      {followUps.length > 0 && (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {followUps.map((fu, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                            >
                              <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                                <span>
                                  {fu.date
                                    ? new Date(fu.date).toLocaleDateString()
                                    : "Recent"}
                                </span>
                                <span>{fu.recordedBy || ""}</span>
                              </div>
                              <p className="text-gray-800 dark:text-gray-200">
                                {fu.note}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Add follow-up intervention note..."
                          value={followUpNotes[r.id] || ""}
                          onChange={(e) =>
                            setFollowUpNotes((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                          className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary"
                        />
                        <Button
                          type="button"
                          size="small"
                          disabled={
                            updatingRecordId === r.id ||
                            !(followUpNotes[r.id] || "").trim()
                          }
                          onClick={() => handleAddFollowUp(r.id)}
                        >
                          Add Note
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Log Anecdotal Record */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <NotebookPen size={18} className="text-primary" />
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                  Log New Anecdotal Record
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveRecord} className="space-y-4 text-xs">
              {/* Learner search and selection */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Select Learner *
                </label>
                <input
                  type="text"
                  placeholder="Filter learners by name or LRN..."
                  value={learnerSearchTerm}
                  onChange={(e) => setLearnerSearchTerm(e.target.value)}
                  className="w-full mb-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose Learner --</option>
                  {filteredLearnerOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lastName}, {l.firstName} (LRN: {l.lrn || l.learnerLRN || "N/A"}) —{" "}
                      {l.gradeLevel} {l.section ? `(${l.section})` : ""}
                    </option>
                  ))}
                </select>
                {loadingLearners && (
                  <p className="text-[11px] text-gray-400 mt-1">Loading learners...</p>
                )}
              </div>

              {/* Date & Incident Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Record Date *
                  </label>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Entry / Incident Type *
                  </label>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary"
                  >
                    {ANECDOTAL_INCIDENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Observation */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Observation / Event Details *
                </label>
                <textarea
                  rows={3}
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="Describe the specific behavior, incident, or observation objectively..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              {/* Action Taken */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Action Taken / Intervention *
                </label>
                <textarea
                  rows={2}
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="Actions taken by adviser/staff (e.g., student conference, parent notified, counseling)..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              {/* Follow-up Plan & Initial Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Follow-up Plan
                  </label>
                  <input
                    type="text"
                    value={followUpPlan}
                    onChange={(e) => setFollowUpPlan(e.target.value)}
                    placeholder="Next follow-up step or schedule..."
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-primary"
                  >
                    {ANECDOTAL_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit / Cancel buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Record"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Learner History View */}
      {historyLearner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
                  <FileText size={18} className="text-primary" />
                  Anecdotal History: {historyLearner.learnerName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  LRN: {historyLearner.learnerLRN || "N/A"} · {historyLearner.gradeLevel} -{" "}
                  {historyLearner.section}
                </p>
              </div>
              <button
                onClick={() => setHistoryLearner(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {learnerHistoryRecords.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">
                  No additional records logged for this learner.
                </p>
              ) : (
                learnerHistoryRecords.map((hist) => (
                  <div
                    key={hist.id}
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {hist.recordDate}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary dark:bg-primary/20 font-medium">
                          {hist.incidentType}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadge(
                          hist.status
                        )}`}
                      >
                        {hist.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                        Observation:
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {hist.observation}
                      </p>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                        Action Taken:
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {hist.actionTaken}
                      </p>
                    </div>

                    {hist.followUpPlan && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 pt-1">
                        <strong>Follow-up Plan:</strong> {hist.followUpPlan}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setHistoryLearner(null)}
                className="px-4 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-200 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
