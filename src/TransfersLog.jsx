// src/TransfersLog.jsx
// Transfers tracking module for LIKHA-SIS.
//
// Adviser-style class scoping (matches School Forms/Class Record): an
// adviser manages only their own advisory's transfer records, resolved from
// users/{uid}.assignments[] via the canonical useTeacherScope/teacherScope.js
// -- never a raw independent parse of assignments. Oversight roles
// (principal/smeaCoordinator/ictCoordinator) keep a read-only, school-wide
// view; only an adviser can record a transfer, and only for their own class.

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useAcademicCalendar from "./hooks/useAcademicCalendar";
import useTeacherScope from "./hooks/useTeacherScope";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import {
  Plus,
  X,
  Search,
  Filter,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  Users,
  TrendingUp,
  TrendingDown,
  Scale,
} from "lucide-react";
import PageHeader from "./components/PageHeader.jsx";
import Button from "./components/Button.jsx";

// Oversight roles get a read-only, school-wide monitoring view (spec §6) --
// they never gain the ability to record a transfer merely because they can
// view reports; that stays adviser-only, scoped to the adviser's own class.
const OVERSIGHT_ROLES = ["ictCoordinator", "principal", "smeaCoordinator"];

function normalizeName(learner) {
  const last = learner.lastName || "";
  const first = learner.firstName || "";
  return last || first ? `${last}, ${first}`.trim() : learner.name || learner.learnerName || "Unknown Learner";
}

function matchesSearch(transfer, term) {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    (transfer.learnerName || "").toLowerCase().includes(t) ||
    (transfer.learnerLRN || "").toLowerCase().includes(t)
  );
}

function sortNewestFirst(list) {
  return [...list].sort((a, b) => {
    const dateA = a.transferDate ? new Date(a.transferDate).getTime() : 0;
    const dateB = b.transferDate ? new Date(b.transferDate).getTime() : 0;
    return dateB - dateA;
  });
}

function SummaryCards({ transfers }) {
  const transferredIn = transfers.filter((t) => t.transferType === "in").length;
  const transferredOut = transfers.filter((t) => t.transferType === "out").length;
  const net = transferredIn - transferredOut;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-card flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-leaf/10 text-leaf-dark dark:bg-leaf/20 dark:text-leaf-light flex items-center justify-center shrink-0">
          <TrendingUp size={15} />
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Transferred In</div>
          <div className="font-tabular text-lg font-semibold text-gray-900 dark:text-gray-100">{transferredIn}</div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-card flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-500/10 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300 flex items-center justify-center shrink-0">
          <TrendingDown size={15} />
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Transferred Out</div>
          <div className="font-tabular text-lg font-semibold text-gray-900 dark:text-gray-100">{transferredOut}</div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-card flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent-dark dark:bg-accent/20 flex items-center justify-center shrink-0">
          <Scale size={15} />
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Net Movement</div>
          <div className="font-tabular text-lg font-semibold text-gray-900 dark:text-gray-100">{net > 0 ? `+${net}` : net}</div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-card flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary dark:bg-primary/20 flex items-center justify-center shrink-0">
          <Users size={15} />
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Records</div>
          <div className="font-tabular text-lg font-semibold text-gray-900 dark:text-gray-100">{transfers.length}</div>
        </div>
      </div>
    </div>
  );
}

function TransferTable({ transfers, loading, error, emptyText }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Transfers ({transfers.length})</div>
        {loading && (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="text-xs text-gray-400 dark:text-gray-500">Loading transfers...</span>
          </div>
        )}
      </div>

      {error && (
        <div className="animate-fade-in p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 text-sm border-b border-red-100 dark:border-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-5 space-y-3">
          <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
        </div>
      ) : transfers.length === 0 ? (
        <div className="p-12 text-center text-gray-500 dark:text-gray-400 space-y-2">
          <AlertTriangle className="mx-auto text-gray-300 dark:text-gray-600" size={40} />
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">No transfer records found.</div>
          <p className="text-xs text-gray-400 dark:text-gray-500">{emptyText}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider sticky top-0 z-10">
                <th className="px-4 py-2.5">Learner</th>
                <th className="px-4 py-2.5">Grade &amp; Section</th>
                <th className="px-4 py-2.5">Transfer Type</th>
                <th className="px-4 py-2.5">Transfer Date</th>
                <th className="px-4 py-2.5">Reason / Remarks</th>
                <th className="px-4 py-2.5">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortNewestFirst(transfers).map((t) => {
                const isIn = t.transferType === "in";
                return (
                  <tr key={t.id} className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      <div>{t.learnerName}</div>
                      {t.learnerLRN && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">LRN: {t.learnerLRN}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {t.gradeLevel} {t.section ? `- ${t.section}` : ""}
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.transferDate || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs break-words">{t.reason || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs break-words">{t.recordedByEmail || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div className="relative max-w-sm">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <input
        type="text"
        placeholder="Search by learner name or LRN..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors"
      />
    </div>
  );
}

// ---- Record a Transfer modal (adviser-scoped only) ----
function RecordTransferModal({ user, adviser, schoolYear, onClose, onSaved }) {
  const [sectionLearners, setSectionLearners] = useState([]);
  const [loadingLearners, setLoadingLearners] = useState(true);
  const [learnerSearchTerm, setLearnerSearchTerm] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [transferType, setTransferType] = useState("in");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingLearners(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "learners"),
            where("gradeLevel", "==", adviser.gradeLevel),
            where("section", "==", adviser.section)
          )
        );
        if (!cancelled) setSectionLearners(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching advisory learners:", err);
        if (!cancelled) setFormError("Failed to load learners for your advisory class.");
      } finally {
        if (!cancelled) setLoadingLearners(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [adviser.gradeLevel, adviser.section]);

  const availableLearners = sectionLearners
    .filter((l) => {
      if (transferType === "out" && l.enrollmentStatus === "transferred-out") return false;
      if (learnerSearchTerm.trim()) {
        const term = learnerSearchTerm.toLowerCase();
        const fullName = normalizeName(l).toLowerCase();
        const lrn = (l.lrn || l.learnerLRN || "").toLowerCase();
        return fullName.includes(term) || lrn.includes(term);
      }
      return true;
    })
    .sort((a, b) => normalizeName(a).localeCompare(normalizeName(b)));

  const selectedLearner = sectionLearners.find((l) => l.id === selectedLearnerId) || null;

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");

    if (!selectedLearnerId || !selectedLearner) {
      setFormError("Please select a learner.");
      return;
    }
    if (!transferDate.trim()) {
      setFormError("Please select a transfer date.");
      return;
    }

    setIsSaving(true);
    try {
      const previousEnrollmentStatus = selectedLearner.enrollmentStatus || "active";
      const newEnrollmentStatus = transferType === "out" ? "transferred-out" : "active";

      const transferDocData = {
        learnerId: selectedLearner.id,
        learnerLRN: selectedLearner.lrn || selectedLearner.learnerLRN || "",
        learnerName: normalizeName(selectedLearner),
        gradeLevel: adviser.gradeLevel,
        section: adviser.section,
        schoolYear,
        transferType,
        transferDate: transferDate.trim(),
        reason: reason.trim(),
        previousEnrollmentStatus,
        newEnrollmentStatus,
        recordedByUid: user?.uid || "",
        recordedByEmail: user?.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "transfers"), transferDocData);
      await updateDoc(doc(db, "learners", selectedLearner.id), { enrollmentStatus: newEnrollmentStatus });

      onSaved({ id: docRef.id, ...transferDocData, createdAt: new Date() }, normalizeName(selectedLearner));
    } catch (err) {
      console.error("Error saving transfer:", err);
      setFormError("Failed to save transfer record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-xl w-full p-6 space-y-5 my-8 border border-gray-200 dark:border-gray-700 animate-slide-up">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ArrowLeftRight className="text-leaf-dark dark:text-leaf-light" size={20} /> Record a Transfer
          </h2>
          <button
            type="button"
            onClick={onClose}
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

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Transfer Type *</label>
            <select
              value={transferType}
              onChange={(e) => {
                setTransferType(e.target.value);
                setSelectedLearnerId("");
              }}
              className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none font-medium transition-colors"
            >
              <option value="in">Transferred In</option>
              <option value="out">Transferred Out</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Learner *</label>
            {loadingLearners ? (
              <div className="space-y-2 py-2">
                <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <SearchBar value={learnerSearchTerm} onChange={setLearnerSearchTerm} />
                <select
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none transition-colors"
                >
                  <option value="">-- Choose a Learner ({availableLearners.length} available) --</option>
                  {availableLearners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {normalizeName(l)}
                      {l.lrn || l.learnerLRN ? ` — LRN ${l.lrn || l.learnerLRN}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {selectedLearner && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
              <div>
                {adviser.gradeLevel} — {adviser.section}
              </div>
              <div>
                Current Status:{" "}
                <span className="font-medium">
                  {selectedLearner.enrollmentStatus === "transferred-out" ? "Transferred Out" : "Active"}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Transfer Date *</label>
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Reason / Remarks <span className="text-gray-400 dark:text-gray-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="Reason for transfer..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
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
  );
}

// ---- Adviser section: own advisory only ----
function AdvisoryTransfers({ user, adviser, schoolYear }) {
  const [transfers, setTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  const [transfersError, setTransfersError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!adviser) {
      return undefined;
    }
    let cancelled = false;
    async function load() {
      setLoadingTransfers(true);
      setTransfersError("");
      try {
        const snap = await getDocs(
          query(
            collection(db, "transfers"),
            where("gradeLevel", "==", adviser.gradeLevel),
            where("section", "==", adviser.section),
            where("schoolYear", "==", schoolYear)
          )
        );
        if (!cancelled) setTransfers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching advisory transfers:", err);
        if (!cancelled) setTransfersError("Could not load your advisory's transfer records.");
      } finally {
        if (!cancelled) setLoadingTransfers(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviser?.gradeLevel, adviser?.section, schoolYear]);

  if (!adviser) {
    return (
      <div className="p-8 text-center bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
        <AlertTriangle className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={32} />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No advisory class assigned.</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Contact the ICT Coordinator to update your assignment.</p>
      </div>
    );
  }

  const filtered = transfers.filter((t) => matchesSearch(t, searchTerm));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Advisory Class</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {adviser.gradeLevel} — {adviser.section}
          </div>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus size={16} /> Record a Transfer
        </Button>
      </div>

      {statusMessage && (
        <div className="animate-fade-in p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-sm rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <SummaryCards transfers={transfers} />
      <SearchBar value={searchTerm} onChange={setSearchTerm} />
      <TransferTable
        transfers={filtered}
        loading={loadingTransfers}
        error={transfersError}
        emptyText='No transfers recorded for your advisory yet. Click "+ Record a Transfer" to add one.'
      />

      {isFormOpen && (
        <RecordTransferModal
          user={user}
          adviser={adviser}
          schoolYear={schoolYear}
          onClose={() => setIsFormOpen(false)}
          onSaved={(localTransfer, learnerName) => {
            setTransfers((prev) => [localTransfer, ...prev]);
            setStatusMessage(
              `Successfully recorded transfer (${localTransfer.transferType === "out" ? "Transferred Out" : "Transferred In"}) for ${learnerName}.`
            );
            setIsFormOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ---- Oversight section: read-only, school-wide ----
function OversightTransfers({ schoolYear: initialSchoolYear }) {
  const { config } = useSchoolConfig();
  const gradeOptions = ["All", ...(config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"])];

  const [gradeLevelFilter, setGradeLevelFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("");
  const [schoolYearFilter, setSchoolYearFilter] = useState(initialSchoolYear);
  const { sections: availableSections, loading: loadingSections } = useAvailableSections(
    gradeLevelFilter === "All" ? "" : gradeLevelFilter,
    schoolYearFilter
  );
  const [searchTerm, setSearchTerm] = useState("");

  const [transfers, setTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  const [transfersError, setTransfersError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingTransfers(true);
      setTransfersError("");
      try {
        const transfersRef = schoolYearFilter.trim()
          ? query(collection(db, "transfers"), where("schoolYear", "==", schoolYearFilter.trim()))
          : collection(db, "transfers");
        const snapshot = await getDocs(transfersRef);
        if (!cancelled) setTransfers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching transfers:", err);
        if (!cancelled) setTransfersError("Could not load transfers record. Please check your connection.");
      } finally {
        if (!cancelled) setLoadingTransfers(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [schoolYearFilter]);

  const filtered = useMemo(
    () =>
      transfers.filter((t) => {
        if (gradeLevelFilter !== "All" && (t.gradeLevel || "") !== gradeLevelFilter) return false;
        if (sectionFilter.trim() && (t.section || "").toLowerCase() !== sectionFilter.trim().toLowerCase()) return false;
        return matchesSearch(t, searchTerm);
      }),
    [transfers, gradeLevelFilter, sectionFilter, searchTerm]
  );

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        School-wide Transfers (Read-only)
      </div>

      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-card">
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
              {gradeOptions.map((g) => (
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
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
            {availableSections.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {loadingSections ? "Loading sections..." : "No sections found for this grade level."}
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

      <SummaryCards transfers={filtered} />
      <SearchBar value={searchTerm} onChange={setSearchTerm} />
      <TransferTable
        transfers={filtered}
        loading={loadingTransfers}
        error={transfersError}
        emptyText="No transfers match the selected filters."
      />
    </div>
  );
}

export default function TransfersLog({ user, userRoles = [] }) {
  const isAdviser = userRoles.includes("adviser");
  const hasOversightRole = userRoles.some((r) => OVERSIGHT_ROLES.includes(r));

  const { schoolYears } = useAcademicCalendar();
  const currentSchoolYear = schoolYears?.[0] || "2026-2027";
  // Self-scoped: reads only this user's own account/advisory lookup, not
  // another learner's data -- safe to call even when the oversight-only
  // branch below is what actually renders.
  const teacherScope = useTeacherScope(user, currentSchoolYear);

  return (
    <div className="space-y-6 max-w-none w-full">
      <PageHeader description="Record and manage learner transfers in and out of the school" />

      {isAdviser && <AdvisoryTransfers user={user} adviser={teacherScope.adviser} schoolYear={currentSchoolYear} />}
      {hasOversightRole && <OversightTransfers schoolYear={currentSchoolYear} />}
      {!isAdviser && !hasOversightRole && (
        <div className="p-8 text-center bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">You don't have access to Transfers.</p>
        </div>
      )}
    </div>
  );
}
