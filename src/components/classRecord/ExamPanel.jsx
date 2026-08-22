// src/components/classRecord/ExamPanel.jsx
// Summative Tests & Term Exam tab. Fixed ST1 (30%) / ST2 (30%) / Term Exam
// (40%) split -- this is the existing verified DO 15 exam-component formula
// (see utils/gradeComputations.js computeExamPS), never re-derived here.
// When a subject's configured weights have no exam component at all (Tech-
// Pro subjects, DO 15's 20/80/0 profile), this tab shows a plain explanation
// instead of three score columns nobody should fill in.

import ScoreEntryTable from "./ScoreEntryTable.jsx";

const EXAM_ITEMS = [
  { key: "st1", label: "ST1", title: "Summative Test 1", percentOfComponent: 30 },
  { key: "st2", label: "ST2", title: "Summative Test 2", percentOfComponent: 30 },
  { key: "te", label: "Term Exam", title: "Term Examination", percentOfComponent: 40 },
];

export default function ExamPanel({ weightPercent, learners, exHPS, onHPSChange, getScore, onScoreChange }) {
  if (weightPercent === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Summative Tests & Term Exam</h2>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-6 text-sm text-gray-600 dark:text-gray-300">
          This subject does not use the Summative Tests & Term Exam component in its configured grading
          weights.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
        Summative Tests & Term Exam — {weightPercent}%
      </h2>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Assessment Setup</h3>
        <div className="space-y-2">
          {EXAM_ITEMS.map((item) => (
            <div
              key={item.key}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5"
            >
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 min-w-[140px]">
                {item.title}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {item.percentOfComponent}% of this component
              </span>
              <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 ml-auto">
                Highest Possible Score
                <input
                  type="number"
                  min="0"
                  value={exHPS[item.key] || ""}
                  onChange={(e) => onHPSChange(item.key, e.target.value)}
                  placeholder="0"
                  className="w-20 h-11 px-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-base font-bold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <ScoreEntryTable
        learners={learners}
        items={EXAM_ITEMS.map((item) => ({ id: item.key, hps: exHPS[item.key], label: item.label }))}
        getScore={getScore}
        onScoreChange={onScoreChange}
      />
    </div>
  );
}
