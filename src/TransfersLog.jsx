// src/TransfersLog.jsx
// Transfers tracking module for LIKHA-SIS.
// Manages recording learner transfers (in/out) and updating learner enrollmentStatus.

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import {
  Plus,
  X,
  Search,
  Filter,
  ArrowLeft,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function TransfersLog({ user, goBack }) {
  const { config } = useSchoolConfig();
  const gradeOptions = ["All", ...(config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"])];
  const GRADE_OPTIONS = gradeOptions;
  // Filter bar state
  const [gradeLevelFilter, setGradeLevelFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("");
  const [schoolYearFilter, setSchoolYearFilter] = useState("2026-2027");
  const { sections: availableSections, loading } = useAvailableSections(gradeLevelFilter, schoolYearFilter);

  // Transfers list state
  const [transfers, setTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  const [transfersError, setTransfersError] = useState("");

  // Form / Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [allLearners, setAllLearners] = useState([]);
  const [loadingLearners, setLoadingLearners] = useState(false);
  const [learnerSearchTerm, setLearnerSearchTerm] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [transferType, setTransferType] = useState("in"); // "in" | "out"
  const [otherSchool, setOtherSchool] = useState("");
  const [transferDate, setTransferDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Fetch transfers on mount
  useEffect(() => {
    async function fetchTransfers() {
      setLoadingTransfers(true);
      setTransfersError("");
      try {
        const transfersRef = collection(db, "transfers");
        const snapshot = await getDocs(transfersRef);
        const fetched = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setTransfers(fetched);
      } catch (err) {
        console.error("Error fetching transfers:", err);
        setTransfersError("Could not load transfers record. Please check your connection.");
      } finally {
        setLoadingTransfers(false);
      }
    }
    fetchTransfers();
  }, []);

  // Fetch learners list for the Record Transfer form
  async function handleOpenForm() {
    setIsFormOpen(true);
    setSelectedLearnerId("");
    setTransferType("in");
    setOtherSchool("");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setReason("");
    setFormError("");
    setStatusMessage("");
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

  // Handle Record Transfer form submission
  async function handleSaveTransfer(e) {
    if (e) e.preventDefault();
    setFormError("");
    setStatusMessage("");

    if (!selectedLearnerId) {
      setFormError("Please select a learner.");
      return;
    }

    if (!otherSchool.trim()) {
      setFormError("Please enter the other school name.");
      return;
    }

    if (!transferDate.trim()) {
      setFormError("Please select a transfer date.");
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
      const schoolYear = selectedLearner.schoolYear || schoolYearFilter.trim() || "2026-2027";

      const recordedByEmail = user?.email || "";

      const transferDocData = {
        learnerId,
        learnerName,
        learnerLRN,
        gradeLevel,
        section,
        schoolYear,
        transferType, // "in" | "out"
        otherSchool: otherSchool.trim(),
        transferDate: transferDate.trim(),
        reason: reason.trim(),
        recordedByEmail,
        createdAt: serverTimestamp(),
      };

      // 1. Add doc to "transfers" collection
      const docRef = await addDoc(collection(db, "transfers"), transferDocData);

      // 2. Update learner's doc in "learners" collection with enrollmentStatus
      const newEnrollmentStatus = transferType === "out" ? "transferred-out" : "active";
      const learnerRef = doc(db, "learners", learnerId);
      await updateDoc(learnerRef, {
        enrollmentStatus: newEnrollmentStatus,
      });

      // Update local learners state so future form select or updates reflect new status
      setAllLearners((prev) =>
        prev.map((l) => (l.id === learnerId ? { ...l, enrollmentStatus: newEnrollmentStatus } : l))
      );

      // Update local transfers list
      const localTransfer = {
        id: docRef.id,
        ...transferDocData,
        createdAt: new Date(),
      };
      setTransfers((prev) => [localTransfer, ...prev]);

      setStatusMessage(
        `Successfully recorded transfer (${transferType === "out" ? "Transferred Out" : "Transferred In"}) for ${learnerName}.`
      );
      setIsFormOpen(false);
    } catch (err) {
      console.error("Error saving transfer:", err);
      setFormError("Failed to save transfer record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // Filter & sort transfers for main list
  const filteredTransfers = transfers
    .filter((t) => {
      // School Year filter
      if (schoolYearFilter.trim() && (t.schoolYear || "") !== schoolYearFilter.trim()) {
        return false;
      }
      // Grade Level filter
      if (gradeLevelFilter !== "All" && (t.gradeLevel || "") !== gradeLevelFilter) {
        return false;
      }
      // Section filter
      if (
        sectionFilter.trim() &&
        !(t.section || "").toLowerCase().includes(sectionFilter.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = a.transferDate ? new Date(a.transferDate).getTime() : 0;
      const dateB = b.transferDate ? new Date(b.transferDate).getTime() : 0;
      return dateB - dateA;
    });

  // Learners list for transfer form search/select
  const availableLearners = allLearners
    .filter((l) => {
      // Grade filter match
      if (gradeLevelFilter !== "All" && l.gradeLevel && l.gradeLevel !== gradeLevelFilter) {
        return false;
      }
      // School Year filter match (if learner doc specifies schoolYear)
      if (schoolYearFilter.trim() && l.schoolYear && l.schoolYear !== schoolYearFilter.trim()) {
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
            <div className="p-2 bg-leaf/10 dark:bg-leaf/20 rounded-lg text-leaf-dark dark:text-leaf-light border border-leaf/20">
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Transfers Tracking</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Record and manage learner transfers in and out of the school
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenForm}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] transition-transform text-sm"
          type="button"
        >
          <Plus size={16} /> Record a Transfer
        </button>
      </div>

      {/* Global Status Message */}
      {statusMessage && (
        <div className="animate-fade-in p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-sm rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

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
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            >
              <option value="">Select a section</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
            {availableSections.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {loading ? "Loading sections..." : "No sections found. Add learners in SF1 first."}
              </p>
            )}
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

      {/* Main List Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Transfers ({filteredTransfers.length})
          </div>
          {loadingTransfers && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs text-gray-400 dark:text-gray-500">Loading transfers...</span>
            </div>
          )}
        </div>

        {transfersError && (
          <div className="animate-fade-in p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 text-sm border-b border-red-100 dark:border-red-800">
            {transfersError}
          </div>
        )}

        {loadingTransfers ? (
          <div className="p-5 space-y-3">
            <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
            <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
            <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 space-y-2">
            <AlertTriangle className="mx-auto text-gray-300 dark:text-gray-600" size={40} />
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">No transfer records found.</div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              No transfers match the selected filters. Click &quot;+ Record a Transfer&quot; to add one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider sticky top-0 z-10">
                  <th className="px-4 py-3">Learner Name</th>
                  <th className="px-4 py-3">Grade &amp; Section</th>
                  <th className="px-4 py-3">Transfer Type</th>
                  <th className="px-4 py-3">Other School</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTransfers.map((t) => {
                  const isIn = t.transferType === "in";
                  return (
                    <tr key={t.id} className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                      <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-gray-100">
                        <div>{t.learnerName}</div>
                        {t.learnerLRN && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">LRN: {t.learnerLRN}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                        {t.gradeLevel} {t.section ? `- ${t.section}` : ""}
                      </td>
                      <td className="px-4 py-3.5">
                        {isIn ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-leaf/10 text-leaf-dark dark:bg-leaf/20 dark:text-leaf-light border border-leaf/20">
                            Transferred In
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                            Transferred Out
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-gray-700 dark:text-gray-300">{t.otherSchool || "—"}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {t.transferDate ? t.transferDate : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {t.reason || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Record a Transfer */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-xl w-full p-6 space-y-5 my-8 border border-gray-200 dark:border-gray-700 animate-slide-up">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ArrowLeftRight className="text-leaf-dark dark:text-leaf-light" size={20} /> Record a Transfer
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

            <form onSubmit={handleSaveTransfer} className="space-y-4">
              {/* Transfer Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Transfer Type *
                </label>
                <select
                  value={transferType}
                  onChange={(e) => setTransferType(e.target.value)}
                  className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none font-medium transition-colors"
                >
                  <option value="in">Transferred In</option>
                  <option value="out">Transferred Out</option>
                </select>
              </div>

              {/* Learner selection */}
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
                      className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none transition-colors"
                    >
                      <option value="">-- Choose a Learner ({availableLearners.length} available) --</option>
                      {availableLearners.map((l) => {
                        const nameStr = `${l.lastName || ""}, ${l.firstName || ""}`.trim() || l.name || "Unknown";
                        const lrnStr = l.lrn || l.learnerLRN ? ` (${l.lrn || l.learnerLRN})` : "";
                        return (
                          <option key={l.id} value={l.id}>
                            {nameStr}
                            {lrnStr}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Other School */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Other School *
                </label>
                <input
                  type="text"
                  placeholder="Name of school coming from or going to..."
                  value={otherSchool}
                  onChange={(e) => setOtherSchool(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors"
                />
              </div>

              {/* Transfer Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Transfer Date *
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Reason <span className="text-gray-400 dark:text-gray-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Reason for transfer..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors"
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
                  {isSaving ? "Saving..." : "Save Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
