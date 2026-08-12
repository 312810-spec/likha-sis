// src/components/import/StatCard.jsx
// Small summary tile for the import summary area.

export default function StatCard({ label, value, tone = "default" }) {
  const tones = {
    default: "text-gray-900",
    male: "text-blue-700",
    female: "text-pink-700",
    warning: "text-amber-600",
    error: "text-red-600",
    success: "text-green-700",
    primary: "text-primary",
  };
  return (
    <div className="flex-1 min-w-[140px] bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tones[tone] || tones.default}`}>{value}</div>
    </div>
  );
}
