// src/components/dashboard/MasterTeacherWidgets.jsx
// Master Teacher Dashboard widgets (spec §9). Kept modest -- a school-wide
// classRecords completion scan would be an expensive collection-group read,
// so this stays to the one summary masterTeacher already has rule access to
// (LARDO monitoring), plus quick links to the academic/program pages.
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ShieldAlert } from 'lucide-react';
import { db } from '../../firebase.js';
import { formatCount } from '../../utils/dashboardFormatters.js';
import { StatTile, StatSkeleton, TileEmptyState } from './primitives.jsx';

export function MasterTeacherOverviewCard({ schoolYear }) {
  const [state, setState] = useState({ loading: true, error: false, atRisk: 0 });

  useEffect(() => {
    if (!schoolYear) return undefined;
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const snap = await getDocs(
          query(collection(db, 'lardoRecords'), where('schoolYear', '==', schoolYear), where('status', '==', 'monitoring'))
        );
        if (!cancelled) setState({ loading: false, error: false, atRisk: snap.size });
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
    <StatTile icon={ShieldAlert} tint="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400" label="Learners at Risk (LARDO)">
      {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.atRisk)}
    </StatTile>
  );
}
