import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Users,
  CheckCircle2,
  FileText,
  CalendarDays,
  Plus,
  ClipboardList,
  FilePlus2,
  ShieldAlert,
  Inbox,
  LifeBuoy,
  Activity,
  UserPlus,
} from 'lucide-react';
import { db } from './firebase';
import { canAccessPage } from './pageAccess.js';
import WeatherCard from './components/WeatherCard.jsx';
import useAcademicCalendar from './hooks/useAcademicCalendar';

function formatCount(n) {
  return Number(n || 0).toLocaleString('en-US');
}

// Firestore timestamps may arrive as `Date`, an object with `toMillis()`, a
// `{ seconds, nanoseconds }` object, or an ISO string. Normalize to epoch ms.
function timestampToMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

function formatActivityDate(value) {
  const ms = timestampToMillis(value);
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatTile({ icon: Icon, tint, label, children }) {
  return (
    <div className="flex-1 min-w-[180px] bg-white border border-gray-200 rounded-xl p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3 dark:bg-gray-900 dark:border-gray-700">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${tint}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">{label}</div>
        <div className="font-tabular text-base font-semibold mt-0.5 text-gray-900 dark:text-gray-100 truncate">{children}</div>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return <div className="h-5 w-14 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />;
}

function TileEmptyState({ icon: Icon = Inbox, text }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
      <Icon size={13} className="flex-shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

function EmptyState({ icon: Icon = Inbox, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
      <Icon size={22} className="text-gray-300 dark:text-gray-600" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}

function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 shadow-card dark:bg-gray-900 dark:border-gray-700 ${className}`}>
      {title && <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>}
      {children}
    </div>
  );
}

function LardoRiskSummary({ goToLardo }) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadFlags() {
      setLoading(true);
      try {
        const q = query(collection(db, 'lardoRecords'), where('status', '==', 'monitoring'));
        const snap = await getDocs(q);
        if (!cancelled) setRecords(snap.docs.map((d) => d.data()));
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFlags();
    return () => {
      cancelled = true;
    };
  }, []);

  const riskFactorCounts = records.reduce((acc, r) => {
    (r.riskFactors || []).forEach((f) => {
      acc[f] = (acc[f] || 0) + 1;
    });
    return acc;
  }, {});
  const topRiskFactors = Object.entries(riskFactorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <SectionCard className="animate-fade-in">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 flex items-center justify-center shrink-0">
          <ShieldAlert size={17} />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">LARDO At-Risk Learners</h4>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2 animate-pulse">
          <div className="h-7 w-12 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`font-tabular text-3xl font-bold ${records.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {records.length}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-300">
              learner{records.length === 1 ? '' : 's'} flagged for monitoring
            </span>
          </div>

          {topRiskFactors.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {topRiskFactors.map(([factor, count]) => (
                <li
                  key={factor}
                  className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2.5 py-1 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                >
                  {factor}
                  <span className="text-red-500 dark:text-red-400">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button
        onClick={goToLardo}
        className="mt-4 w-full bg-primary text-white px-3 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-primary-light active:scale-[0.99] transition-all duration-150"
      >
        Open LARDO Tracking
      </button>
    </SectionCard>
  );
}

function Dashboard({ goToSF1, goToSF2, goToViewLearners, goToLardo, goToSchoolSettings, userRoles }) {
  const canSeeLardo = canAccessPage('lardoTracking', userRoles);
  // Only offer the "set your coordinates" shortcut to roles that can actually
  // open School Settings — otherwise it's a link into an access-denied page.
  const canEditSchoolSettings = canAccessPage('schoolSettings', userRoles);

  // Live school year options come from School Settings > Academic Calendar
  // (layered over the built-in fallback) via the shared hook.
  const { schoolYears, loading: calendarLoading } = useAcademicCalendar();
  const currentSchoolYear = schoolYears?.[0] || null;

  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [learnerStats, setLearnerStats] = useState({
    total: 0,
    active: 0,
    transferredOut: 0,
    gradeLevels: 0,
    recent: [],
  });
  // null => not loaded yet (or failed); number => SF2 attendance sheets on file.
  const [sf2Count, setSf2Count] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setStatsLoading(true);
      setStatsError(false);
      try {
        const [learnersResult, attendanceResult] = await Promise.allSettled([
          getDocs(collection(db, 'learners')),
          getDocs(collection(db, 'attendance')),
        ]);
        if (cancelled) return;

        if (learnersResult.status === 'rejected') throw learnersResult.reason;

        const learners = learnersResult.value.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        // Legacy learner docs saved before TransfersLog may lack an
        // enrollmentStatus; the app treats a missing status as "active".
        const active = learners.filter((l) => (l.enrollmentStatus || 'active') === 'active').length;
        const transferredOut = learners.filter((l) => l.enrollmentStatus === 'transferred-out').length;
        const gradeLevels = new Set(learners.map((l) => l.gradeLevel).filter(Boolean)).size;
        const recent = learners
          .map((l) => ({ learner: l, ts: timestampToMillis(l.createdAt) }))
          .filter((x) => x.ts > 0)
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 5)
          .map((x) => x.learner);

        if (!cancelled) {
          setLearnerStats({ total: learners.length, active, transferredOut, gradeLevels, recent });
          setSf2Count(attendanceResult.status === 'fulfilled' ? attendanceResult.value.size : null);
        }
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
        if (!cancelled) setStatsError(true);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100">
      <div className="flex flex-wrap gap-3 mt-4">
        <StatTile icon={Users} tint="bg-primary/10 text-primary dark:bg-primary/20" label="Total Learners">
          {statsLoading ? <StatSkeleton /> : statsError ? <TileEmptyState text="Stats unavailable" /> : learnerStats.total === 0 ? <TileEmptyState text="No learners yet." /> : formatCount(learnerStats.total)}
        </StatTile>
        <StatTile icon={CheckCircle2} tint="bg-leaf/10 text-leaf dark:bg-leaf/20" label="Enrollment">
          {statsLoading ? <StatSkeleton /> : statsError ? <TileEmptyState text="Stats unavailable" /> : learnerStats.active === 0 ? <TileEmptyState text="No enrollment yet." /> : `${formatCount(learnerStats.active)} active`}
        </StatTile>
        <StatTile icon={FileText} tint="bg-accent/10 text-accent-dark dark:bg-accent/20" label="School Forms">
          {statsLoading ? <StatSkeleton /> : statsError || sf2Count === null ? <TileEmptyState text="No forms yet." /> : learnerStats.total === 0 && sf2Count === 0 ? <TileEmptyState text="No forms yet." /> : `SF1 ${formatCount(learnerStats.total)} · SF2 ${formatCount(sf2Count)}`}
        </StatTile>
        <StatTile icon={CalendarDays} tint="bg-accent-light/20 text-primary-dark dark:bg-accent-light/20" label="Current School Year">
          {calendarLoading ? <StatSkeleton /> : currentSchoolYear ? currentSchoolYear : <TileEmptyState text="No school year configured." />}
        </StatTile>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-6">
        <div className="space-y-4">
          <SectionCard title="School Management Overview">
            <p className="text-sm text-gray-400 mt-2 dark:text-gray-400">
              Summary of learners and enrollment. Use the quick actions to manage forms and learners.
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              <div className="flex-1 min-w-[140px] p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">Learner Summary</div>
                <div className="mt-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {statsLoading ? <StatSkeleton /> : statsError ? <TileEmptyState text="Stats unavailable" /> : `${formatCount(learnerStats.total)} learner${learnerStats.total === 1 ? '' : 's'} · ${learnerStats.gradeLevels} grade level${learnerStats.gradeLevels === 1 ? '' : 's'}`}
                </div>
              </div>
              <div className="flex-1 min-w-[140px] p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">Enrollment Summary</div>
                <div className="mt-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {statsLoading ? <StatSkeleton /> : statsError ? <TileEmptyState text="Stats unavailable" /> : `${formatCount(learnerStats.active)} active · ${formatCount(learnerStats.transferredOut)} transferred out`}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick access</div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={goToSF1}
                  className="flex items-center gap-2 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-primary-light active:scale-[0.99] transition-all duration-150"
                >
                  <Plus size={16} /> Add Learner — SF1
                </button>
                <button
                  onClick={goToViewLearners}
                  className="flex items-center gap-2 bg-white text-primary border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 active:scale-[0.99] transition-all duration-150 dark:bg-gray-800 dark:text-primary-light dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <ClipboardList size={16} /> View Learners
                </button>
                <button
                  onClick={goToSF2}
                  className="flex items-center gap-2 bg-white text-primary border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 active:scale-[0.99] transition-all duration-150 dark:bg-gray-800 dark:text-primary-light dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <FilePlus2 size={16} /> School Form 2
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent-dark dark:bg-accent/20 flex items-center justify-center shrink-0">
                <Activity size={17} />
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h4>
            </div>

            <div className="mt-3">
              {statsLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-8 rounded-lg bg-gray-100 dark:bg-gray-800" />
                  ))}
                </div>
              ) : statsError ? (
                <EmptyState text="Recent activity is unavailable right now." />
              ) : learnerStats.recent.length === 0 ? (
                <EmptyState text="No recent activity yet. Add or import learners to see entries here." />
              ) : (
                <ul className="space-y-2.5">
                  {learnerStats.recent.map((learner) => (
                    <li key={learner.id} className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-leaf/10 text-leaf dark:bg-leaf/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <UserPlus size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                          Added {learner.lastName}, {learner.firstName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {[learner.gradeLevel, learner.section].filter(Boolean).join(' · ')}
                          {learner.createdAt ? ` · ${formatActivityDate(learner.createdAt)}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <WeatherCard onOpenSettings={canEditSchoolSettings ? goToSchoolSettings : undefined} />

          {canSeeLardo && <LardoRiskSummary goToLardo={goToLardo} />}

          <SectionCard>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 flex items-center justify-center shrink-0">
                <LifeBuoy size={17} />
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Support</h4>
            </div>
            <p className="text-sm text-gray-500 mt-2.5 dark:text-gray-400">
              Need help? Use the sidebar to access account or logout controls.
            </p>
          </SectionCard>
        </aside>
      </section>
    </div>
  );
}

export default Dashboard;
