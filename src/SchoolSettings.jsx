// src/SchoolSettings.jsx
// The ICT Coordinator's single home for everything first-time Setup asked for:
// school identity, grade levels / DO 017 SHS configuration, branding, and the
// academic calendar -- all editable at any time, all behind one School
// Settings key.
//
// SetupWizard still runs once at install (no users exist yet); this page is
// how the ICT Coordinator changes any of those answers afterwards. Everything
// here stays hidden until the key is entered (see SettingsLockScreen), because
// these values re-shape every school form, report card and SF10 in the system.

import { useState } from "react";
import { ArrowLeft, Settings, Lock } from "lucide-react";
import SettingsLockScreen from "./components/settings/SettingsLockScreen.jsx";
import SchoolIdentityTab from "./components/settings/SchoolIdentityTab.jsx";
import GradeLevelsShsTab from "./components/settings/GradeLevelsShsTab.jsx";
import AcademicCalendarTab from "./components/settings/AcademicCalendarTab.jsx";
import SecurityTab from "./components/settings/SecurityTab.jsx";
import BrandingSettings from "./BrandingSettings";

const TABS = [
  { key: "identity", label: "School Identity" },
  { key: "gradeLevels", label: "Grade Levels & SHS" },
  { key: "branding", label: "Branding & Theme" },
  { key: "calendar", label: "Academic Calendar" },
  { key: "security", label: "Security" },
];

export default function SchoolSettings({ user, goBack }) {
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-slide-up">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-2">
          {goBack && (
            <button
              type="button"
              onClick={goBack}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Settings className="text-primary" size={24} />
              School Settings
            </h1>
            <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
              School identity, grade levels, branding and the academic calendar — everything first-time
              Setup asked for, editable any time.
            </p>
          </div>
        </div>

        {unlocked && (
          <button
            type="button"
            onClick={() => setUnlocked(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            <Lock size={14} />
            Lock
          </button>
        )}
      </div>

      {!unlocked ? (
        <SettingsLockScreen user={user} onUnlocked={() => setUnlocked(true)} />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-700 -mb-px" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary dark:text-primary-light"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pt-2">
            {activeTab === "identity" && <SchoolIdentityTab />}
            {activeTab === "gradeLevels" && <GradeLevelsShsTab />}
            {activeTab === "branding" && <BrandingSettings user={user} embedded />}
            {activeTab === "calendar" && <AcademicCalendarTab />}
            {activeTab === "security" && <SecurityTab user={user} />}
          </div>
        </>
      )}
    </div>
  );
}
