// src/components/schedule/ClassProgramSheet.jsx
// Printable per-section Class Program, matching the layout of
// public/Tingub-NHS-Class-Program-SY-26-27.docx. Print styling lives in the
// parent page so a batch print can isolate each sheet.

import { DAYS, formatRange } from "../../utils/scheduleModel";

const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

export default function ClassProgramSheet({
  section,
  rows = [],
  teachersById = {},
  schoolYear,
  signatories = {},
}) {
  return (
    <div className="class-program-doc bg-white text-black p-6">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold tracking-wide">CLASS PROGRAM</h2>
        <p className="text-sm">S.Y. {schoolYear}</p>
        <p className="text-sm font-semibold mt-1">
          SECTION: {section.gradeLevel} - {section.name}
        </p>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 w-28">TIME</th>
            {DAYS.map((day) => (
              <th key={day} className="border border-black px-2 py-1">
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.kind === "fixed") {
              const uniform = DAYS.every(
                (day) =>
                  ((row.labelByDay && row.labelByDay[day]) || row.label) ===
                  ((row.labelByDay && row.labelByDay.mon) || row.label)
              );

              return (
                <tr key={row.id}>
                  <td className="border border-black px-2 py-1 whitespace-nowrap">
                    {formatRange(row.startMin, row.endMin)}
                  </td>
                  {uniform ? (
                    <td className="border border-black px-2 py-1 text-center font-medium" colSpan={DAYS.length}>
                      {row.label}
                    </td>
                  ) : (
                    DAYS.map((day) => (
                      <td key={day} className="border border-black px-2 py-1 text-center">
                        {(row.labelByDay && row.labelByDay[day]) || row.label}
                      </td>
                    ))
                  )}
                </tr>
              );
            }

            return (
              <tr key={row.id}>
                <td className="border border-black px-2 py-1 whitespace-nowrap">
                  {formatRange(row.startMin, row.endMin)}
                </td>
                {DAYS.map((day) => {
                  const cell = section.cells && section.cells[row.id]
                    ? section.cells[row.id][day]
                    : null;
                  const teacher = cell ? teachersById[cell.teacherId] : null;

                  return (
                    <td key={day} className="border border-black px-2 py-1 text-center">
                      {cell
                        ? `${cell.subject}${teacher ? ` – ${teacher.displayName}` : ""}`
                        : ""}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="grid grid-cols-3 gap-4 mt-8 text-xs text-center">
        <div>
          <p className="text-left mb-6">Prepared by:</p>
          <p className="font-bold uppercase">{signatories.preparedByName}</p>
          <p>{signatories.preparedByTitle || "Adviser"}</p>
        </div>
        <div>
          <p className="text-left mb-6">Recommending Approval:</p>
          <p className="font-bold uppercase">{signatories.recommendingName}</p>
          <p>{signatories.recommendingTitle || "School Principal"}</p>
        </div>
        <div>
          <p className="text-left mb-6">Approved by:</p>
          <p className="font-bold uppercase">{signatories.approvingName}</p>
          <p>{signatories.approvingTitle || "PSDS"}</p>
        </div>
      </div>
    </div>
  );
}
