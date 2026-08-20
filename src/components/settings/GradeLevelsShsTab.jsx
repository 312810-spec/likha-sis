// src/components/settings/GradeLevelsShsTab.jsx
// Key stages offered + DO 017, s. 2026 Strengthened SHS configuration
// (5 mandatory Grade 11 core subjects and the Tech-Pro elective clusters).
// Changing these re-shapes section lists, class records and report cards, so
// this tab lives behind the School Settings key like the rest.

import { useState } from "react";
import { Save } from "lucide-react";
import {
  KEY_STAGE_OPTIONS,
  getGradeLevelsFromStages,
  makeDefaultShsSubjects,
  makeDefaultShsClusters,
} from "../../utils/keyStagesConfig.js";
import useSchoolConfigDoc from "./useSchoolConfigDoc.js";
import StatusMessages from "./StatusMessages.jsx";
import { inputClass, cardClass, primaryButtonClass } from "./settingsStyles.js";

export default function GradeLevelsShsTab() {
  const { data, loading, loadError, save } = useSchoolConfigDoc();

  if (loading) {
    return <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />;
  }

  if (loadError) {
    return <StatusMessages errorMessage={loadError} />;
  }

  return <GradeLevelsShsForm initial={data} save={save} />;
}

function keyStagesFromGradeLevels(gradeLevels = []) {
  return {
    ks1: false,
    ks2: gradeLevels.some((g) => ["Grade 4", "Grade 5", "Grade 6"].includes(g)),
    ks3: gradeLevels.some((g) => ["Grade 7", "Grade 8", "Grade 9", "Grade 10"].includes(g)),
    ks4: gradeLevels.some((g) => ["Grade 11", "Grade 12"].includes(g)),
  };
}

function GradeLevelsShsForm({ initial, save }) {
  const [selectedKeyStages, setSelectedKeyStages] = useState(() =>
    keyStagesFromGradeLevels(initial?.gradeLevelsOffered || [])
  );
  const [shsSubjects, setShsSubjects] = useState(() =>
    initial?.shs?.subjects?.length ? initial.shs.subjects : makeDefaultShsSubjects()
  );
  const [shsClusters, setShsClusters] = useState(() =>
    initial?.shs?.electiveClusters?.length ? initial.shs.electiveClusters : makeDefaultShsClusters()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
      await save({ gradeLevelsOffered, shs });
      setSuccessMessage("Grade levels and SHS configuration saved.");
    } catch (err) {
      console.error("Failed to save grade levels:", err);
      setErrorMessage("Failed to save grade levels. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <StatusMessages successMessage={successMessage} errorMessage={errorMessage} />

      <div className={cardClass}>
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
        <div className={`${cardClass} space-y-5 animate-fade-in`}>
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
        <button type="submit" disabled={isSaving} className={primaryButtonClass}>
          <Save size={16} />
          {isSaving ? "Saving..." : "Save Grade Levels"}
        </button>
      </div>
    </form>
  );
}
