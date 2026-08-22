// src/components/dashboard/SubjectTeacherWidgets.jsx
// Subject-teacher Dashboard widgets (spec §4). All data comes from the
// teacher's own classRecordCombos/subjectMap (resolved by useTeacherScope
// from users/{uid}.assignments[] -- never a whole-school query), plus one
// getDoc per assigned class to check Class Record status. Rendered only
// when the account holds an explicit subjectTeacher assignment.
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { BookOpenCheck, Layers, ClipboardList } from 'lucide-react';
import { db } from '../../firebase.js';
import { formatCount, timestampToMillis, formatActivityDate } from '../../utils/dashboardFormatters.js';
import { buildClassRecordId } from '../../utils/classRecordId.js';
import { StatTile, StatSkeleton, TileEmptyState, SectionCard, EmptyState } from './primitives.jsx';

export function TeachingAssignmentsCard({ subjectMap, classRecordCombos }) {
  const subjectCount = subjectMap ? subjectMap.size : 0;
  const classCount = classRecordCombos ? classRecordCombos.length : 0;
  return (
    <div className="flex flex-wrap gap-3">
      <StatTile icon={BookOpenCheck} tint="bg-primary/10 text-primary dark:bg-primary/20" label="Subjects">
        {formatCount(subjectCount)}
      </StatTile>
      <StatTile icon={Layers} tint="bg-leaf/10 text-leaf dark:bg-leaf/20" label="Classes">
        {formatCount(classCount)}
      </StatTile>
    </div>
  );
}

export function MyClassesList({ classRecordHierarchy }) {
  const grades = Object.keys(classRecordHierarchy || {});

  return (
    <SectionCard>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">My Classes</h4>
      <div className="mt-3">
        {grades.length === 0 ? (
          <EmptyState text="No subject assignments yet." />
        ) : (
          <div className="space-y-3">
            {grades.map((grade) => (
              <div key={grade}>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{grade}</div>
                {Object.entries(classRecordHierarchy[grade]).map(([subject, sections]) => (
                  <div key={subject} className="ml-2 mt-1">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{subject}</div>
                    <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      {sections.map((s) => s.section).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// Single fetch (one getDoc per assigned class combo, bounded by the
// teacher's own assignment count) feeding both the status counts and the
// "recently updated" list, so the two widgets never double-read Firestore.
export function ClassRecordOverview({ classRecordCombos, schoolYear, onNavigate }) {
  const [state, setState] = useState({ loading: true, error: false, results: [] });
  const combos = classRecordCombos || [];

  useEffect(() => {
    if (combos.length === 0 || !schoolYear) {
      return undefined;
    }
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const results = await Promise.all(
          combos.map(async (combo) => {
            const term = (combo.terms && combo.terms[0]) || 1;
            const docId = buildClassRecordId({
              gradeLevel: combo.gradeLevel,
              section: combo.section,
              subject: combo.subject,
              term,
              schoolYear,
            });
            const snap = await getDoc(doc(db, 'classRecords', docId));
            return {
              combo,
              exists: snap.exists(),
              updatedAt: snap.exists() ? snap.data().updatedAt : null,
            };
          })
        );
        if (!cancelled) setState({ loading: false, error: false, results });
      } catch {
        if (!cancelled) setState({ loading: false, error: true, results: [] });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // combos is derived fresh from classRecordCombos each render; comparing
    // its length + schoolYear is enough to avoid a stale-closure re-fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combos.length, schoolYear]);

  const total = combos.length;
  const loading = total > 0 && !!schoolYear && state.loading;
  const existing = state.results.filter((r) => r.exists);
  const notStarted = state.results.filter((r) => !r.exists);
  const recent = [...existing].sort((a, b) => timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt)).slice(0, 3);

  return (
    <>
      <SectionCard>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent-dark dark:bg-accent/20 flex items-center justify-center shrink-0">
            <ClipboardList size={17} />
          </div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Class Record Status</h4>
        </div>
        <div className="mt-3">
          {total === 0 ? (
            <EmptyState text="No Class Records assigned." />
          ) : loading ? (
            <StatSkeleton />
          ) : state.error ? (
            <TileEmptyState text="Unable to load Class Record status." />
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-200">
              {total} Assigned Class Record{total === 1 ? '' : 's'} · {existing.length} Existing · {notStarted.length} Not Started
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Class Records</h4>
        <div className="mt-3">
          {total === 0 || (!loading && recent.length === 0) ? (
            <EmptyState text="No Class Records updated yet." />
          ) : loading ? (
            <StatSkeleton />
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={`${r.combo.gradeLevel}|${r.combo.subject}|${r.combo.section}`}>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('classRecord', r.combo)}
                    className="w-full text-left text-sm text-gray-700 dark:text-gray-200 hover:text-primary dark:hover:text-primary-light"
                  >
                    <span className="font-medium">
                      {r.combo.gradeLevel} · {r.combo.subject} · {r.combo.section}
                    </span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">
                      {r.updatedAt ? `Updated ${formatActivityDate(r.updatedAt)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>
    </>
  );
}
