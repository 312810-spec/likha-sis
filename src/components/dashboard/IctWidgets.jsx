// src/components/dashboard/IctWidgets.jsx
// ICT Coordinator Dashboard widgets (spec §6): system administration only --
// no LARDO/discipline/nutrition/grades reads live in this file. importBatches
// is rules-gated to ictCoordinator alone (not principal, despite Import
// Center's page access), so ImportsStatusCard must only ever be mounted for
// an ictCoordinator account.
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { Users, UserCog, UploadCloud, Settings2 } from 'lucide-react';
import { db } from '../../firebase.js';
import { isAccountActive } from '../../utils/userAccountManagement.js';
import { formatCount, timestampToMillis, formatActivityDate } from '../../utils/dashboardFormatters.js';
import { StatTile, StatSkeleton, TileEmptyState, SectionCard, EmptyState } from './primitives.jsx';

export function UserAccountsCard() {
  const [state, setState] = useState({ loading: true, error: false, total: 0, active: 0, deactivated: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (cancelled) return;
        const users = snap.docs.map((d) => d.data());
        const active = users.filter((u) => isAccountActive(u)).length;
        setState({ loading: false, error: false, total: users.length, active, deactivated: users.length - active });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-wrap gap-3">
      <StatTile icon={Users} tint="bg-primary/10 text-primary dark:bg-primary/20" label="Total Users">
        {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.total)}
      </StatTile>
      <StatTile icon={UserCog} tint="bg-leaf/10 text-leaf dark:bg-leaf/20" label="Active Accounts">
        {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.active)}
      </StatTile>
      <StatTile icon={UserCog} tint="bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400" label="Deactivated Accounts">
        {state.loading ? <StatSkeleton /> : state.error ? <TileEmptyState text="Unavailable" /> : formatCount(state.deactivated)}
      </StatTile>
    </div>
  );
}

// Only adviser and subjectTeacher roles are assignment-required; every other
// role legitimately needs no class assignment and is never flagged.
export function AssignmentHealthCard() {
  const [state, setState] = useState({ loading: true, error: false, missingAdvisory: 0, missingSubjectAssignment: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (cancelled) return;
        const users = snap.docs.map((d) => d.data());
        let missingAdvisory = 0;
        let missingSubjectAssignment = 0;
        users.forEach((u) => {
          const roles = Array.isArray(u.roles) ? u.roles : [];
          const assignments = Array.isArray(u.assignments) ? u.assignments : [];
          if (roles.includes('adviser') && !assignments.some((a) => a?.role === 'adviser')) missingAdvisory += 1;
          if (roles.includes('subjectTeacher') && !assignments.some((a) => a?.role === 'subjectTeacher')) {
            missingSubjectAssignment += 1;
          }
        });
        setState({ loading: false, error: false, missingAdvisory, missingSubjectAssignment });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Assignment Health</h4>
      <div className="mt-3">
        {state.loading ? (
          <StatSkeleton />
        ) : state.error ? (
          <TileEmptyState text="Unable to load assignment health." />
        ) : state.missingAdvisory === 0 && state.missingSubjectAssignment === 0 ? (
          <div className="text-sm text-leaf dark:text-leaf">All advisers and subject teachers have assignments.</div>
        ) : (
          <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
            {state.missingAdvisory > 0 && (
              <li>
                {state.missingAdvisory} adviser{state.missingAdvisory === 1 ? '' : 's'} missing an advisory assignment
              </li>
            )}
            {state.missingSubjectAssignment > 0 && (
              <li>
                {state.missingSubjectAssignment} subject teacher{state.missingSubjectAssignment === 1 ? '' : 's'} missing a subject
                assignment
              </li>
            )}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

function latestOf(docs) {
  if (docs.length === 0) return null;
  return docs.reduce((latest, cur) => (timestampToMillis(cur.createdAt) > timestampToMillis(latest.createdAt) ? cur : latest), docs[0]);
}

export function ImportsStatusCard() {
  const [state, setState] = useState({ loading: true, error: false, sf1: null, sf10: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sf1Snap, sf10Snap] = await Promise.all([
          getDocs(query(collection(db, 'importBatches'), where('documentType', '==', 'sf1'), limit(20))),
          getDocs(query(collection(db, 'importBatches'), where('documentType', '==', 'sf10'), limit(20))),
        ]);
        if (cancelled) return;
        setState({
          loading: false,
          error: false,
          sf1: latestOf(sf1Snap.docs.map((d) => d.data())),
          sf10: latestOf(sf10Snap.docs.map((d) => d.data())),
        });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function importLine(label, batch) {
    if (!batch) return `${label}: no imports yet.`;
    return `${label}: ${formatActivityDate(batch.createdAt)} · ${batch.successfulRecords ?? 0} imported, ${batch.skippedRecords ?? 0} skipped`;
  }

  return (
    <SectionCard>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent-dark dark:bg-accent/20 flex items-center justify-center shrink-0">
          <UploadCloud size={17} />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Imports</h4>
      </div>
      <div className="mt-3">
        {state.loading ? (
          <StatSkeleton />
        ) : state.error ? (
          <TileEmptyState text="Unable to load import status." />
        ) : !state.sf1 && !state.sf10 ? (
          <EmptyState text="No recent imports." />
        ) : (
          <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
            <li>{importLine('SF1', state.sf1)}</li>
            <li>{importLine('SF10', state.sf10)}</li>
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

export function SystemConfigCard({ schoolConfigReady, schoolYearCount }) {
  return (
    <SectionCard>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 flex items-center justify-center shrink-0">
          <Settings2 size={17} />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">System Configuration</h4>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-gray-700 dark:text-gray-200">
        <li>School configuration: {schoolConfigReady ? 'Configured' : 'Incomplete'}</li>
        <li>
          Academic calendar: {schoolYearCount} school year{schoolYearCount === 1 ? '' : 's'} configured
        </li>
      </ul>
    </SectionCard>
  );
}
