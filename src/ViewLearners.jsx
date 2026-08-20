// src/ViewLearners.jsx
// Read-only view screen for saved learners from Firestore.
// Teachers can see all learners, filter by Grade & Section, and delete entries.

import { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import EditLearnerModal from "./EditLearnerModal";
import { canEditLearners } from "./pageAccess.js";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { Pencil, Trash2, AlertCircle, UserSearch } from "lucide-react";
import PageHeader from "./components/PageHeader.jsx";

function trackLabel(learner, electiveClusters) {
  if (!learner.track) return "";
  if (learner.track === "academic") return "Academic";
  if (learner.track === "techPro") {
    const cluster = electiveClusters.find((c) => c.id === learner.cluster);
    return cluster ? `Tech-Pro — ${cluster.name}` : "Tech-Pro";
  }
  return "";
}

// Calculates age from a birth date string (YYYY-MM-DD), as of today.
// Note: official DepEd age is "as of 1st Friday of June" — we're using today's date
// as a simple starting point; we can refine this exact rule later if needed.
function calculateAge(birthDateString) {
  if (!birthDateString) return "";
  const birthDate = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

function ViewLearners({ user, userRoles }) {
  const { config } = useSchoolConfig();
  const electiveClusters = config?.shs?.electiveClusters || [];
  // learners: array of learner objects from Firestore, each with its document id included.
  const [learners, setLearners] = useState([]);
  // loading: true while we're fetching data from Firestore.
  const [loading, setLoading] = useState(true);
  // filterValue: which grade+section combination the user has selected in the dropdown.
  const [filterValue, setFilterValue] = useState("All");
  // errorMessage: shows a friendly error if delete fails (e.g. network issue).
  const [errorMessage, setErrorMessage] = useState("");
  // editingLearner: the learner object currently being edited, or null when the modal is closed.
  const [editingLearner, setEditingLearner] = useState(null);

  // On component mount, fetch ALL documents from the "learners" collection in Firestore.
  useEffect(() => {
    async function fetchLearners() {
      try {
        const learnersRef = collection(db, "learners");
        const snapshot = await getDocs(learnersRef);
        // Map each document to an object that includes its Firestore id.
        const fetchedLearners = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setLearners(fetchedLearners);
      } catch (err) {
        console.error("Failed to fetch learners:", err);
        setErrorMessage("Could not load learners. Please check your connection and refresh.");
      } finally {
        setLoading(false);
      }
    }
    fetchLearners();
  }, []);

  // Build a list of unique "Grade Level - Section" combinations from the fetched data.
  // We use a Set to deduplicate, then convert back to a sorted array for the dropdown.
  const gradeSectionOptions = ["All", ...Array.from(
    new Set(
      learners
        .filter((l) => l.gradeLevel && l.section)
        .map((l) => `${l.gradeLevel} - ${l.section}`)
    )
  ).sort()];

  // Filter the learners array based on the selected dropdown value.
  // "All" shows everything; otherwise we match the exact "Grade - Section" string.
  const filteredLearners = filterValue === "All"
    ? learners
    : learners.filter((l) => `${l.gradeLevel} - ${l.section}` === filterValue);

  // Handle delete: ask for confirmation, then delete from Firestore and update local state.
  async function handleDelete(learnerId) {
    if (!confirm("Delete this learner permanently?")) return;

    try {
      await deleteDoc(doc(db, "learners", learnerId));
      setLearners((prev) => prev.filter((l) => l.id !== learnerId));
      setErrorMessage("");
    } catch (err) {
      console.error("Delete failed:", err);
      setErrorMessage("Failed to delete. Please check your connection and try again.");
      setTimeout(() => setErrorMessage(""), 5000);
    }
  }

  const isEditable = canEditLearners(userRoles);

  const thClass = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap";
  const tdClass = "px-3 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap";

  // Show a loading message while data is being fetched.
  if (loading) {
    return (
      <div className="max-w-none w-full">
        <PageHeader description="Saved learners" />
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400 dark:text-gray-500">
          <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Loading learners...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-none w-full space-y-6">
      <PageHeader
        description={`Viewing ${filteredLearners.length} of ${learners.length} learner${learners.length === 1 ? "" : "s"}`}
      >
        <select
          aria-label="Filter by grade and section"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
        >
          {gradeSectionOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </PageHeader>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-card p-5">
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 animate-fade-in">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {filteredLearners.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl mt-4">
            <UserSearch size={24} className="text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {learners.length === 0
                ? "No learners saved yet."
                : "No learners match the selected filter."}
            </p>
          </div>
        )}

        {filteredLearners.length > 0 && (
          <div className="overflow-x-auto mt-4 -mx-5 px-5">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-y border-gray-200 dark:border-gray-700">
                  <th className={thClass}>LRN</th>
                  <th className={thClass}>Last Name</th>
                  <th className={thClass}>First Name</th>
                  <th className={thClass}>Sex</th>
                  <th className={thClass}>Age</th>
                  <th className={thClass}>Grade Level</th>
                  <th className={thClass}>Section</th>
                  <th className={thClass}>Track</th>
                  <th className={thClass}>Learning Modality</th>
                  {isEditable && <th className={thClass}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredLearners.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className={`${tdClass} font-mono`}>{l.lrn || ""}</td>
                    <td className={tdClass}>
                      <span className="flex items-center gap-2">
                        {l.lastName || ""}
                        {l.enrollmentStatus === "transferred-out" && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 rounded-full dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                            Transferred Out
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={tdClass}>{l.firstName || ""}</td>
                    <td className={tdClass}>{l.sex || ""}</td>
                    <td className={tdClass}>{calculateAge(l.birthDate)}</td>
                    <td className={tdClass}>{l.gradeLevel || ""}</td>
                    <td className={tdClass}>{l.section || ""}</td>
                    <td className={tdClass}>{trackLabel(l, electiveClusters)}</td>
                    <td className={tdClass}>{l.learningModality || ""}</td>
                    {isEditable && (
                      <td className={tdClass}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingLearner(l)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/15 active:scale-[0.98] transition-all dark:bg-primary-light/10 dark:text-primary-light dark:border-primary-light/20"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(l.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 active:scale-[0.98] transition-all dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit learner modal: shown when an Edit button is clicked. */}
      {editingLearner && (
        <EditLearnerModal
          learner={editingLearner}
          currentUser={user}
          onClose={() => setEditingLearner(null)}
          onSaved={(updatedLearner) => {
            setLearners((prev) =>
              prev.map((l) => (l.id === updatedLearner.id ? updatedLearner : l))
            );
            setEditingLearner(null);
          }}
        />
      )}
    </div>
  );
}

export default ViewLearners;
