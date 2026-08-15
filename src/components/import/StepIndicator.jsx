// src/components/import/StepIndicator.jsx
// Horizontal step indicator used to show the import workflow progress.

export default function StepIndicator({ steps = [], current }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2 text-xs">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={step} className="flex items-center">
            {i > 0 && <span className="mx-2 text-gray-300 dark:text-gray-600">›</span>}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                state === "active"
                  ? "bg-primary text-white border-primary shadow-sm"
                  : state === "done"
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                  : "bg-white text-gray-400 border-gray-200 dark:bg-gray-900 dark:text-gray-500 dark:border-gray-700"
              }`}
            >
              {state === "done" ? "✓" : `${i + 1}.`} {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
