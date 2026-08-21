// src/components/dashboard/PrincipalWidgets.jsx
// Principal Dashboard widgets (spec §5): a school-level management summary.
// School-wide reads are legitimate for principal per firestore.rules, but
// still scoped to the current school year rather than the whole collection.
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Users, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { db } from '../../firebase.js';
import { summarizeAttendanceForDate } from '../../utils/attendanceDates.js';
import { formatCount } from '../../utils/dashboardFormatters.js';
import { StatTile, StatSkeleton, TileEmptyState, SectionCard, EmptyState } from './primitives.jsx';

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function SchoolOverviewCard({ schoolYear }) {
  const [state, setState] = useState({
    loading: true,
    error: false,
    active: 0,
    transferred: 0,
    atRisk: 0,
    byGrade: {},
    attendanceRate: null,
  });

  useEffect(() => {
    if (!schoolYear) return undefined;
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const now = new Date();
        const monthValue = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
        const todayKey = `${monthValue}-${pad2(now.getDate())}`;

        const [learnersSnap, lardoSnap, attendanceSnap] = await Promise.all([
          getDocs(query(collection(db, 'learners'), where('schoolYear', '==', schoolYear))),
          getDocs(
            query(collection(db, 'lardoRecords'), where('schoolYear', '==', schoolYear), where('status', '==', 'monitoring'))
          ),
          getDocs(query(collection(db, 'attendance'), where('month', '==', monthValue))),
        ]);
        if (cancelled) return;

        const learners = learnersSnap.docs.map((d) => d.data());
        const active = learners.filter((l) => (l.enrollmentStatus || 'active') === 'active').length;
        const transferred = learners.filter((l) => l.enrollmentStatus === 'transferred-out').length;
        const byGrade = {};
        learners.forEach((l) => {
          if ((l.enrollmentStatus || 'active') !== 'active') return;
          const g = l.gradeLevel || 'Unspecified';
          byGrade[g] = (byGrade[g] || 0) + 1;
        });

        let totalToday = 0;
        let presentToday = 0;
        attendanceSnap.docs.forEach((d) => {
          const { total, present } = summarizeAttendanceForDate(d.data().records, todayKey);
          totalToday += total;
          presentToday += present;
        });
        const attendanceRate = totalToday > 0 ? (presentToday / totalToday) * 100 : null;

        setState({
          loading: false,
          error: false,
          active,
          transferred,
          atRisk: lardoSnap.size,
          byGrade,
          attendanceRate,
        });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [schoolYear]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <StatTile icon={Users} tint="bg-primary/10 text-primary dark:bg-primary/20" label="Active Enrollment">
          {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.active)}
        </StatTile>
        <StatTile icon={Users} tint="bg-leaf/10 text-leaf dark:bg-leaf/20" label="Attendance Rate">
          {state.loading ? (
            <StatSkeleton />
          ) : state.error || state.attendanceRate === null ? (
            <TileEmptyState text="No attendance recorded yet." />
          ) : (
            `${state.attendanceRate.toFixed(1)}%`
          )}
        </StatTile>
        <StatTile icon={ArrowRightLeft} tint="bg-accent/10 text-accent-dark dark:bg-accent/20" label="Transfers">
          {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.transferred)}
        </StatTile>
        <StatTile icon={ShieldAlert} tint="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400" label="Learners at Risk">
          {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.atRisk)}
        </StatTile>
      </div>

      <SectionCard>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Enrollment by Grade Level</h4>
        <div className="mt-3">
          {state.loading ? (
            <StatSkeleton />
          ) : state.error ? (
            <TileEmptyState text="Unavailable" />
          ) : Object.keys(state.byGrade).length === 0 ? (
            <EmptyState text="No enrollment data yet." />
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(state.byGrade)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([grade, count]) => (
                  <li
                    key={grade}
                    className="text-sm text-gray-700 dark:text-gray-200 flex justify-between border border-gray-100 dark:border-gray-700 rounded-lg px-2.5 py-1.5"
                  >
                    <span>{grade}</span>
                    <span className="font-tabular font-semibold">{formatCount(count)}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
