// src/components/classRecord/WrittenWorksPanel.jsx
// Written Works score-entry tab. Shows only WW1/WW2/... raw scores -- no PS,
// WS, or grade columns here (see Results tab / Official ECR Preview).

import AssessmentManager from "./AssessmentManager.jsx";
import ScoreEntryTable from "./ScoreEntryTable.jsx";

export default function WrittenWorksPanel({
  weightPercent,
  learners,
  wwItems,
  onAddItem,
  onHPSChange,
  onRemoveItem,
  getScore,
  onScoreChange,
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
        Written Works — {weightPercent}%
      </h2>
      <AssessmentManager
        title="Assessment Setup"
        itemLabel="WW"
        items={wwItems}
        onAdd={onAddItem}
        onHPSChange={onHPSChange}
        onRemove={onRemoveItem}
      />
      <ScoreEntryTable
        learners={learners}
        items={wwItems.map((item, idx) => ({ id: item.id, hps: item.hps, label: `WW${idx + 1}` }))}
        getScore={getScore}
        onScoreChange={onScoreChange}
      />
    </div>
  );
}
