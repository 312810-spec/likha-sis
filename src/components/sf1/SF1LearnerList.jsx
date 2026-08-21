// src/components/sf1/SF1LearnerList.jsx
// The Edit Mode learner list: compact Male/Female cards (not a dense
// spreadsheet) plus the Needs Sex Assignment quick-fix area. Each card opens
// the single-learner editor (SF1LearnerEditor) rather than editing inline.

import { UserPlus, Pencil } from "lucide-react";
import { calculateSf1Age } from "../../utils/sf1Age.js";

const CARD_CLASS =
  "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3";
const ADD_BUTTON_CLASS =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors min-h-[44px] w-full justify-center";

function learnerName(l) {
  const first = [l.firstName, l.nameExtension].filter(Boolean).join(" ");
  const tail = [first, l.middleName].filter(Boolean).join(" ");
  return [l.lastName, tail].filter(Boolean).join(", ") || "(No name entered)";
}

function formatBirthDate(value) {
  const s = String(value || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return iso ? `${iso[2]}/${iso[3]}/${iso[1]}` : s || "Birth date not set";
}

function LearnerCard({ index, learner, schoolYear, number, onEdit }) {
  const age = calculateSf1Age(learner.birthDate, schoolYear);
  return (
    <li className={CARD_CLASS}>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {number}. {learnerName(learner)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          LRN: {learner.lrn || "Not set"} · Birth Date: {formatBirthDate(learner.birthDate)}
          {age !== "" && ` · Age: ${age}`}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onEdit(index)}
        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
      >
        <Pencil size={15} />
        Edit Learner
      </button>
    </li>
  );
}

export default function SF1LearnerList({
  males,
  females,
  unresolvedSex,
  schoolYear,
  onEditLearner,
  onAddLearner,
  onQuickSex,
}) {
  return (
    <div className="space-y-6">
      {unresolvedSex.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Needs Sex Assignment</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
            {unresolvedSex.length} learner{unresolvedSex.length === 1 ? "" : "s"} need
            {unresolvedSex.length === 1 ? "s" : ""} Male/Female information before SF1 can be finalized.
          </p>
          <ul className="mt-3 space-y-2">
            {unresolvedSex.map(({ index, learner }) => (
              <li key={index} className={CARD_CLASS}>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {learnerName(learner)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onQuickSex(index, "M")}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickSex(index, "F")}
                    className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
                  >
                    Female
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
          Male Learners — {males.length}
        </h3>
        <ul className="space-y-2">
          {males.map(({ index, learner }, i) => (
            <LearnerCard key={index} index={index} learner={learner} schoolYear={schoolYear} number={i + 1} onEdit={onEditLearner} />
          ))}
        </ul>
        <button type="button" onClick={() => onAddLearner("M")} className={`${ADD_BUTTON_CLASS} mt-3`}>
          <UserPlus size={16} />
          Add Male Learner
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
          Female Learners — {females.length}
        </h3>
        <ul className="space-y-2">
          {females.map(({ index, learner }, i) => (
            <LearnerCard key={index} index={index} learner={learner} schoolYear={schoolYear} number={i + 1} onEdit={onEditLearner} />
          ))}
        </ul>
        <button type="button" onClick={() => onAddLearner("F")} className={`${ADD_BUTTON_CLASS} mt-3`}>
          <UserPlus size={16} />
          Add Female Learner
        </button>
      </div>
    </div>
  );
}
