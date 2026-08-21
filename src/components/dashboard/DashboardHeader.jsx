// src/components/dashboard/DashboardHeader.jsx
// Compact role-aware welcome section at the top of the Dashboard (spec §1).
import { ROLE_LABELS } from '../../utils/roles.js';
import { getCurrentTermForSchoolYear } from '../../academicCalendar.js';

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHeader({ displayName, userRoles = [], adviser, schoolYear, calendar, calendarLoading }) {
  const greeting = getGreeting();
  const roleLabel = (userRoles || []).map((r) => ROLE_LABELS[r] || r).join(' · ') || 'No roles assigned';
  const term = schoolYear && calendar ? getCurrentTermForSchoolYear(schoolYear, new Date(), calendar) : null;

  const scopeLine = adviser ? `${adviser.gradeLevel} — ${adviser.section}` : null;
  const calendarLine = calendarLoading
    ? null
    : [schoolYear ? `SY ${schoolYear}` : null, term ? term.label : null].filter(Boolean).join(' · ');

  return (
    <div className="mt-2">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {greeting}, {displayName}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{roleLabel}</p>
      {(scopeLine || calendarLine) && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
          {[scopeLine, calendarLine].filter(Boolean).join('  ·  ')}
        </p>
      )}
    </div>
  );
}
