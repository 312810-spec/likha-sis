export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-16 px-4 text-center ${className}`}>
      {Icon && <Icon size={28} className="text-gray-300 dark:text-gray-600 mb-1" />}
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
      {description && <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
