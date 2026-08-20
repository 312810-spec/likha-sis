import { ArrowLeft } from 'lucide-react';

export default function PageHeader({ icon: Icon, title, description, onBack, actions }) {
  return (
    <div className="mb-4 sm:mb-5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <span className="flex-shrink-0 p-2 bg-accent/10 text-accent-dark dark:text-accent-light rounded-md">
              <Icon size={20} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 truncate">{title}</h1>
            {description && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
