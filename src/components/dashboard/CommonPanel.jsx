// src/components/dashboard/CommonPanel.jsx
// Information safe/relevant for every staff role, including stakeholder
// (spec §2, §10): current SY/Term context lives in DashboardHeader; this
// panel is the small "what's coming up" preview -- school events, official
// DepEd calendar entries, PAGASA advisories, and recent announcements --
// plus the existing local WeatherCard. Bounded, limit()-capped reads only;
// no learner/attendance/LARDO/nutrition data is ever touched here.
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { CalendarClock, Megaphone } from 'lucide-react';
import { db } from '../../firebase.js';
import { getUpcomingEntries } from '../../utils/schoolCalendar.js';
import { getRecentAnnouncements } from '../../utils/announcements.js';
import { SectionCard, EmptyState } from './primitives.jsx';
import WeatherCard from '../WeatherCard.jsx';

async function safeDocs(q) {
  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return null;
  }
}

export default function CommonPanel({ onOpenSettings }) {
  const [state, setState] = useState({ loading: true, error: false, upcoming: [], announcements: [] });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [events, announcements, advisories, deped] = await Promise.all([
        safeDocs(query(collection(db, 'schoolEvents'), limit(25))),
        safeDocs(query(collection(db, 'announcements'), limit(25))),
        safeDocs(query(collection(db, 'weatherAdvisories'), orderBy('issuedAt', 'desc'), limit(10))),
        safeDocs(query(collection(db, 'depedCalendarEvents'), limit(25))),
      ]);
      if (cancelled) return;

      const allFailed = events === null && announcements === null && advisories === null && deped === null;
      const upcoming = getUpcomingEntries(
        {
          schoolEvents: events || [],
          announcements: announcements || [],
          weatherAdvisories: advisories || [],
          depedCalendarEvents: deped || [],
          limit: 5,
        },
        new Date(),
        60
      );
      const recentAnnouncements = getRecentAnnouncements(announcements || [], new Date(), 14).slice(0, 5);

      setState({ loading: false, error: allFailed, upcoming, announcements: recentAnnouncements });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="space-y-4">
      <WeatherCard onOpenSettings={onOpenSettings} />

      <SectionCard>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:bg-primary/20 flex items-center justify-center shrink-0">
            <CalendarClock size={17} />
          </div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upcoming</h4>
        </div>
        <div className="mt-3">
          {state.loading ? (
            <div className="space-y-2 animate-pulse">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-6 rounded-lg bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : state.upcoming.length === 0 ? (
            <EmptyState text={state.error ? 'Unable to load right now.' : 'No upcoming events.'} />
          ) : (
            <ul className="space-y-2">
              {state.upcoming.map((entry, i) => (
                <li key={`${entry.kind}-${entry.id || entry.title}-${i}`} className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-medium break-words">{entry.title}</span>
                  <span className="block text-xs text-gray-400 dark:text-gray-500">
                    {entry.dateKey} · {entry.subtitle}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent-dark dark:bg-accent/20 flex items-center justify-center shrink-0">
            <Megaphone size={17} />
          </div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Announcements</h4>
        </div>
        <div className="mt-3">
          {state.loading ? (
            <div className="space-y-2 animate-pulse">
              {[0, 1].map((i) => (
                <div key={i} className="h-6 rounded-lg bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : state.announcements.length === 0 ? (
            <EmptyState text={state.error ? 'Unable to load right now.' : 'No announcements yet.'} />
          ) : (
            <ul className="space-y-2">
              {state.announcements.map((a) => (
                <li key={a.id} className="text-sm text-gray-700 dark:text-gray-200 break-words">
                  <span className="font-medium">{a.title}</span>
                  {a.priority === 'urgent' && (
                    <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">Urgent</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>
    </aside>
  );
}
