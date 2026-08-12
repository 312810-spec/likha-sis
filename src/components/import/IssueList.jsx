// src/components/import/IssueList.jsx
// Renders a list of validation issues grouped by severity with friendly styling.

import ImportBadge from "./ImportBadge";

function displayMessage(issue) {
  let msg = issue.message || "Unknown issue";
  if (issue.field) msg = `${issue.field}: ${msg}`;
  return msg;
}

export default function IssueList({ issues = [], compact = false }) {
  if (!issues || issues.length === 0) {
    return <p className="text-xs text-gray-400">No issues.</p>;
  }
  return (
    <ul className={`space-y-1 ${compact ? "text-xs" : "text-sm"}`}>
      {issues.map((issue, i) => (
        <li
          key={i}
          className={`flex items-start gap-2 rounded-md px-2 py-1 ${
            issue.severity === "error"
              ? "bg-red-50 text-red-700"
              : issue.severity === "warning"
              ? "bg-amber-50 text-amber-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {issue.severity === "error" ? "✕" : issue.severity === "warning" ? "⚠" : "ℹ"}
          </span>
          <span className="flex-1">{displayMessage(issue)}</span>
          <ImportBadge status={issue.severity} />
        </li>
      ))}
    </ul>
  );
}
