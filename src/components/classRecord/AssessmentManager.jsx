// src/components/classRecord/AssessmentManager.jsx
// "Assessment Setup" panel shared by Written Works and Performance Tasks:
// one row per assessment item (its Highest Possible Score, and a Remove
// button), plus an "Add" button. Deliberately its own panel above the score
// table rather than tiny icon buttons buried in a table header (CLAUDE.md's
// Class Record redesign mandate for older teachers).

import { Plus } from "lucide-react";
import Button from "../Button.jsx";

export default function AssessmentManager({ title, itemLabel, items, onAdd, onHPSChange, onRemove }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5"
          >
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 min-w-[70px]">
              {itemLabel}{idx + 1}
            </span>
            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              Highest Possible Score
              <input
                type="number"
                min="0"
                value={item.hps || ""}
                onChange={(e) => onHPSChange(idx, e.target.value)}
                placeholder="0"
                className="w-20 h-11 px-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-base font-bold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
              />
            </label>
            <Button variant="danger" size="small" className="ml-auto" onClick={() => onRemove(item.id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button variant="secondary" onClick={onAdd}>
        <Plus size={16} /> Add {itemLabel === "WW" ? "Written Work" : "Performance Task"}
      </Button>
    </div>
  );
}
