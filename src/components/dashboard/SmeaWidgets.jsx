// src/components/dashboard/SmeaWidgets.jsx
// SMEA Coordinator Dashboard widgets (spec §7): one consolidated monitoring
// overview. School-wide reads are legitimate for smeaCoordinator per
// firestore.rules, scoped to the current school year.
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Users, ShieldAlert, HeartPulse } from 'lucide-react';
import { db } from '../../firebase.js';
import { formatCount, CONCERNING_NUTRITION_STATUSES } from '../../utils/dashboardFormatters.js';
import { StatTile, StatSkeleton, TileEmptyState, SectionCard, EmptyState } from './primitives.jsx';

export function MonitoringOverviewCard({ schoolYear }) {
  const [state, setState] = useState({
    loading: true,
    error: false,
    enrollment: 0,
    byGrade: {},
    atRisk: 0,
    nutritionMeasured: 0,
    nutritionFollowUp: 0,
  });

  useEffect(() => {
    if (!schoolYear) return undefined;
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const [learnersSnap, lardoSnap, nutritionSnap] = await Promise.all([
          getDocs(query(collection(db, 'learners'), where('schoolYear', '==', schoolYear))),
          getDocs(
            query(collection(db, 'lardoRecords'), where('schoolYear', '==', schoolYear), where('status', '==', 'monitoring'))
          ),
          getDocs(query(collection(db, 'nutritionRecords'), where('schoolYear', '==', schoolYear))),
        ]);
        if (cancelled) return;

        const active = learnersSnap.docs.map((d) => d.data()).filter((l) => (l.enrollmentStatus || 'active') === 'active');
        const byGrade = {};
        active.forEach((l) => {
          const g = l.gradeLevel || 'Unspecified';
          byGrade[g] = (byGrade[g] || 0) + 1;
        });
        const nutritionRecords = nutritionSnap.docs.map((d) => d.data());
        const nutritionFollowUp = nutritionRecords.filter((r) => CONCERNING_NUTRITION_STATUSES.includes(r.nutritionalStatus)).length;

        setState({
          loading: false,
          error: false,
          enrollment: active.length,
          byGrade,
          atRisk: lardoSnap.size,
          nutritionMeasured: nutritionRecords.length,
          nutritionFollowUp,
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
        <StatTile icon={Users} tint="bg-primary/10 text-primary dark:bg-primary/20" label="Enrollment">
          {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.enrollment)}
        </StatTile>
        <StatTile icon={ShieldAlert} tint="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400" label="LARDO Monitoring">
          {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.atRisk)}
        </StatTile>
        <StatTile icon={HeartPulse} tint="bg-accent/10 text-accent-dark dark:bg-accent/20" label="Nutrition Follow-up">
          {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.nutritionFollowUp)}
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
