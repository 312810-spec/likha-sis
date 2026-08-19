// src/components/settings/settingsStyles.js
// Shared Tailwind class strings for the School Settings tabs, so every tab
// renders identical inputs and labels without copy-pasting the class list.

export const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors";

export const labelClass =
  "flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300";

export const cardClass =
  "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm";

export const primaryButtonClass =
  "inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-light active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed";
