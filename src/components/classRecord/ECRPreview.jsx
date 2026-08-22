// src/components/classRecord/ECRPreview.jsx
// Official ECR Preview: the familiar wide spreadsheet-style combined view
// (raw scores + PS/WS/Initial Grade/Term Grade/Description together), for
// teachers who want the traditional layout to review or print. Read-only --
// all editing happens on the Written Works / Performance Tasks / Summative
// Tests & Term Exam tabs, so there is only ever one place scores are typed.
// Every number here comes from the same computeLearnerGrade pipeline the
// other tabs use -- no second formula system.

import Tooltip from "../Tooltip.jsx";
import { groupLearnersBySex } from "../../utils/sexGrouping.js";

function learnerName(learner) {
  const middle = learner.middleName ? ` ${learner.middleName.charAt(0)}.` : "";
  return `${learner.lastName || ""}, ${learner.firstName || ""}${middle}`;
}

function formatComputed(val, decimals = 2) {
  return typeof val === "number" && !Number.isNaN(val) ? val.toFixed(decimals) : "—";
}

export default function ECRPreview({ learners, wwItems, ptItems, scores, subjectWeights, computeLearnerGrade }) {
  const { male, female, unresolved } = groupLearnersBySex(learners);
  const columnCount = wwItems.length + ptItems.length + 14;

  function renderRow(learner, displayIndex) {
    const learnerScore = scores[learner.id] || {};
    const { wwPS, wwWS, ptPS, ptWS, exPS, exWS, initialGrade, termGrade, description } = computeLearnerGrade(learner);

    return (
      <tr
        key={learner.id}
        className="even:bg-gray-50/50 dark:even:bg-gray-800/30 bg-white dark:bg-gray-900 text-xs"
      >
        <td className="px-3 py-1.5 border-r border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-gray-100 sticky left-0 bg-inherit break-words max-w-[220px]">
          <span className="text-gray-400 dark:text-gray-500 font-normal mr-2">{displayIndex}.</span>
          {learnerName(learner)}
        </td>

        {wwItems.map((item) => (
          <td key={item.id} className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 font-mono">
            {learnerScore.ww?.[item.id] ?? "—"}
          </td>
        ))}
        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono">{formatComputed(wwPS)}</td>
        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono">{formatComputed(wwWS)}</td>

        {ptItems.map((item) => (
          <td key={item.id} className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 font-mono">
            {learnerScore.pt?.[item.id] ?? "—"}
          </td>
        ))}
        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono">{formatComputed(ptPS)}</td>
        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono">{formatComputed(ptWS)}</td>

        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 font-mono">{learnerScore.st1 ?? "—"}</td>
        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 font-mono">{learnerScore.st2 ?? "—"}</td>
        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 font-mono">{learnerScore.te ?? "—"}</td>
        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono">{formatComputed(exPS)}</td>
        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 font-mono">{formatComputed(exWS)}</td>

        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/10 dark:bg-accent/20 font-mono font-medium">{formatComputed(initialGrade)}</td>
        <td className="px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 bg-accent/20 dark:bg-accent/30 font-bold">{termGrade !== null ? termGrade : "—"}</td>
        <td className="px-2 py-1.5 text-left bg-gray-50 dark:bg-gray-800/40 text-[11px] font-medium break-words max-w-[150px]">{description || "—"}</td>
      </tr>
    );
  }

  let runningIndex = 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Official ECR Preview</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        The familiar full spreadsheet view, for reference only — enter scores on the Written Works,
        Performance Tasks, and Summative Tests & Term Exam tabs.
      </p>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-primary text-white sticky top-0 z-20 font-semibold border-b border-primary-dark">
                <th className="px-3 py-2 border-r border-white/20 sticky left-0 bg-primary min-w-[200px]" rowSpan={2}>
                  Learner Name
                </th>
                <th className="px-2 py-1.5 text-center border-r border-white/20" colSpan={wwItems.length + 2}>
                  WRITTEN WORKS ({(subjectWeights.ww * 100).toFixed(0)}%)
                </th>
                <th className="px-2 py-1.5 text-center border-r border-white/20" colSpan={ptItems.length + 2}>
                  PERFORMANCE TASKS ({(subjectWeights.pt * 100).toFixed(0)}%)
                </th>
                <th className="px-2 py-1.5 text-center border-r border-white/20" colSpan={5}>
                  SUMMATIVE TESTS &amp; TERM EXAM ({(subjectWeights.ex * 100).toFixed(0)}%)
                </th>
                <th className="px-2 py-1.5 text-center" colSpan={3}>
                  SUMMARY
                </th>
              </tr>
              <tr className="bg-primary-light text-white sticky top-[33px] z-20 text-[11px] font-semibold border-b border-primary-dark">
                {wwItems.map((item, idx) => (
                  <th key={item.id} className="px-2 py-1.5 text-center border-r border-white/20 min-w-[55px]">WW{idx + 1}</th>
                ))}
                <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[55px]">
                  <Tooltip position="bottom" label="Written Works Percentage Score">WW PS</Tooltip>
                </th>
                <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[55px]">
                  <Tooltip position="bottom" label="Written Works Weighted Score">WW WS</Tooltip>
                </th>
                {ptItems.map((item, idx) => (
                  <th key={item.id} className="px-2 py-1.5 text-center border-r border-white/20 min-w-[55px]">PT{idx + 1}</th>
                ))}
                <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[55px]">
                  <Tooltip position="bottom" label="Performance Tasks Percentage Score">PT PS</Tooltip>
                </th>
                <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[55px]">
                  <Tooltip position="bottom" label="Performance Tasks Weighted Score">PT WS</Tooltip>
                </th>
                <th className="px-2 py-1.5 text-center border-r border-white/20 min-w-[50px]">ST1</th>
                <th className="px-2 py-1.5 text-center border-r border-white/20 min-w-[50px]">ST2</th>
                <th className="px-2 py-1.5 text-center border-r border-white/20 min-w-[50px]">Term Exam</th>
                <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[55px]">
                  <Tooltip position="bottom" label="Exam Percentage Score">EX PS</Tooltip>
                </th>
                <th className="px-2 py-1.5 text-center border-r border-white/20 bg-primary-dark/40 min-w-[55px]">
                  <Tooltip position="bottom" label="Exam Weighted Score">EX WS</Tooltip>
                </th>
                <th className="px-2 py-1.5 text-center border-r border-white/20 bg-accent-dark/80 min-w-[65px]">Init Grade</th>
                <th className="px-2 py-1.5 text-center border-r border-white/20 bg-accent-dark/90 min-w-[65px]">Term Grade</th>
                <th className="px-2 py-1.5 text-center min-w-[130px]">Description</th>
              </tr>
            </thead>
            <tbody>
              {learners.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No learners found for this class.
                  </td>
                </tr>
              ) : (
                <>
                  {male.length > 0 && (
                    <tr>
                      <td colSpan={columnCount} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 sticky left-0">
                        Male — {male.length}
                      </td>
                    </tr>
                  )}
                  {male.map((l) => renderRow(l, ++runningIndex))}
                  {female.length > 0 && (
                    <tr>
                      <td colSpan={columnCount} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 sticky left-0">
                        Female — {female.length}
                      </td>
                    </tr>
                  )}
                  {female.map((l) => renderRow(l, ++runningIndex))}
                  {unresolved.length > 0 && (
                    <tr>
                      <td colSpan={columnCount} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 sticky left-0">
                        Needs Sex Assignment — {unresolved.length}
                      </td>
                    </tr>
                  )}
                  {unresolved.map((l) => renderRow(l, ++runningIndex))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
