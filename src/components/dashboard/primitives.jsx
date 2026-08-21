// src/components/dashboard/primitives.jsx
// Shared presentational building blocks for the role-aware Dashboard widgets.
// Component-only exports (see src/utils/dashboardFormatters.js for the
// plain formatting helpers -- react-refresh/only-export-components requires
// a file to export either components or plain values, not a mix).
import { Inbox } from 'lucide-react';

export function StatTile({ icon: Icon, tint, label, children }) {
  return (
    <div className="flex-1 min-w-[180px] bg-white border border-gray-200 rounded-xl p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3 dark:bg-gray-900 dark:border-gray-700">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${tint}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">{label}</div>
        <div className="font-tabular text-base font-semibold mt-0.5 text-gray-900 dark:text-gray-100 break-words">{children}</div>
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return <div className="h-5 w-14 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />;
}

export function TileEmptyState({ icon: Icon = Inbox, text }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
      <Icon size={13} className="flex-shrink-0" />
      <span className="break-words">{text}</span>
    </span>
  );
}

export function EmptyState({ icon: Icon = Inbox, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
      <Icon size={22} className="text-gray-300 dark:text-gray-600" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}

export function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 shadow-card dark:bg-gray-900 dark:border-gray-700 ${className}`}>
      {title && <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>}
      {children}
    </div>
  );
}
