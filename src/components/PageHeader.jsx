import { ArrowLeft } from "lucide-react";

// Canonical in-content page header. The dashboard shell already renders the
// page title + "Welcome, {user}" row, so this component supplies only what
// the shell doesn't: a one-line description, context selectors, and the
// primary action(s) for the screen. See docs/ui-ux/DESIGN-DIRECTION.md #1.
export default function PageHeader({ description, actions, backTo, children }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div className="min-w-0">
        {backTo && (
          <button
            type="button"
            onClick={backTo.onClick}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light mb-1 transition-colors"
          >
            <ArrowLeft size={14} /> {backTo.label}
          </button>
        )}
        {description && <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>}
        {children && <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
