// src/components/dashboard/GuidanceWidgets.jsx
// Guidance Counselor Dashboard widgets (spec §8): learner-support summaries
// only -- counts and top risk factors, no raw case details on the dashboard
// itself (the authorized LARDO/discipline pages hold the detail).
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ShieldAlert, Gavel } from 'lucide-react';
import { db } from '../../firebase.js';
import { formatCount } from '../../utils/dashboardFormatters.js';
import { StatTile, StatSkeleton, TileEmptyState, SectionCard } from './primitives.jsx';

export function GuidanceSupportCard({ schoolYear }) {
  const [state, setState] = useState({ loading: true, error: false, monitoring: 0, topFactors: [], disciplinary: 0 });

  useEffect(() => {
    if (!schoolYear) return undefined;
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const [lardoSnap, disciplinarySnap] = await Promise.all([
          getDocs(
            query(collection(db, 'lardoRecords'), where('schoolYear', '==', schoolYear), where('status', '==', 'monitoring'))
          ),
          getDocs(query(collection(db, 'disciplinaryRecords'), where('schoolYear', '==', schoolYear), where('status', '==', 'open'))),
        ]);
        if (cancelled) return;
        const records = lardoSnap.docs.map((d) => d.data());
        const counts = {};
        records.forEach((r) => (r.riskFactors || []).forEach((f) => (counts[f] = (counts[f] || 0) + 1)));
        const topFactors = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        setState({ loading: false, error: false, monitoring: records.length, topFactors, disciplinary: disciplinarySnap.size });
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
        <StatTile icon={ShieldAlert} tint="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400" label="Under Monitoring">
          {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.monitoring)}
        </StatTile>
        <StatTile icon={Gavel} tint="bg-accent/10 text-accent-dark dark:bg-accent/20" label="Disciplinary Cases">
          {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.disciplinary)}
        </StatTile>
      </div>
      {!state.loading && !state.error && state.topFactors.length > 0 && (
        <SectionCard>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top Risk Factors</h4>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {state.topFactors.map(([factor, count]) => (
              <li
                key={factor}
                className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2.5 py-1 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
              >
                {factor}
                <span className="text-red-500 dark:text-red-400">{count}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
