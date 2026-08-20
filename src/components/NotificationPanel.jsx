// src/components/NotificationPanel.jsx
// The contents of the header bell dropdown: active alerts, recent
// announcements, and what's coming up in the next 30 days.

import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Megaphone,
  CalendarDays,
  ArrowRight,
} from 'lucide-react';
import { SEVERITY_LABELS } from '../utils/hazardAlerts.js';
import { ANNOUNCEMENT_TYPE_MAP } from '../utils/announcements.js';

const SEVERITY_STYLES = {
  danger: {
    icon: ShieldAlert,
    wrap: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900',
    text: 'text-red-700 dark:text-red-300',
    chip: 'bg-red-600 text-white',
  },
  warning: {
    icon: AlertTriangle,
    wrap: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900',
    text: 'text-amber-700 dark:text-amber-300',
    chip: 'bg-amber-500 text-white',
  },
  info: {
    icon: Info,
    wrap: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900',
    text: 'text-blue-700 dark:text-blue-300',
    chip: 'bg-blue-600 text-white',
  },
};

function SectionHeading({ children }) {
  return (
    <h5 className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
      {children}
    </h5>
  );
}

function AlertRow({ alert }) {
  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
  const Icon = style.icon;

  return (
    <div className={`mx-3 mb-2 rounded-lg border p-2.5 ${style.wrap}`}>
      <div className="flex items-start gap-2">
        <Icon size={15} className={`mt-0.5 flex-shrink-0 ${style.text}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-semibold ${style.text}`}>{alert.title}</span>
            <span className={`px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wide ${style.chip}`}>
              {SEVERITY_LABELS[alert.severity] || alert.severity}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-gray-600 dark:text-gray-300 line-clamp-3">
            {alert.detail}
          </p>
          {/*
            The official/automated distinction is load-bearing, not decoration:
            an Open-Meteo rainfall reading must never be mistaken for an actual
            NDRRMC bulletin or a real class suspension.
          */}
          <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
            {alert.official
              ? `Posted advisory — ${alert.source}`
              : `Automated reading — ${alert.source}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function AnnouncementRow({ announcement, onOpen }) {
  const type = ANNOUNCEMENT_TYPE_MAP[announcement.type];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-start gap-2">
        <Megaphone size={14} className="mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-800 dark:text-gray-100 line-clamp-2">
            {announcement.title}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
            {type?.label || 'Announcement'}
            {announcement.referenceNo ? ` — ${announcement.referenceNo}` : ''}
          </p>
        </div>
      </div>
    </button>
  );
}

function UpcomingRow({ entry }) {
  const date = new Date(`${entry.dateKey}T00:00:00`);
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="flex items-start gap-2 px-4 py-2">
      <CalendarDays size={14} className="mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-800 dark:text-gray-100 line-clamp-2">{entry.title}</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {label}
          {entry.subtitle ? ` — ${entry.subtitle}` : ''}
        </p>
      </div>
    </div>
  );
}

export default function NotificationPanel({ notifications, onNavigate }) {
  const { alerts, announcements, upcoming, isEmpty } = notifications;

  if (isEmpty) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
        You're all caught up.
      </div>
    );
  }

  return (
    <div className="max-h-[26rem] overflow-y-auto sidebar-scroll pb-2">
      {alerts.length > 0 && (
        <>
          <SectionHeading>Active Alerts</SectionHeading>
          {alerts.slice(0, 4).map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </>
      )}

      {announcements.length > 0 && (
        <>
          <SectionHeading>Recent Announcements</SectionHeading>
          {announcements.map((a) => (
            <AnnouncementRow
              key={a.id}
              announcement={a}
              onOpen={() => onNavigate('announcements')}
            />
          ))}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionHeading>Coming Up</SectionHeading>
          {upcoming.map((entry) => (
            <UpcomingRow key={`${entry.kind}-${entry.id || entry.title}-${entry.dateKey}`} entry={entry} />
          ))}
        </>
      )}

      <div className="mt-1 border-t border-gray-100 dark:border-gray-700 flex">
        <button
          type="button"
          onClick={() => onNavigate('announcements')}
          className="flex-1 flex items-center justify-center gap-1 px-4 py-2.5 text-[11px] font-medium text-primary dark:text-primary-light hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Announcements <ArrowRight size={12} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('schoolCalendar')}
          className="flex-1 flex items-center justify-center gap-1 px-4 py-2.5 text-[11px] font-medium text-primary dark:text-primary-light hover:bg-gray-50 dark:hover:bg-gray-800 border-l border-gray-100 dark:border-gray-700 transition-colors"
        >
          Calendar <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
