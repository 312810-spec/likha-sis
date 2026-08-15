import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Users, CheckCircle2, FileText, CalendarDays, Plus, ClipboardList, FilePlus2, ShieldAlert } from 'lucide-react';
import { db } from './firebase';
import { canAccessPage } from './pageAccess.js';

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
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm dark:bg-gray-900 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shrink-0">
          <ShieldAlert size={16} />
        </div>
        <h4 className="text-sm font-semibold dark:text-gray-100">LARDO At-Risk Learners</h4>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 mt-3 dark:text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {records.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-300">learner{records.length === 1 ? '' : 's'} currently flagged for monitoring</div>

          {topRiskFactors.length > 0 && (
            <ul className="mt-3 space-y-1">
              {topRiskFactors.map(([factor, count]) => (
                <li key={factor} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>{factor}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button
        onClick={goToLardo}
        className="mt-4 w-full bg-primary text-white px-3 py-2 rounded-md text-sm hover:bg-primary-light"
      >
        Open LARDO Tracking
      </button>
    </div>
  );
}

function Dashboard({ goToSF1, goToSF2, goToViewLearners, goToLardo, userRoles }) {
  const canSeeLardo = canAccessPage('lardoTracking', userRoles);

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100">
      <div className="flex flex-wrap gap-3 mt-4">
        <div className="flex-1 min-w-[180px] bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center gap-3 dark:bg-gray-900 dark:border-gray-700">
          <div className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-300">Total Learners</div>
            <div className="text-base font-semibold mt-1">No data available yet.</div>
          </div>
        </div>

        <div className="flex-1 min-w-[180px] bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center gap-3 dark:bg-gray-900 dark:border-gray-700">
          <div className="w-10 h-10 rounded-lg bg-leaf text-white flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-300">Enrollment</div>
            <div className="text-base font-semibold mt-1">No data available yet.</div>
          </div>
        </div>

        <div className="flex-1 min-w-[180px] bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center gap-3 dark:bg-gray-900 dark:border-gray-700">
          <div className="w-10 h-10 rounded-lg bg-accent text-white flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-300">School Forms</div>
            <div className="text-base font-semibold mt-1">SF1 & SF2</div>
          </div>
        </div>

        <div className="flex-1 min-w-[180px] bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center gap-3 dark:bg-gray-900 dark:border-gray-700">
          <div className="w-10 h-10 rounded-lg bg-accent-light text-primary-dark flex items-center justify-center">
            <CalendarDays size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-300">Current School Year</div>
            <div className="text-base font-semibold mt-1">No data available yet.</div>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-6">
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm dark:bg-gray-900 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">School Management Overview</h3>
            <p className="text-sm text-gray-400 mt-2 dark:text-gray-400">
              Summary of learners and enrollment. Use the quick actions to manage forms and learners.
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              <div className="flex-1 min-w-[140px] p-2 rounded-md border border-indigo-50 dark:border-gray-700">
                <div className="text-xs text-gray-600 dark:text-gray-300">Learner Summary</div>
                <div className="mt-2 font-semibold">No data available yet.</div>
              </div>
              <div className="flex-1 min-w-[140px] p-2 rounded-md border border-indigo-50 dark:border-gray-700">
                <div className="text-xs text-gray-600 dark:text-gray-300">Enrollment Summary</div>
                <div className="mt-2 font-semibold">No data available yet.</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick access</div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={goToSF1}
                  className="flex items-center gap-2 bg-primary text-white px-3 py-2 rounded-md text-sm hover:bg-primary-light"
                >
                  <Plus size={16} /> Add Learner — SF1
                </button>
                <button
                  onClick={goToViewLearners}
                  className="flex items-center gap-2 bg-white text-primary border border-gray-300 px-3 py-2 rounded-md text-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-primary-light dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <ClipboardList size={16} /> View Learners
                </button>
                <button
                  onClick={goToSF2}
                  className="flex items-center gap-2 bg-white text-primary border border-gray-300 px-3 py-2 rounded-md text-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-primary-light dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <FilePlus2 size={16} /> School Form 2
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm dark:bg-gray-900 dark:border-gray-700">
            <h4 className="text-sm font-semibold dark:text-gray-100">Recent Activity</h4>
            <p className="text-sm text-gray-400 mt-2 dark:text-gray-400">Recent events will appear here.</p>
            <ul className="mt-3 space-y-2">
              <li className="p-2 rounded-md border border-gray-100 text-sm dark:border-gray-700 dark:text-gray-200">No data available yet.</li>
            </ul>
          </div>
        </div>

        <aside className="space-y-4">
          {canSeeLardo && <LardoRiskSummary goToLardo={goToLardo} />}

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm dark:bg-gray-900 dark:border-gray-700">
            <h4 className="text-sm font-semibold dark:text-gray-100">Quick Actions</h4>
            <div className="flex flex-col gap-2 mt-3">
              <button
                onClick={goToSF1}
                className="bg-primary text-white px-3 py-2 rounded-md text-sm text-left hover:bg-primary-light"
              >
                Add Learner → SF1
              </button>
              <button
                onClick={goToViewLearners}
                className="bg-white text-primary border border-gray-300 px-3 py-2 rounded-md text-sm text-left hover:bg-gray-50 dark:bg-gray-800 dark:text-primary-light dark:border-gray-700 dark:hover:bg-gray-700"
              >
                View Learners
              </button>
              <button
                onClick={goToSF2}
                className="bg-white text-primary border border-gray-300 px-3 py-2 rounded-md text-sm text-left hover:bg-gray-50 dark:bg-gray-800 dark:text-primary-light dark:border-gray-700 dark:hover:bg-gray-700"
              >
                School Form 2 → SF2
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm dark:bg-gray-900 dark:border-gray-700">
            <h4 className="text-sm font-semibold dark:text-gray-100">Support</h4>
            <p className="text-sm text-gray-500 mt-2 dark:text-gray-400">
              Need help? Use the sidebar to access account or logout controls.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

export default Dashboard;