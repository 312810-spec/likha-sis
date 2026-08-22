// src/components/classRecord/ScoreEntryTable.jsx
// Shared score-entry table for the Written Works, Performance Tasks, and
// Summative Tests & Term Exam tabs. Deliberately shows ONLY raw scores and
// Highest Possible Score -- no PS/WS/Initial Grade/Term Grade columns here
// (those stay on the Results tab and Official ECR Preview), so a teacher
// entering scores isn't confronted with computed columns they don't need
// yet. Learners are grouped Male then Female (see utils/sexGrouping.js),
// each group still alphabetical, matching the standing LIKHA-SIS convention
// used by SF1/SF2.
//
// Sized for older teachers per CLAUDE.md's Class Record redesign mandate:
// comfortable row height, 14px+ text, large inputs, sticky learner-name
// column, sticky header.

import { groupLearnersBySex } from "../../utils/sexGrouping.js";

function learnerName(learner) {
  const middle = learner.middleName ? ` ${learner.middleName.charAt(0)}.` : "";
  return `${learner.lastName || ""}, ${learner.firstName || ""}${middle}`;
}

function GroupHeaderRow({ label, count, columnCount }) {
  return (
    <tr>
      <td
        colSpan={columnCount}
        className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 sticky left-0"
      >
        {label} — {count}
      </td>
    </tr>
  );
}

export default function ScoreEntryTable({ learners, items, getScore, onScoreChange }) {
  const { male, female, unresolved } = groupLearnersBySex(learners);
  const columnCount = items.length + 1;

  function renderLearnerRow(learner, displayIndex) {
    return (
      <tr
        key={learner.id}
        className="even:bg-gray-50/60 dark:even:bg-gray-800/30 bg-white dark:bg-gray-900"
      >
        <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-800 dark:text-gray-100 sticky left-0 bg-inherit break-words max-w-[240px]">
          <span className="text-gray-400 dark:text-gray-500 font-normal mr-2">{displayIndex}.</span>
          {learnerName(learner)}
        </td>
        {items.map((item) => (
          <td key={item.id} className="px-2 py-2 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="number"
              min="0"
              max={item.hps || undefined}
              value={getScore(learner.id, item.id)}
              onChange={(e) => onScoreChange(learner.id, item.id, e.target.value)}
              className="w-20 h-11 px-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-base text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
              aria-label={`${learnerName(learner)} — ${item.label}`}
            />
          </td>
        ))}
      </tr>
    );
  }

  let runningIndex = 0;
  const maleRows = male.map((l) => renderLearnerRow(l, ++runningIndex));
  const femaleRows = female.map((l) => renderLearnerRow(l, ++runningIndex));
  const unresolvedRows = unresolved.map((l) => renderLearnerRow(l, ++runningIndex));

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto max-h-[65vh]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-primary text-white sticky top-0 z-20 font-semibold text-sm">
              <th className="px-3 py-3 border-r border-white/20 sticky left-0 bg-primary min-w-[220px]">
                Learner Name
              </th>
              {items.map((item) => (
                <th key={item.id} className="px-2 py-3 text-center border-r border-white/20 min-w-[90px]">
                  <div>{item.label}</div>
                  <div className="text-[11px] font-normal text-white/80">HPS {item.hps || 0}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {learners.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No learners found for this class.
                </td>
              </tr>
            ) : (
              <>
                {male.length > 0 && <GroupHeaderRow label="Male" count={male.length} columnCount={columnCount} />}
                {maleRows}
                {female.length > 0 && <GroupHeaderRow label="Female" count={female.length} columnCount={columnCount} />}
                {femaleRows}
                {unresolved.length > 0 && (
                  <GroupHeaderRow label="Needs Sex Assignment" count={unresolved.length} columnCount={columnCount} />
                )}
                {unresolvedRows}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
