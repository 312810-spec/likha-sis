// src/components/schedule/ScheduleGrid.jsx
// One grid, two gestures. Paint is primary: arm a subject in the palette, then
// click or drag across cells to fill them. Drop is secondary, for precise
// one-off placement. Conflicting cells go red as you work.

import { DAYS, formatRange } from "../../utils/scheduleModel";

const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

export default function ScheduleGrid({
  rows = [],
  cells = {},
  conflicts = [],
  activeSectionId,
  armed,
  onPaint,
  editable = true,
}) {
  // Conflicts now carry the section(s) they belong to (see scheduleConflicts.js
  // teacherDoubleBooked). Matching on sectionId here -- not just periodId|day --
  // stops a double-booking in one section from painting a cell red in another.
  const conflicted = new Set(
    conflicts
      .filter((c) => c.periodId && c.day && c.sectionId === activeSectionId)
      .map((c) => `${c.periodId}|${c.day}`)
  );

  function paint(periodId, day) {
    if (!editable || !armed) return;
    onPaint(periodId, day, armed);
  }

  function clear(periodId, day) {
    if (!editable) return;
    onPaint(periodId, day, null);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-32">
              TIME
            </th>
            {DAYS.map((day) => (
              <th
                key={day}
                className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.kind === "fixed") {
              return (
                <tr key={row.id}>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatRange(row.startMin, row.endMin)}
                  </td>
                  {DAYS.map((day) => (
                    <td
                      key={day}
                      className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                    >
                      {(row.labelByDay && row.labelByDay[day]) || row.label}
                    </td>
                  ))}
                </tr>
              );
            }

            return (
              <tr key={row.id}>
                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatRange(row.startMin, row.endMin)}
                </td>
                {DAYS.map((day) => {
                  const cell = cells[row.id] ? cells[row.id][day] : null;
                  const isConflicted = conflicted.has(`${row.id}|${day}`);
                  const cellLabel = `${formatRange(row.startMin, row.endMin)}, ${DAY_LABELS[day]}, ${
                    cell ? cell.subject : "empty"
                  }${isConflicted ? ", conflict" : ""}`;

                  return (
                    <td
                      key={day}
                      onMouseDown={() => paint(row.id, day)}
                      onMouseEnter={(e) => {
                        if (e.buttons === 1) paint(row.id, day);
                      }}
                      onDoubleClick={() => clear(row.id, day)}
                      onDragOver={(e) => editable && e.preventDefault()}
                      onDrop={(e) => {
                        if (!editable) return;
                        e.preventDefault();
                        const raw = e.dataTransfer.getData("application/x-likha-subject");
                        if (!raw) return;
                        try {
                          onPaint(row.id, day, JSON.parse(raw));
                        } catch {
                          // Ignore payloads that aren't the JSON this grid produces.
                        }
                      }}
                      className={`border p-0 text-center align-middle select-none ${
                        isConflicted
                          ? "border-red-500 bg-red-50 dark:bg-red-900/30"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!editable}
                        aria-label={cellLabel}
                        onKeyDown={(e) => {
                          if (!editable) return;
                          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                            e.preventDefault();
                            paint(row.id, day);
                          } else if (e.key === "Delete" || e.key === "Backspace") {
                            e.preventDefault();
                            clear(row.id, day);
                          }
                        }}
                        className={`w-full h-full px-2 py-2 bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                          editable ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        {cell ? (
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {cell.subject}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {editable && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Arm a subject in the palette, then click or drag across cells to fill them.
          Double-click a cell to clear it. Keyboard: tab to a cell, press Enter or
          Space to paint the armed subject, Delete or Backspace to clear it.
        </p>
      )}
    </div>
  );
}
