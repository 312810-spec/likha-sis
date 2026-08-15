// src/pages/ImportCenter.jsx
// Landing page for the Import Center. Links to the SF1 Bulk Importer and the
// SF10 Importer. Follows the existing LIKHA-SIS Tailwind visual style.

import { FileSpreadsheet, FileText, ArrowRight, UploadCloud } from "lucide-react";

export default function ImportCenter({ onNavigate }) {
  const cards = [
    {
      key: "sf1Import",
      title: "SF1 Bulk Import",
      description:
        "Upload existing DepEd SF1 (Learner's Information Sheet) .xls/.xlsx files in a batch. The system analyzes each workbook, detects its structure, extracts and validates learner records, flags duplicates and conflicts, and only imports approved records into Firestore.",
      icon: FileSpreadsheet,
      accent: "bg-primary",
      fileNote: ".xls · .xlsx · batch upload",
    },
    {
      key: "sf10Import",
      title: "SF10 Import",
      description:
        "Upload SF10 (Learner's Permanent Academic Record) files. Extract learner identity and learning-area grades, validate them, then import approved academic records linked to each learner by LRN.",
      icon: FileText,
      accent: "bg-leaf",
      fileNote: ".xls · .xlsx",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
          <UploadCloud size={22} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Center</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload DepEd Excel files, review the detected &amp; validated records, then import them safely.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onNavigate(card.key)}
              className="text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:border-primary dark:hover:border-primary-light hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl ${card.accent} text-white flex items-center justify-center shrink-0 shadow-sm`}
                >
                  <Icon size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{card.title}</h3>
                    <ArrowRight
                      size={18}
                      className="text-gray-300 dark:text-gray-600 group-hover:text-primary dark:group-hover:text-primary-light group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{card.description}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 font-medium">{card.fileNote}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
