// src/components/import/ImportBadge.jsx
// Small colored status pill used across the SF1/SF10 importer UIs.

const STYLES = {
  valid: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  success: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  unreadable: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const LABELS = {
  valid: "Valid",
  success: "Success",
  warning: "Warnings",
  error: "Errors",
  blocked: "Blocked",
  unreadable: "Unreadable",
  info: "Info",
  neutral: "—",
};

export default function ImportBadge({ status, label }) {
  const cls = STYLES[status] || STYLES.neutral;
  const text = label || LABELS[status] || status;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}
    >
      {text}
    </span>
  );
}
