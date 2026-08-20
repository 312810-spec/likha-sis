// src/components/Tooltip.jsx
// Lightweight, dependency-free tooltip (CSS-only, no npm package) consistent
// with the project's existing pattern of avoiding new dependencies for small
// UI needs (see settingsLock.js using Web Crypto instead of a crypto lib).

const POSITION_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

export default function Tooltip({ label, children, position = 'top', className = '' }) {
  if (!label) return children;

  return (
    <span className={`relative inline-flex group/tooltip focus-within:z-10 ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 dark:bg-gray-700 ${POSITION_CLASSES[position] || POSITION_CLASSES.top}`}
      >
        {label}
      </span>
    </span>
  );
}
