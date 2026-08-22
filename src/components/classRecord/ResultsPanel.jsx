// src/components/classRecord/ResultsPanel.jsx
// Read-only computed results: Initial Grade, Term Grade, Description per
// learner, plus a classroom-awareness summary. Teachers never type into this
// tab -- every value here comes from the same verified DO 15 pipeline used
// everywhere else in LIKHA-SIS (computeLearnerGrade, passed in from
// ClassRecord.jsx), never re-derived here.

import checkAutoFlagTriggers from "../../utils/autoFlagTriggers.js";
import { groupLearnersBySex } from "../../utils/sexGrouping.js";

function learnerName(learner) {
  const middle = learner.middleName ? ` ${learner.middleName.charAt(0)}.` : "";
  return `${learner.lastName || ""}, ${learner.firstName || ""}${middle}`;
}

function formatComputed(val) {
  return typeof val === "number" && !Number.isNaN(val) ? val.toFixed(2) : "—";
}

const DESCRIPTION_ORDER = ["Advancing", "Benchmarking", "Connecting", "Developing", "Emerging"];

function GroupHeaderRow({ label, count }) {
  return (
    <tr>
      <td
        colSpan={4}
        className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 sticky left-0"
      >
        {label} — {count}
      </td>
    </tr>
  );
}

function ResultsRow({ learner, grade, displayIndex }) {
  return (
    <tr className="even:bg-gray-50/60 dark:even:bg-gray-800/30 bg-white dark:bg-gray-900">
      <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-800 dark:text-gray-100 sticky left-0 bg-inherit break-words max-w-[240px]">
        <span className="text-gray-400 dark:text-gray-500 font-normal mr-2">{displayIndex}.</span>
        {learnerName(learner)}
      </td>
      <td className="px-3 py-2.5 text-center border-r border-gray-200 dark:border-gray-700 font-mono text-sm text-gray-700 dark:text-gray-300">
        {formatComputed(grade.initialGrade)}
      </td>
      <td className="px-3 py-2.5 text-center border-r border-gray-200 dark:border-gray-700 font-bold text-base text-gray-900 dark:text-gray-100">
        {grade.termGrade !== null ? grade.termGrade : "—"}
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 font-medium">
        {grade.description || "—"}
      </td>
    </tr>
  );
}

export default function ResultsPanel({ learners, computeLearnerGrade, term }) {
  const results = learners.map((learner) => ({ learner, grade: computeLearnerGrade(learner) }));

  const summary = { Advancing: 0, Benchmarking: 0, Connecting: 0, Developing: 0, Emerging: 0 };
  let needsAttention = 0;
  results.forEach(({ grade }) => {
    if (grade.description && summary[grade.description] !== undefined) {
      summary[grade.description] += 1;
    }
    if (checkAutoFlagTriggers({ initialGrade: grade.initialGrade })) {
      needsAttention += 1;
    }
  });

  const { male, female, unresolved } = groupLearnersBySex(learners);
  const gradeByLearnerId = new Map(results.map((r) => [r.learner.id, r.grade]));
  let runningIndex = 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{term} Results</h2>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-bold text-gray-800 dark:text-gray-100">{learners.length} Learners</span>
          {DESCRIPTION_ORDER.map((label) => (
            <span key={label} className="text-gray-600 dark:text-gray-300">
              {label} <span className="font-semibold text-gray-800 dark:text-gray-100">{summary[label]}</span>
            </span>
          ))}
          <span className="text-rose-700 dark:text-rose-400">
            Needs Attention <span className="font-semibold">{needsAttention}</span>
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-primary text-white sticky top-0 z-20 font-semibold text-sm">
                <th className="px-3 py-3 border-r border-white/20 sticky left-0 bg-primary min-w-[220px]">Learner Name</th>
                <th className="px-3 py-3 text-center border-r border-white/20 min-w-[110px]">Initial Grade</th>
                <th className="px-3 py-3 text-center border-r border-white/20 min-w-[110px]">Term Grade</th>
                <th className="px-3 py-3 min-w-[150px]">Description</th>
              </tr>
            </thead>
            <tbody>
              {learners.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    No learners found for this class.
                  </td>
                </tr>
              ) : (
                <>
                  {male.length > 0 && <GroupHeaderRow label="Male" count={male.length} />}
                  {male.map((l) => (
                    <ResultsRow key={l.id} learner={l} grade={gradeByLearnerId.get(l.id)} displayIndex={++runningIndex} />
                  ))}
                  {female.length > 0 && <GroupHeaderRow label="Female" count={female.length} />}
                  {female.map((l) => (
                    <ResultsRow key={l.id} learner={l} grade={gradeByLearnerId.get(l.id)} displayIndex={++runningIndex} />
                  ))}
                  {unresolved.length > 0 && <GroupHeaderRow label="Needs Sex Assignment" count={unresolved.length} />}
                  {unresolved.map((l) => (
                    <ResultsRow key={l.id} learner={l} grade={gradeByLearnerId.get(l.id)} displayIndex={++runningIndex} />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
