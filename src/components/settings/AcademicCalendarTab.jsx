// src/components/settings/AcademicCalendarTab.jsx
// School year and term dates. DO 15, s. 2026 mandates a 3-Term system
// (Term 1 / Term 2 / Term 3) -- terms cannot be added or removed here, only
// dated, and legacy Q1-Q4 quarters are not offered at all.
//
// Saves to settings/schoolConfig.academicCalendar; consumers read it through
// useAcademicCalendar(), layered over the built-in SY 2026-2027 fallback.

import { useState } from "react";
import { Save, CalendarDays, Plus, Trash2 } from "lucide-react";
import {
  academicCalendar as builtInCalendar,
  listSchoolYears,
  makeEmptySchoolYear,
  mergeAcademicCalendar,
  validateAcademicCalendar,
} from "../../academicCalendar.js";
import useSchoolConfigDoc from "./useSchoolConfigDoc.js";
import StatusMessages from "./StatusMessages.jsx";
import { inputClass, labelClass, cardClass, primaryButtonClass } from "./settingsStyles.js";

function nextSchoolYearLabel(existingLabels) {
  const latest = existingLabels[0];
  const startYear = latest ? Number(latest.slice(0, 4)) + 1 : new Date().getFullYear();
  return `${startYear}-${startYear + 1}`;
}

export default function AcademicCalendarTab() {
  const { data, loading, loadError, save } = useSchoolConfigDoc();

  if (loading) {
    return <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />;
  }

  if (loadError) {
    return <StatusMessages errorMessage={loadError} />;
  }

  return <AcademicCalendarForm initial={data} save={save} />;
}

function AcademicCalendarForm({ initial, save }) {
  const [calendar, setCalendar] = useState(() => mergeAcademicCalendar(initial?.academicCalendar));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const schoolYears = listSchoolYears(calendar);

  function updateTermDate(schoolYear, termIndex, field, value) {
    setCalendar((prev) => ({
      ...prev,
      [schoolYear]: {
        ...prev[schoolYear],
        terms: prev[schoolYear].terms.map((t, i) => (i === termIndex ? { ...t, [field]: value } : t)),
      },
    }));
  }

  function addSchoolYear() {
    const label = nextSchoolYearLabel(schoolYears);
    if (calendar[label]) {
      setErrorMessage(`School year ${label} already exists.`);
      return;
    }
    setErrorMessage("");
    setCalendar((prev) => ({ ...prev, [label]: makeEmptySchoolYear(label) }));
  }

  function removeSchoolYear(label) {
    setCalendar((prev) => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validateAcademicCalendar(calendar);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await save({ academicCalendar: { schoolYears: calendar } });
      setSuccessMessage("Academic calendar saved.");
    } catch (err) {
      console.error("Failed to save academic calendar:", err);
      setErrorMessage("Failed to save the academic calendar. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <StatusMessages successMessage={successMessage} errorMessage={errorMessage} />

      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <CalendarDays size={16} className="text-primary" />
              School Years & Terms
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Three terms per school year (DO 15, s. 2026). Terms must not overlap.
            </p>
          </div>
          <button
            type="button"
            onClick={addSchoolYear}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary dark:text-primary-light hover:text-primary-light shrink-0"
          >
            <Plus size={14} /> Add School Year
          </button>
        </div>

        <div className="space-y-4">
          {schoolYears.map((label) => (
            <div
              key={label}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/70 dark:bg-gray-800/60"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">SY {label}</p>
                {schoolYears.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSchoolYear(label)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {calendar[label].terms.map((term, ti) => (
                  <div key={term.id} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr] gap-2 sm:items-end">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 sm:pb-2.5">
                      {term.label}
                    </span>
                    <label className={labelClass}>
                      Start Date
                      <input
                        type="date"
                        className={inputClass}
                        value={term.startDate || ""}
                        onChange={(e) => updateTermDate(label, ti, "startDate", e.target.value)}
                      />
                    </label>
                    <label className={labelClass}>
                      End Date
                      <input
                        type="date"
                        className={inputClass}
                        value={term.endDate || ""}
                        onChange={(e) => updateTermDate(label, ti, "endDate", e.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-4 leading-relaxed">
          Removing every school year is not allowed. If none is saved, LIKHA-SIS falls back to the built-in
          SY {listSchoolYears(builtInCalendar)[0]} calendar.
        </p>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSaving} className={primaryButtonClass}>
          <Save size={16} />
          {isSaving ? "Saving..." : "Save Academic Calendar"}
        </button>
      </div>
    </form>
  );
}
