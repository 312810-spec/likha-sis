// src/components/sf2/SF2DailyAttendanceView.jsx
// The everyday SF2 workspace: one selected date, big Present/Absent/Tardy
// buttons per learner, Male/Female sections, and a "Mark Everyone Present"
// shortcut. Today's date opens unlocked; any other date opens locked/view-
// only until "Edit This Day's Attendance" is pressed (a single switch for
// the whole day, not per learner) -- a safety net against accidentally
// changing a past day's attendance while just looking back at it.

import { useState } from "react";
import { Pencil, CalendarDays } from "lucide-react";
import { groupDailyTotals } from "../../utils/sf2Summary.js";

function learnerName(l) {
  return [l.lastName || "", l.firstName || ""].filter(Boolean).join(", ");
}

// Full LRNs aren't needed for the daily working screen (CLAUDE.md §6) --
// only the last 4 digits, so a teacher can still tell learners apart.
function maskLrn(lrn) {
  const s = String(lrn || "").trim();
  if (s.length <= 4) return s;
  return `••••${s.slice(-4)}`;
}

function StateButton({ active, tone, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-colors min-h-[44px] disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? tone === "present"
            ? "bg-emerald-600 border-emerald-600 text-white"
            : tone === "absent"
            ? "bg-red-600 border-red-600 text-white"
            : "bg-amber-500 border-amber-500 text-white"
          : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function LearnerCard({ learner, value, locked, onSetValue, onRemarks, remark }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{learnerName(learner)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">LRN {maskLrn(learner.lrn)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StateButton active={value === ""} tone="present" label="Present" onClick={() => onSetValue("")} disabled={locked} />
        <StateButton active={value === "A"} tone="absent" label="Absent" onClick={() => onSetValue("A")} disabled={locked} />
        <StateButton active={value === "T"} tone="tardy" label="Tardy" onClick={() => onSetValue("T")} disabled={locked} />
        <button
          type="button"
          onClick={onRemarks}
          className="px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
        >
          {remark || "Remarks"}
        </button>
      </div>
    </li>
  );
}

export default function SF2DailyAttendanceView({
  dateLabel,
  dateString,
  isLocked,
  onPrevDay,
  onNextDay,
  onToday,
  onDateChange,
  maleLearners,
  femaleLearners,
  unresolvedSexLearners = [],
  records,
  remarksData,
  onSetValue,
  onRemarks,
  onEditDay,
  onMarkEveryonePresent,
  onSave,
  isSaving,
  isDirty,
}) {
  const [confirmingMarkAllPresent, setConfirmingMarkAllPresent] = useState(false);
  // Combined totals include everyone shown on screen, including learners
  // still awaiting a Male/Female fix in SF1 -- their attendance still counts
  // for the day even though they're not yet on the official Male/Female roster.
  const allIds = [...maleLearners, ...femaleLearners, ...unresolvedSexLearners].map((l) => l.id);
  const dailyMale = groupDailyTotals(maleLearners.map((l) => l.id), records, dateString);
  const dailyFemale = groupDailyTotals(femaleLearners.map((l) => l.id), records, dateString);
  const dailyCombined = groupDailyTotals(allIds, records, dateString);
  const exceptionCount = dailyCombined.absent + dailyCombined.tardy;

  function handleMarkAllPresentClick() {
    if (exceptionCount > 0) {
      setConfirmingMarkAllPresent(true);
    } else {
      onMarkEveryonePresent();
    }
  }

  return (
    <div className="space-y-6">
      {/* Date navigation */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Date</label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPrevDay}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
          >
            ‹ Previous Day
          </button>
          <span className="text-base font-bold text-gray-900 dark:text-gray-100 min-w-[220px] text-center">
            {dateLabel}
          </span>
          <button
            type="button"
            onClick={onNextDay}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
          >
            Next Day ›
          </button>
          <button
            type="button"
            onClick={onToday}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
          >
            Today
          </button>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 ml-auto">
            <CalendarDays size={16} />
            <input
              type="date"
              value={dateString}
              onChange={(e) => onDateChange(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 min-h-[44px]"
            />
          </label>
        </div>

        {isLocked ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              You're viewing this day's attendance. Press Edit to make changes.
            </p>
            <button
              type="button"
              onClick={onEditDay}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors min-h-[44px]"
            >
              <Pencil size={16} />
              Edit This Day's Attendance
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleMarkAllPresentClick}
            className="px-4 py-2.5 rounded-lg border-2 border-emerald-600 text-emerald-700 dark:text-emerald-400 text-sm font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors min-h-[44px]"
          >
            Mark Everyone Present
          </button>
        )}

        {confirmingMarkAllPresent && (
          <div className="rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-2">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {exceptionCount} learner{exceptionCount === 1 ? " is" : "s are"} currently marked Absent/Tardy for this date. Mark everyone Present?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onMarkEveryonePresent();
                  setConfirmingMarkAllPresent(false);
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
              >
                Yes, Mark Everyone Present
              </button>
              <button
                type="button"
                onClick={() => setConfirmingMarkAllPresent(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {unresolvedSexLearners.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Needs Attention</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
            {unresolvedSexLearners.length} learner{unresolvedSexLearners.length === 1 ? "" : "s"} {unresolvedSexLearners.length === 1 ? "is" : "are"} missing a Male/Female designation in SF1. Correct this on the SF1 Learner Records page — the learner still appears below.
          </p>
        </div>
      )}

      {/* Male / Female learner lists */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Male Learners — {maleLearners.length}</h3>
        <ul className="space-y-2">
          {maleLearners.map((l) => (
            <LearnerCard
              key={l.id}
              learner={l}
              value={records[l.id]?.[dateString] || ""}
              locked={isLocked}
              onSetValue={(v) => onSetValue(l.id, v)}
              onRemarks={() => onRemarks(l)}
              remark={remarksData[l.id]}
            />
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Female Learners — {femaleLearners.length}</h3>
        <ul className="space-y-2">
          {femaleLearners.map((l) => (
            <LearnerCard
              key={l.id}
              learner={l}
              value={records[l.id]?.[dateString] || ""}
              locked={isLocked}
              onSetValue={(v) => onSetValue(l.id, v)}
              onRemarks={() => onRemarks(l)}
              remark={remarksData[l.id]}
            />
          ))}
        </ul>
      </div>
      {unresolvedSexLearners.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
            Needs Attention — {unresolvedSexLearners.length}
          </h3>
          <ul className="space-y-2">
            {unresolvedSexLearners.map((l) => (
              <LearnerCard
                key={l.id}
                learner={l}
                value={records[l.id]?.[dateString] || ""}
                locked={isLocked}
                onSetValue={(v) => onSetValue(l.id, v)}
                onRemarks={() => onRemarks(l)}
                remark={remarksData[l.id]}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Daily totals, at the bottom -- after marking, not before */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Today's Attendance</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{dateLabel}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              <th className="px-3 py-2 text-left"></th>
              <th className="px-3 py-2">Male</th>
              <th className="px-3 py-2">Female</th>
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
            <tr>
              <td className="px-3 py-2 font-semibold">Present</td>
              <td className="px-3 py-2 text-center font-mono">{dailyMale.present}</td>
              <td className="px-3 py-2 text-center font-mono">{dailyFemale.present}</td>
              <td className="px-3 py-2 text-center font-mono font-bold">{dailyCombined.present}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-semibold">Absent</td>
              <td className="px-3 py-2 text-center font-mono">{dailyMale.absent}</td>
              <td className="px-3 py-2 text-center font-mono">{dailyFemale.absent}</td>
              <td className="px-3 py-2 text-center font-mono font-bold">{dailyCombined.absent}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-semibold">Tardy</td>
              <td className="px-3 py-2 text-center font-mono">{dailyMale.tardy}</td>
              <td className="px-3 py-2 text-center font-mono">{dailyFemale.tardy}</td>
              <td className="px-3 py-2 text-center font-mono font-bold">{dailyCombined.tardy}</td>
            </tr>
            <tr className="font-bold bg-gray-50 dark:bg-gray-800/60">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-center font-mono">{dailyMale.total}</td>
              <td className="px-3 py-2 text-center font-mono">{dailyFemale.total}</td>
              <td className="px-3 py-2 text-center font-mono">{dailyCombined.total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={isLocked || !isDirty || isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving…" : `Save Attendance for ${dateLabel}`}
        </button>
        {!isLocked && (
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {isDirty ? "Unsaved changes" : "Saved"}
          </span>
        )}
      </div>
    </div>
  );
}
