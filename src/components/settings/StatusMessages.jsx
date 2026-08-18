// src/components/settings/StatusMessages.jsx
// Shared success/error banners for the School Settings tabs.

import { CheckCircle2, AlertCircle } from "lucide-react";

export default function StatusMessages({ successMessage, errorMessage }) {
  return (
    <>
      {successMessage && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-start gap-3 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 animate-fade-in">
          <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300 animate-fade-in">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}
    </>
  );
}
