// src/components/SubjectSelectPicker.jsx
// Controlled, grade-dependent, searchable subject selector backed by the
// canonical DepEd subject directory (src/utils/subjectDirectory.js). Used
// by User Management so subject assignment stops being free text and
// instead only offers subjects that actually apply to the chosen grade
// level/key stage (§5-6 of the teacher-scoping task).

import { useMemo, useState } from "react";
import { getSubjectsForGradeLevel, getKeyStageForGradeLevel } from "../utils/subjectDirectory";
import { KEY_STAGE_OPTIONS } from "../utils/keyStagesConfig";

export default function SubjectSelectPicker({
  value,
  onChange,
  gradeLevel,
  schoolYear,
  term,
  disabled,
  id,
  legacyValue,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const stageKey = getKeyStageForGradeLevel(gradeLevel);
  const stageLabel = KEY_STAGE_OPTIONS.find((s) => s.key === stageKey)?.label || "";
  const subjects = useMemo(
    () => getSubjectsForGradeLevel(gradeLevel, { schoolYear, term }),
    [gradeLevel, schoolYear, term]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => s.label.toLowerCase().includes(q));
  }, [subjects, query]);

  const isDisabled = disabled || !gradeLevel;
  // A stored assignment subject that isn't in this grade's directory --
  // legacy free text from before this picker shipped. Never silently
  // dropped or auto-rewritten; flagged so the ICT Coordinator can reselect.
  const isUnrecognized =
    !!legacyValue && !subjects.some((s) => s.label === legacyValue);

  function selectSubject(label) {
    onChange(label);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        disabled={isDisabled}
        value={open ? query : value || ""}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={
          !gradeLevel ? "Select a grade level first" : `Search ${stageLabel || "subjects"}...`
        }
        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
      />
      {isUnrecognized && !open && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          "{legacyValue}" is not in the directory for {gradeLevel} — reselect from the list.
        </p>
      )}
      {open && !isDisabled && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-gray-400 dark:text-gray-500">No matching subjects</li>
          )}
          {filtered.map((s) => (
            <li key={s.id + (s.group || "")}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSubject(s.label)}
                className="w-full text-left px-3 py-2 hover:bg-primary/10 dark:hover:bg-primary/20 text-gray-800 dark:text-gray-100"
              >
                {s.label}
                {s.group && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({s.group})</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
