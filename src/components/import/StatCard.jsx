// src/components/import/StatCard.jsx
// Small summary tile for the import summary area.

export default function StatCard({ label, value, tone = "default" }) {
  const tones = {
    default: "text-gray-900 dark:text-gray-100",
    male: "text-blue-700 dark:text-blue-400",
    female: "text-pink-700 dark:text-pink-400",
    warning: "text-amber-600 dark:text-amber-400",
    error: "text-red-600 dark:text-red-400",
    success: "text-green-700 dark:text-green-400",
    primary: "text-primary dark:text-primary-light",
  };
  return (
    <div className="flex-1 min-w-[140px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tones[tone] || tones.default}`}>{value}</div>
    </div>
  );
}
