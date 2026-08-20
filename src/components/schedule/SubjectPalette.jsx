// src/components/schedule/SubjectPalette.jsx
// The armed-subject palette. Tapping a chip arms it; the grid then paints that
// subject into any cell you click. Dragging a chip is the secondary gesture.

import { teachersForSubject } from "../../utils/schedulePalette";

export default function SubjectPalette({
  subjects = [],
  teachers = [],
  armed,
  onArm,
  editable = true,
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        Subjects
      </div>

      {subjects.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Add subjects to this section to start building its program.
        </p>
      )}

      <div className="space-y-2">
        {subjects.map((entry) => {
          const isArmed = armed && armed.subject === entry.subject;
          const qualified = teachersForSubject(teachers, entry.subject);
          const assigned = teachers.find((t) => t.id === entry.teacherId);

          return (
            <button
              key={entry.subject}
              type="button"
              disabled={!editable}
              aria-pressed={!!isArmed}
              draggable={editable}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/x-likha-subject",
                  JSON.stringify({ subject: entry.subject, teacherId: entry.teacherId })
                );
              }}
              onClick={() =>
                onArm(isArmed ? null : { subject: entry.subject, teacherId: entry.teacherId })
              }
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                isArmed
                  ? "bg-primary text-white border-primary"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:border-primary"
              } ${editable ? "" : "opacity-60 cursor-not-allowed"}`}
            >
              <div className="text-sm font-semibold">{entry.subject}</div>
              <div className={`text-xs ${isArmed ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
                {assigned ? assigned.displayName : "No teacher assigned"}
                {" · "}
                {entry.sessionsPerWeek}×/week
              </div>
              {qualified.length === 0 && (
                <div className={`text-xs mt-1 ${isArmed ? "text-white/80" : "text-amber-600 dark:text-amber-400"}`}>
                  No teacher lists this subject
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
