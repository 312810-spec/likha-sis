// src/SchoolSettings.jsx
// Ongoing, editable version of SetupWizard.jsx's Step 1 -- school identity,
// grade levels/key stages, and DO 017 SHS configuration. SetupWizard only
// ever runs once (no users exist yet); this page is how ictCoordinator/
// principal fix a typo, add a grade level, or edit SHS clusters afterward.

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import {
  KEY_STAGE_OPTIONS,
  getGradeLevelsFromStages,
  makeDefaultShsSubjects,
  makeDefaultShsClusters,
} from "./utils/keyStagesConfig.js";
import SchoolIdentityFields from "./components/SchoolIdentityFields.jsx";
import { toCoordinate } from "./utils/coordinates.js";
import { ArrowLeft, Settings, Save, CheckCircle2, AlertCircle } from "lucide-react";

const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors";
const labelClass = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300";

const DEFAULT_SCHOOL_FIELDS = {
  schoolName: "",
  schoolId: "",
  schoolAddress: "",
  divisionName: "",
  region: "",
  regionCode: "",
  divisionOffice: "",
  district: "",
  municipalityCityProvince: "",
  latitude: "",
  longitude: "",
  principalName: "",
  principalPosition: "",
};

export default function SchoolSettings({ goBack }) {
  const [schoolData, setSchoolData] = useState(DEFAULT_SCHOOL_FIELDS);
  const [selectedKeyStages, setSelectedKeyStages] = useState({ ks1: false, ks2: false, ks3: false, ks4: false });
  const [shsSubjects, setShsSubjects] = useState(makeDefaultShsSubjects());
  const [shsClusters, setShsClusters] = useState(makeDefaultShsClusters());

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadConfig() {
      try {
        const snap = await getDoc(doc(db, "settings", "schoolConfig"));
        if (snap.exists()) {
          const data = snap.data();
          setSchoolData({ ...DEFAULT_SCHOOL_FIELDS, ...data });
          const gradeLevels = data.gradeLevelsOffered || [];
          setSelectedKeyStages({
            ks1: false,
            ks2: gradeLevels.some((g) => ["Grade 4", "Grade 5", "Grade 6"].includes(g)),
            ks3: gradeLevels.some((g) => ["Grade 7", "Grade 8", "Grade 9", "Grade 10"].includes(g)),
            ks4: gradeLevels.some((g) => ["Grade 11", "Grade 12"].includes(g)),
          });
          if (data.shs?.subjects?.length) setShsSubjects(data.shs.subjects);
          if (data.shs?.electiveClusters?.length) setShsClusters(data.shs.electiveClusters);
        }
      } catch (err) {
        console.error("Failed to load school settings:", err);
        setErrorMessage("Could not load school settings. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  function updateField(field, value) {
    setSchoolData((prev) => ({ ...prev, [field]: value }));
  }

  function handleKeyStageToggle(stageKey) {
    if (stageKey === "ks1") return;
    setSelectedKeyStages((prev) => ({ ...prev, [stageKey]: !prev[stageKey] }));
  }

  function updateCoreSubjectName(index, name) {
    setShsSubjects((prev) => prev.map((s, i) => (i === index ? { ...s, name } : s)));
  }

  function updateClusterName(clusterIndex, name) {
    setShsClusters((prev) => prev.map((c, i) => (i === clusterIndex ? { ...c, name } : c)));
  }

  function addCluster() {
    setShsClusters((prev) => [
      ...prev,
      { id: `cluster_${Date.now()}`, name: `[Elective Cluster ${prev.length + 1}]`, subjects: [] },
    ]);
  }

  function removeCluster(clusterIndex) {
    setShsClusters((prev) => prev.filter((_, i) => i !== clusterIndex));
  }

  function addClusterSubject(clusterIndex) {
    setShsClusters((prev) =>
      prev.map((c, i) =>
        i === clusterIndex
          ? { ...c, subjects: [...c.subjects, { id: `${c.id}_s_${Date.now()}`, name: "", weightProfile: "techPro" }] }
          : c
      )
    );
  }

  function updateClusterSubject(clusterIndex, subjectIndex, patch) {
    setShsClusters((prev) =>
      prev.map((c, i) =>
        i === clusterIndex
          ? { ...c, subjects: c.subjects.map((s, si) => (si === subjectIndex ? { ...s, ...patch } : s)) }
          : c
      )
    );
  }

  function removeClusterSubject(clusterIndex, subjectIndex) {
    setShsClusters((prev) =>
      prev.map((c, i) =>
        i === clusterIndex ? { ...c, subjects: c.subjects.filter((_, si) => si !== subjectIndex) } : c
      )
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!schoolData.schoolName?.trim()) {
      setErrorMessage("School Name is required.");
      return;
    }
    if (!schoolData.principalName?.trim()) {
      setErrorMessage("Principal Name is required.");
      return;
    }

    const gradeLevelsOffered = getGradeLevelsFromStages(selectedKeyStages);
    if (gradeLevelsOffered.length === 0) {
      setErrorMessage("Please select at least one of Key Stage 2, Key Stage 3, or Key Stage 4.");
      return;
    }

    // Only persist SHS configuration when Key Stage 4 is actually enabled --
    // otherwise write the empty default rather than unused placeholder junk.
    const shs = selectedKeyStages.ks4
      ? { subjects: shsSubjects, electiveClusters: shsClusters }
      : { subjects: [], electiveClusters: [] };

    setIsSaving(true);
    try {
      // merge: true -- this page never touches logo/theme (BrandingSettings)
      // or setupCompletedAt, and must not wipe them out.
      await setDoc(
        doc(db, "settings", "schoolConfig"),
        {
          ...schoolData,
          // Coordinates are typed as text but consumed as numbers by
          // useLocalWeather and the earthquake radius, so normalize on write.
          latitude: toCoordinate(schoolData.latitude),
          longitude: toCoordinate(schoolData.longitude),
          gradeLevelsOffered,
          shs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSuccessMessage("School settings saved.");
    } catch (err) {
      console.error("Failed to save school settings:", err);
      setErrorMessage("Failed to save school settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-slide-up">
        <div className="space-y-3 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="h-6 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-slide-up">
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        {goBack && (
          <button
            type="button"
            onClick={goBack}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings className="text-primary" size={24} />
            School Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
            School identity, grade levels, and DO 017 SHS configuration.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-start gap-3 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 animate-fade-in">
          <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300 animate-fade-in">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">School Identity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SchoolIdentityFields
              values={schoolData}
              onChange={updateField}
              inputClass={inputClass}
              labelClass={labelClass}
            />
            <label className={labelClass}>
              Principal Name
              <input className={inputClass} value={schoolData.principalName || ""} onChange={(e) => updateField("principalName", e.target.value)} />
            </label>
            <label className={labelClass}>
              Principal Position
              <input className={inputClass} value={schoolData.principalPosition || ""} onChange={(e) => updateField("principalPosition", e.target.value)} />
            </label>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Grade Levels Offered</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Which key stages does your school offer?</p>
          <div className="space-y-2">
            {KEY_STAGE_OPTIONS.map((stage) => (
              <label
                key={stage.key}
                className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                  stage.disabled
                    ? "bg-gray-100 dark:bg-gray-800 opacity-70 border-gray-200 dark:border-gray-700"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedKeyStages[stage.key] || false}
                  disabled={stage.disabled}
                  onChange={() => handleKeyStageToggle(stage.key)}
                  className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{stage.label}</span>
                {stage.disabled && (
                  <span className="inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                    Coming soon
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {selectedKeyStages.ks4 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-5 animate-fade-in">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">SHS Configuration (DO 017, s.2026)</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Edit these to match your school's actual DepEd-approved offerings — the names below are
                placeholders only.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                Grade 11 Core Subjects (5 mandatory)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {shsSubjects.map((subj, i) => (
                  <input
                    key={subj.id}
                    className={inputClass}
                    value={subj.name}
                    onChange={(e) => updateCoreSubjectName(i, e.target.value)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Tech-Pro Track Elective Clusters
                </p>
                <button
                  type="button"
                  onClick={addCluster}
                  className="text-xs font-medium text-primary dark:text-primary-light hover:text-primary-light"
                >
                  + Add Cluster
                </button>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
                Keep each cluster to around 3–5 subjects — the printed Report Card is a fixed single page,
                and a learner's 5 core subjects plus a long cluster subject list can overflow it.
              </p>

              <div className="space-y-3">
                {shsClusters.map((cluster, ci) => (
                  <div key={cluster.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50/70 dark:bg-gray-800/60">
                    <div className="flex items-center gap-2">
                      <input
                        className={`${inputClass} flex-1`}
                        value={cluster.name}
                        onChange={(e) => updateClusterName(ci, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeCluster(ci)}
                        className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 px-2"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {cluster.subjects.map((subj, si) => (
                        <div key={subj.id} className="flex items-center gap-1.5">
                          <input
                            className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            placeholder="Subject name"
                            value={subj.name}
                            onChange={(e) => updateClusterSubject(ci, si, { name: e.target.value })}
                          />
                          <select
                            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            value={subj.weightProfile}
                            onChange={(e) => updateClusterSubject(ci, si, { weightProfile: e.target.value })}
                          >
                            <option value="techPro">Tech-Pro (20/80/0)</option>
                            <option value="immersion">Work Immersion (15/65/20)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeClusterSubject(ci, si)}
                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 px-1"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addClusterSubject(ci)}
                        className="text-xs font-medium text-primary dark:text-primary-light hover:text-primary-light"
                      >
                        + Add Subject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-light active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
