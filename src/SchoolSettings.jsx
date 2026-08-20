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
import { Lock } from "lucide-react";
import PageHeader from "./components/PageHeader.jsx";
import SettingsLockScreen from "./components/settings/SettingsLockScreen.jsx";
import SchoolIdentityTab from "./components/settings/SchoolIdentityTab.jsx";
import GradeLevelsShsTab from "./components/settings/GradeLevelsShsTab.jsx";
import SectionsShiftsTab from "./components/settings/SectionsShiftsTab.jsx";
import AcademicCalendarTab from "./components/settings/AcademicCalendarTab.jsx";
import SecurityTab from "./components/settings/SecurityTab.jsx";
import BrandingSettings from "./BrandingSettings";

const TABS = [
  { key: "identity", label: "School Identity" },
  { key: "gradeLevels", label: "Grade Levels & SHS" },
  { key: "sections", label: "Sections & Shifts" },
  { key: "branding", label: "Branding & Theme" },
  { key: "calendar", label: "Academic Calendar" },
  { key: "security", label: "Security" },
];

export default function SchoolSettings({ user }) {
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6 pb-12">
      <PageHeader
        description="School identity, grade levels, sections, shifts, branding and the academic calendar — everything first-time Setup asked for, editable any time."
        actions={
          unlocked && (
            <button
              type="button"
              onClick={() => setUnlocked(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
            >
              <Lock size={14} />
              Lock
            </button>
          )
        }
      />

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
            {activeTab === "sections" && <SectionsShiftsTab />}
            {activeTab === "branding" && <BrandingSettings user={user} embedded />}
            {activeTab === "calendar" && <AcademicCalendarTab />}
            {activeTab === "security" && <SecurityTab user={user} />}
          </div>
        </>
      )}
    </div>
  );
}
