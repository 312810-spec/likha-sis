// src/components/classRecord/PerformanceTasksPanel.jsx
// Performance Tasks score-entry tab -- same shape as Written Works.

import AssessmentManager from "./AssessmentManager.jsx";
import ScoreEntryTable from "./ScoreEntryTable.jsx";

export default function PerformanceTasksPanel({
  weightPercent,
  learners,
  ptItems,
  onAddItem,
  onHPSChange,
  onRemoveItem,
  getScore,
  onScoreChange,
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
        Performance Tasks — {weightPercent}%
      </h2>
      <AssessmentManager
        title="Assessment Setup"
        itemLabel="PT"
        items={ptItems}
        onAdd={onAddItem}
        onHPSChange={onHPSChange}
        onRemove={onRemoveItem}
      />
      <ScoreEntryTable
        learners={learners}
        items={ptItems.map((item, idx) => ({ id: item.id, hps: item.hps, label: `PT${idx + 1}` }))}
        getScore={getScore}
        onScoreChange={onScoreChange}
      />
    </div>
  );
}
