// src/components/settings/SectionsShiftsTab.jsx
// Shifts (how many shifts the school runs, and each one's period structure)
// and Sections per grade level -- the two pieces Class Program Generator has
// always expected from settings/schoolConfig.shifts and
// schedules/{schoolYear}/sections but never had a form to create. Adviser
// assignment happens later (Class Program Generator or a future Sections
// list), once teacher accounts actually exist.

import { useState } from "react";
import { Plus, Save, Trash2, Clock, LayoutGrid } from "lucide-react";
import useSchoolConfigDoc from "./useSchoolConfigDoc.js";
import useAcademicCalendar from "../../hooks/useAcademicCalendar.js";
import useSchoolSections from "../../hooks/useSchoolSections.js";
import { makeDefaultShift, validateShift } from "../../utils/scheduleModel.js";
import StatusMessages from "./StatusMessages.jsx";
import { inputClass, cardClass, primaryButtonClass } from "./settingsStyles.js";

export default function SectionsShiftsTab() {
  const { data, loading, loadError, save } = useSchoolConfigDoc();
  const { schoolYears, loading: calendarLoading } = useAcademicCalendar();
  const schoolYear = schoolYears?.[0] || null;

  if (loading || calendarLoading) {
    return <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />;
  }
  if (loadError) {
    return <StatusMessages errorMessage={loadError} />;
  }
  if (!schoolYear) {
    return (
      <StatusMessages errorMessage="Set up the Academic Calendar tab first -- sections are tracked per school year." />
    );
  }

  return <SectionsShiftsForm initial={data} save={save} schoolYear={schoolYear} />;
}

function SectionsShiftsForm({ initial, save, schoolYear }) {
  const [shifts, setShifts] = useState(() => initial?.shifts || []);
  const [shiftsSaving, setShiftsSaving] = useState(false);
  const [shiftsError, setShiftsError] = useState("");
  const [shiftsSuccess, setShiftsSuccess] = useState("");

  const gradeLevels = initial?.gradeLevelsOffered || [];
  const { sections, loading: sectionsLoading, saveSection, removeSection } = useSchoolSections(schoolYear);
  const [newSectionName, setNewSectionName] = useState({});
  const [newSectionShift, setNewSectionShift] = useState({});
  const [sectionsError, setSectionsError] = useState("");

  function updateShift(index, patch) {
    setShifts((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addShift() {
    setShifts((prev) => [...prev, makeDefaultShift(`Shift ${prev.length + 1}`)]);
  }

  function removeShift(index) {
    setShifts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveShifts(e) {
    e.preventDefault();
    setShiftsError("");
    setShiftsSuccess("");

    const problems = shifts.flatMap((s) => validateShift(s));
    if (problems.length > 0) {
      setShiftsError(problems[0]);
      return;
    }

    setShiftsSaving(true);
    try {
      await save({ shifts });
      setShiftsSuccess("Shifts saved.");
    } catch (err) {
      console.error("Failed to save shifts:", err);
      setShiftsError("Failed to save shifts. Please try again.");
    } finally {
      setShiftsSaving(false);
    }
  }

  async function handleAddSection(gradeLevel) {
    setSectionsError("");
    const name = (newSectionName[gradeLevel] || "").trim();
    if (!name) {
      setSectionsError(`Enter a section name for ${gradeLevel} first.`);
      return;
    }
    const shiftId = newSectionShift[gradeLevel] || shifts[0]?.id || "";
    const id = `${gradeLevel}_${name}`.toLowerCase().replace(/\s+/g, "-");
    try {
      await saveSection({ id, gradeLevel, name, shiftId });
      setNewSectionName((prev) => ({ ...prev, [gradeLevel]: "" }));
    } catch (err) {
      console.error("Failed to add section:", err);
      setSectionsError("Failed to add section. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Shifts */}
      <form onSubmit={handleSaveShifts} className={`${cardClass} space-y-4`}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:bg-primary/20 flex items-center justify-center shrink-0">
            <Clock size={17} />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Shifts</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              How many shifts does the school run? Each shift needs its own start time and period
              structure -- Class Program Generator uses this to build the weekly grid.
            </p>
          </div>
        </div>

        <StatusMessages successMessage={shiftsSuccess} errorMessage={shiftsError} />

        {shifts.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            No shifts configured yet. Add one below -- most schools with a single session need just one.
          </p>
        )}

        <div className="space-y-3">
          {shifts.map((shift, i) => (
            <div
              key={shift.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50/70 dark:bg-gray-800/60 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end"
            >
              <label className="text-xs text-gray-500 dark:text-gray-400 col-span-2 sm:col-span-1">
                Name
                <input
                  className={`${inputClass} mt-1`}
                  value={shift.label}
                  onChange={(e) => updateShift(i, { label: e.target.value })}
                />
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Start time
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="7:30"
                  value={shift.startTime}
                  onChange={(e) => updateShift(i, { startTime: e.target.value })}
                />
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Periods/day
                <input
                  type="number"
                  min="1"
                  className={`${inputClass} mt-1`}
                  value={shift.periodsPerDay}
                  onChange={(e) => updateShift(i, { periodsPerDay: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Period (min)
                <input
                  type="number"
                  min="1"
                  className={`${inputClass} mt-1`}
                  value={shift.periodDuration}
                  onChange={(e) => updateShift(i, { periodDuration: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
              <button
                type="button"
                onClick={() => removeShift(i)}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 inline-flex items-center gap-1 justify-center py-2"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={addShift}
            className="text-xs font-medium text-primary dark:text-primary-light hover:text-primary-light inline-flex items-center gap-1"
          >
            <Plus size={14} /> Add Shift
          </button>
          <button type="submit" disabled={shiftsSaving} className={primaryButtonClass}>
            <Save size={16} />
            {shiftsSaving ? "Saving..." : "Save Shifts"}
          </button>
        </div>
      </form>

      {/* Sections per grade level */}
      <div className={`${cardClass} space-y-4`}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-leaf/10 text-leaf dark:bg-leaf/20 flex items-center justify-center shrink-0">
            <LayoutGrid size={17} />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">
              Sections per Grade Level
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              School Year {schoolYear}. Add each section and pick which shift it runs in. Assigning a
              teacher as adviser happens later, in Class Program Generator, once teacher accounts exist.
            </p>
          </div>
        </div>

        {sectionsError && <StatusMessages errorMessage={sectionsError} />}

        {gradeLevels.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            Choose grade levels in the Grade Levels & SHS tab first.
          </p>
        )}

        <div className="space-y-4">
          {gradeLevels.map((gradeLevel) => {
            const gradeSections = sections.filter((s) => s.gradeLevel === gradeLevel);
            return (
              <div key={gradeLevel} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {gradeLevel}
                </p>

                {sectionsLoading ? (
                  <div className="h-6 w-32 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ) : gradeSections.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-2">No sections yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5 mb-2">
                    {gradeSections.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-full px-2.5 py-1"
                      >
                        {s.name}
                        <span className="text-gray-400 dark:text-gray-500">
                          {shifts.find((sh) => sh.id === s.shiftId)?.label || "no shift"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSection(s.id)}
                          className="text-red-500 hover:text-red-700"
                          aria-label={`Remove ${s.name}`}
                        >
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    className={`${inputClass} flex-1 min-w-[120px]`}
                    placeholder="Section name (e.g. Rizal)"
                    value={newSectionName[gradeLevel] || ""}
                    onChange={(e) => setNewSectionName((prev) => ({ ...prev, [gradeLevel]: e.target.value }))}
                  />
                  <select
                    className={`${inputClass} w-auto`}
                    value={newSectionShift[gradeLevel] || shifts[0]?.id || ""}
                    onChange={(e) => setNewSectionShift((prev) => ({ ...prev, [gradeLevel]: e.target.value }))}
                    disabled={shifts.length === 0}
                  >
                    {shifts.length === 0 && <option value="">Add a shift first</option>}
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAddSection(gradeLevel)}
                    disabled={shifts.length === 0}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-primary hover:bg-primary-dark disabled:opacity-50 rounded-lg px-3 py-2"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
