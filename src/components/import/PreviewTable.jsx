// src/components/import/PreviewTable.jsx
// Reusable learner/academic-record preview with filtering by validation status
// (All / Valid / Warnings / Errors / Duplicates) and per-row expandable issues.
// Used by both the SF1 and SF10 importer preview steps.

import { useMemo, useState } from "react";
import ImportBadge from "./ImportBadge";
import IssueList from "./IssueList";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "valid", label: "Valid" },
  { key: "warning", label: "Warnings" },
  { key: "error", label: "Errors" },
  { key: "duplicates", label: "Duplicates" },
];

export default function PreviewTable({ records = [], columns = [], emptyText = "No records." }) {
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filter === "all") return true;
      if (filter === "duplicates") {
        const d = r.duplicate || {};
        return d.withinFile || d.crossFile || d.inFirestore || d.enrollment;
      }
      return r.severity === filter;
    });
  }, [records, filter]);

  const counts = useMemo(() => {
    const c = { all: records.length, valid: 0, warning: 0, error: 0, duplicates: 0 };
    records.forEach((r) => {
      if (r.severity === "valid") c.valid++;
      else if (r.severity === "warning") c.warning++;
      else if (r.severity === "error") c.error++;
      const d = r.duplicate || {};
      if (d.withinFile || d.crossFile || d.inFirestore || d.enrollment) c.duplicates++;
    });
    return c;
  }, [records]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f.key
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-2 font-medium">{c.label}</th>
              ))}
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((r) => (
              <PreviewRow
                key={r._id}
                record={r}
                columns={columns}
                expanded={expanded === r._id}
                onToggle={() => setExpanded(expanded === r._id ? null : r._id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">{emptyText}</p>
      )}
    </div>
  );
}

function PreviewRow({ record, columns, expanded, onToggle }) {
  const name = [record.learner?.lastName, record.learner?.firstName].filter(Boolean).join(", ") || "—";
  return (
    <>
      <tr
        className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors ${
          record.severity === "error"
            ? "bg-red-50/40 dark:bg-red-950/20"
            : record.severity === "warning"
            ? "bg-amber-50/40 dark:bg-amber-950/20"
            : ""
        }`}
        onClick={onToggle}
      >
        {columns.map((c) => (
          <td key={c.key} className="px-4 py-2.5 text-gray-700 dark:text-gray-200">
            {c.render ? c.render(record) : record.learner?.[c.key] ?? "—"}
          </td>
        ))}
        <td className="px-4 py-2.5">
          <ImportBadge status={record.severity} />
        </td>
        <td className="px-4 py-2.5 text-right text-gray-400 dark:text-gray-500">{expanded ? "▴" : "▾"}</td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-800/40">
          <td colSpan={columns.length + 2} className="px-4 py-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{name}</div>
            <IssueList issues={record.issues || []} />
          </td>
        </tr>
      )}
    </>
  );
}
