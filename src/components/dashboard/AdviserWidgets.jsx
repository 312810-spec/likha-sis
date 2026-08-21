// src/components/dashboard/AdviserWidgets.jsx
// Adviser-scoped Dashboard widgets (spec §3). Every query here is filtered
// to the adviser's own advisory gradeLevel/section -- never school-wide --
// and each widget is only mounted by Dashboard.jsx when the capability that
// authorizes it is true, so an unauthorized role never even fires the read.
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Users2, CalendarCheck2, ShieldAlert, HeartPulse, FileText } from 'lucide-react';
import { db } from '../../firebase.js';
import { canAccessPage } from '../../pageAccess.js';
import { normalizeSex } from '../../utils/nutritionComputations.js';
import { getWeekdays, makeAttendanceDocId, summarizeAttendanceForDate } from '../../utils/attendanceDates.js';
import { formatCount, CONCERNING_NUTRITION_STATUSES } from '../../utils/dashboardFormatters.js';
import { StatSkeleton, TileEmptyState, SectionCard, EmptyState } from './primitives.jsx';
import Button from '../Button.jsx';

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function AdvisoryClassCard({ adviser }) {
  const [state, setState] = useState({ loading: true, error: false, total: 0, male: 0, female: 0 });

  useEffect(() => {
    if (!adviser) return undefined;
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const snap = await getDocs(
          query(
            collection(db, 'learners'),
            where('gradeLevel', '==', adviser.gradeLevel),
            where('section', '==', adviser.section)
          )
        );
        if (cancelled) return;
        const active = snap.docs.map((d) => d.data()).filter((l) => (l.enrollmentStatus || 'active') === 'active');
        const male = active.filter((l) => normalizeSex(l.sex) === 'M').length;
        const female = active.filter((l) => normalizeSex(l.sex) === 'F').length;
        setState({ loading: false, error: false, total: active.length, male, female });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // Depending on the primitive gradeLevel/section (not the `adviser` object
    // itself, a fresh reference every render from useTeacherScope) avoids an
    // infinite refetch loop while still re-fetching when the scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviser?.gradeLevel, adviser?.section]);

  if (!adviser) {
    return (
      <SectionCard>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Advisory Class</h4>
        <div className="mt-3">
          <EmptyState text="No advisory class assigned." />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:bg-primary/20 flex items-center justify-center shrink-0">
          <Users2 size={17} />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {adviser.gradeLevel} — {adviser.section}
        </h4>
      </div>
      <div className="mt-3">
        {state.loading ? (
          <StatSkeleton />
        ) : state.error ? (
          <TileEmptyState text="Unable to load learners." />
        ) : (
          <>
            <div className="font-tabular text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCount(state.total)} active learner{state.total === 1 ? '' : 's'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatCount(state.male)} Male · {formatCount(state.female)} Female
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

export function AdviserAttendanceCard({ adviser }) {
  const [state, setState] = useState({ loading: true, error: false, mode: 'none', present: 0, absent: 0, total: 0, rate: null });

  useEffect(() => {
    if (!adviser) return undefined;
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const now = new Date();
        const monthValue = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
        const todayKey = `${monthValue}-${pad2(now.getDate())}`;
        const docId = makeAttendanceDocId(`${adviser.gradeLevel} - ${adviser.section}`, monthValue);
        const snap = await getDoc(doc(db, 'attendance', docId));
        if (cancelled) return;

        if (!snap.exists()) {
          setState({ loading: false, error: false, mode: 'none', present: 0, absent: 0, total: 0, rate: null });
          return;
        }

        const records = snap.data().records || {};
        const learnerIds = Object.keys(records);
        const hasTodayEntries = learnerIds.some((id) => records[id]?.[todayKey] !== undefined);

        if (learnerIds.length > 0 && hasTodayEntries) {
          const { total, present, absent } = summarizeAttendanceForDate(records, todayKey);
          const rate = total > 0 ? (present / total) * 100 : null;
          setState({ loading: false, error: false, mode: 'today', present, absent, total, rate });
          return;
        }

        const weekdaysSoFar = getWeekdays(monthValue).filter((w) => w.dateString <= todayKey);
        const total = learnerIds.length;
        const totalAbsencesThisMonth = learnerIds.reduce(
          (sum, id) => sum + Object.values(records[id] || {}).filter((v) => v === 'A').length,
          0
        );
        const possibleLearnerDays = total * weekdaysSoFar.length;
        if (total === 0 || possibleLearnerDays === 0) {
          setState({ loading: false, error: false, mode: 'none', present: 0, absent: 0, total: 0, rate: null });
          return;
        }
        const rate = Math.max(0, (1 - totalAbsencesThisMonth / possibleLearnerDays) * 100);
        setState({ loading: false, error: false, mode: 'month', present: 0, absent: totalAbsencesThisMonth, total, rate });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // Depending on the primitive gradeLevel/section (not the `adviser` object
    // itself, a fresh reference every render from useTeacherScope) avoids an
    // infinite refetch loop while still re-fetching when the scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviser?.gradeLevel, adviser?.section]);

  if (!adviser) return null;

  return (
    <SectionCard>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-leaf/10 text-leaf dark:bg-leaf/20 flex items-center justify-center shrink-0">
          <CalendarCheck2 size={17} />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {state.mode === 'today' ? "Today's Attendance" : 'Attendance This Month'}
        </h4>
      </div>
      <div className="mt-3">
        {state.loading ? (
          <StatSkeleton />
        ) : state.error ? (
          <TileEmptyState text="Unable to load attendance." />
        ) : state.mode === 'none' ? (
          <EmptyState text="No attendance recorded yet this month." />
        ) : state.mode === 'today' ? (
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Present: <span className="font-semibold">{state.present}</span> · Absent:{' '}
            <span className="font-semibold">{state.absent}</span> · Rate:{' '}
            <span className="font-semibold">{state.rate.toFixed(1)}%</span>
          </div>
        ) : (
          <div className="text-sm text-gray-700 dark:text-gray-200">
            {state.absent} absence{state.absent === 1 ? '' : 's'} logged this month · Rate (month-to-date):{' '}
            <span className="font-semibold">{state.rate.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export function AdviserLardoCard({ adviser, onNavigate }) {
  const [state, setState] = useState({ loading: true, error: false, count: 0 });

  useEffect(() => {
    if (!adviser) return undefined;
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const snap = await getDocs(
          query(
            collection(db, 'lardoRecords'),
            where('gradeLevel', '==', adviser.gradeLevel),
            where('section', '==', adviser.section),
            where('status', '==', 'monitoring')
          )
        );
        if (!cancelled) setState({ loading: false, error: false, count: snap.size });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // Depending on the primitive gradeLevel/section (not the `adviser` object
    // itself, a fresh reference every render from useTeacherScope) avoids an
    // infinite refetch loop while still re-fetching when the scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviser?.gradeLevel, adviser?.section]);

  if (!adviser) return null;

  return (
    <SectionCard>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 flex items-center justify-center shrink-0">
          <ShieldAlert size={17} />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Learners Needing Attention</h4>
      </div>
      <div className="mt-3">
        {state.loading ? (
          <StatSkeleton />
        ) : state.error ? (
          <TileEmptyState text="Unable to load LARDO status." />
        ) : (
          <div className="font-tabular text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCount(state.count)} learner{state.count === 1 ? '' : 's'} under monitoring
          </div>
        )}
      </div>
      {onNavigate && (
        <Button onClick={() => onNavigate('lardoTracking')} className="mt-4 w-full justify-center" size="small">
          Open LARDO Tracking
        </Button>
      )}
    </SectionCard>
  );
}

export function AdviserNutritionCard({ adviser, schoolYear }) {
  const [state, setState] = useState({ loading: true, error: false, measured: 0, followUp: 0 });

  useEffect(() => {
    if (!adviser || !schoolYear) return undefined;
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const snap = await getDocs(
          query(
            collection(db, 'nutritionRecords'),
            where('gradeLevel', '==', adviser.gradeLevel),
            where('section', '==', adviser.section),
            where('schoolYear', '==', schoolYear)
          )
        );
        if (cancelled) return;
        const records = snap.docs.map((d) => d.data());
        const followUp = records.filter((r) => CONCERNING_NUTRITION_STATUSES.includes(r.nutritionalStatus)).length;
        setState({ loading: false, error: false, measured: records.length, followUp });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviser?.gradeLevel, adviser?.section, schoolYear]);

  if (!adviser) return null;

  return (
    <SectionCard>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent-dark dark:bg-accent/20 flex items-center justify-center shrink-0">
          <HeartPulse size={17} />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nutrition</h4>
      </div>
      <div className="mt-3">
        {state.loading ? (
          <StatSkeleton />
        ) : state.error ? (
          <TileEmptyState text="Unable to load nutrition status." />
        ) : state.measured === 0 ? (
          <EmptyState text="No nutrition records completed yet." />
        ) : (
          <div className="text-sm text-gray-700 dark:text-gray-200">
            {state.measured} record{state.measured === 1 ? '' : 's'} completed
            {state.followUp > 0 && (
              <span className="block text-xs text-red-600 dark:text-red-400 mt-1">
                {state.followUp} learner{state.followUp === 1 ? '' : 's'} requiring follow-up
              </span>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

const SCHOOL_FORM_LINKS = [
  { page: 'sf1', label: 'SF1', action: 'goToSF1' },
  { page: 'sf2', label: 'SF2', action: 'goToSF2' },
  { page: 'sf4', label: 'SF4' },
  { page: 'reportCard', label: 'Report Card / SF9' },
  { page: 'sf10Generate', label: 'SF10' },
];

export function SchoolFormsQuickActions({ userRoles, onNavigate, goToSF1, goToSF2 }) {
  const namedActions = { goToSF1, goToSF2 };
  const forms = SCHOOL_FORM_LINKS.filter((f) => canAccessPage(f.page, userRoles));
  if (forms.length === 0) return null;

  return (
    <SectionCard>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-accent-light/20 text-primary-dark dark:bg-accent-light/20 flex items-center justify-center shrink-0">
          <FileText size={17} />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">School Forms</h4>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {forms.map((f) => (
          <Button
            key={f.page}
            variant="secondary"
            size="small"
            onClick={() => (f.action && namedActions[f.action] ? namedActions[f.action]() : onNavigate?.(f.page))}
          >
            {f.label}
          </Button>
        ))}
      </div>
    </SectionCard>
  );
}
