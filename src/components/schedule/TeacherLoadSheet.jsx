// src/components/schedule/TeacherLoadSheet.jsx
// Printable per-teacher load, matching the layout of
// public/Tingub-NHS-Teachers-Load-S.Y.26-27.docx -- grid, workload totals,
// credentials, designations, signatories.

import { DAYS } from "../../utils/scheduleModel";

const DAY_LABELS = {
  mon: "MONDAY",
  tue: "TUESDAY",
  wed: "WEDNESDAY",
  thu: "THURSDAY",
  fri: "FRIDAY",
};

// Matches the countedLabel style produced by teacherLoadDerivation.js, without
// importing it -- this module stays presentation-only.
function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default function TeacherLoadSheet({
  teacher,
  load,
  schoolYear,
  advisoryLabel,
  signatories = {},
}) {
  const bio = teacher.bio || {};

  return (
    <div className="teacher-load-doc bg-white text-black p-6">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold tracking-wide">TEACHER&rsquo;S LOAD</h2>
        <p className="text-sm">S.Y. {schoolYear}</p>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 w-24">TIME</th>
            {DAYS.map((day) => (
              <th key={day} className="border border-black px-2 py-1">
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {load.rows.map((row) => (
            <tr key={row.id + row.timeLabel}>
              <td className="border border-black px-2 py-1 whitespace-nowrap">
                {row.timeLabel}
              </td>
              {DAYS.map((day) => (
                <td
                  key={day}
                  className="border border-black px-2 py-1 text-center whitespace-pre-line"
                >
                  {row.byDay[day] ? row.byDay[day].text : ""}
                </td>
              ))}
            </tr>
          ))}

          <tr>
            <td className="border border-black px-2 py-1 font-semibold" colSpan={DAYS.length}>
              TOTAL NUMBER OF HOURS PER WEEK
            </td>
            <td className="border border-black px-2 py-1 text-center font-semibold">
              {load.totals.countedLabel}
            </td>
          </tr>
          {(load.totals.breakdown || []).map((entry, index) => (
            <tr key={`${entry.label}-${index}`}>
              <td className="border border-black px-2 py-1" colSpan={DAYS.length}>
                {entry.label}
              </td>
              <td className="border border-black px-2 py-1 text-center">
                {formatDuration(entry.minutesPerWeek)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-black px-2 py-1" colSpan={DAYS.length}>
              Preparation &amp; monitoring blocks — not counted
            </td>
            <td className="border border-black px-2 py-1 text-center">
              {formatDuration(load.totals.uncountedMinutesPerWeek || 0)}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-semibold" colSpan={DAYS.length}>
              TOTAL NUMBER OF PREPARATIONS
            </td>
            <td className="border border-black px-2 py-1 text-center font-semibold">
              {load.totals.preparations}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-semibold" colSpan={DAYS.length}>
              ADVISORY
            </td>
            <td className="border border-black px-2 py-1 text-center font-semibold">
              {advisoryLabel || "—"}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-xs">
        Total counts every assignment at its actual frequency (meetings per week ×
        minutes per meeting), including advisory, HGP, Aral Basa, and ancillary
        designations. Preparation and monitoring blocks are not counted.
      </p>

      <div className="grid grid-cols-3 gap-4 mt-6 text-xs text-center">
        <div>
          <p className="text-left mb-6">Respectfully submitted:</p>
          <p className="font-bold uppercase">{teacher.displayName}</p>
          <p>{bio.position || "Teacher"}</p>
        </div>
        <div>
          <p className="text-left mb-6">Recommending Approval:</p>
          <p className="font-bold uppercase">{signatories.recommendingName}</p>
          <p>{signatories.recommendingTitle || "School Principal"}</p>
        </div>
        <div>
          <p className="text-left mb-6">Approved:</p>
          <p className="font-bold uppercase">{signatories.approvingName}</p>
          <p>{signatories.approvingTitle || "Public Schools District Supervisor"}</p>
        </div>
      </div>

      <div className="mt-6 text-xs grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <p><span className="font-semibold">Course:</span> {bio.course || ""}</p>
          <p><span className="font-semibold">M.A.:</span> {bio.ma || ""}</p>
          <p><span className="font-semibold">Eligibility:</span> {bio.eligibility || ""}</p>
          <p><span className="font-semibold">First day of service:</span> {bio.firstDayOfService || ""}</p>
          <p><span className="font-semibold">No. of years in DepEd:</span> {bio.yearsInDepEd ?? ""}</p>
        </div>
        <div>
          <p className="font-semibold">Ancillary / Designation:</p>
          <ul className="list-none">
            {(teacher.designations || []).map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
