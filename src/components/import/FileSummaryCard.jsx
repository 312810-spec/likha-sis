// src/components/import/FileSummaryCard.jsx
// Per-file summary card for the import review step (file context + stats + status).

import ImportBadge from "./ImportBadge";
import IssueList from "./IssueList";

export default function FileSummaryCard({ file, onSelect, selected }) {
  const learnerCount = file.records ? file.records.length : file.learnerCount || 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left bg-white border rounded-lg shadow-sm p-4 transition-colors ${
        selected ? "border-primary ring-1 ring-primary" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{file.filename}</div>
          <div className="text-xs text-gray-400">
            {file.sheetName || "Sheet"} · {learnerCount} learner{learnerCount === 1 ? "" : "s"}
          </div>
        </div>
        <ImportBadge status={file.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
        <Info label="School" value={file.school?.schoolName || file.school?.schoolId || "—"} />
        <Info label="School Year" value={file.school?.schoolYear || "—"} />
        <Info label="Grade" value={file.school?.gradeLevel || "—"} />
        <Info label="Section" value={file.school?.section || "—"} />
      </div>

      {file.fileIssues && file.fileIssues.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <IssueList issues={file.fileIssues} compact />
        </div>
      )}
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-700 text-right truncate">{value || "—"}</span>
    </div>
  );
}
