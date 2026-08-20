import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Users, CheckCircle2, FileText, CalendarDays, Plus, ClipboardList, FilePlus2, ShieldAlert, Inbox, LifeBuoy } from 'lucide-react';
import { db } from './firebase';
import { canAccessPage } from './pageAccess.js';
import Card from './components/ui/Card';
import EmptyStatePrimitive from './components/ui/EmptyState';
import Button from './components/ui/Button';

function StatTile({ icon: Icon, tint, label, value }) {
  return (
    <Card padded={false} className="flex-1 min-w-[180px] p-4 hover:shadow-sm transition-shadow duration-200 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-md flex items-center justify-center flex-shrink-0 ${tint}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">{label}</div>
        <div className="text-base font-semibold mt-0.5 text-gray-900 dark:text-gray-100 truncate">{value}</div>
      </div>
    </Card>
  );
}

function EmptyState({ text }) {
  return <EmptyStatePrimitive icon={Inbox} title={text} className="py-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg" />;
}

function SectionCard({ title, children, className = '' }) {
  return (
    <Card className={className}>
      {title && <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>}
      {children}
    </Card>
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
        <div className="w-9 h-9 rounded-md bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 flex items-center justify-center shrink-0">
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
            <span className={`text-3xl font-bold ${records.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
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

      <Button onClick={goToLardo} className="mt-4 w-full">
        Open LARDO Tracking
      </Button>
    </SectionCard>
  );
}

function Dashboard({ goToSF1, goToSF2, goToViewLearners, goToLardo, userRoles }) {
  const canSeeLardo = canAccessPage('lardoTracking', userRoles);

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100 animate-slide-up">
      <div className="flex flex-wrap gap-3 mt-4">
        <StatTile icon={Users} tint="bg-primary/10 text-primary dark:bg-primary/20" label="Total Learners" value="No data available yet." />
        <StatTile icon={CheckCircle2} tint="bg-leaf/10 text-leaf dark:bg-leaf/20" label="Enrollment" value="No data available yet." />
        <StatTile icon={FileText} tint="bg-accent/10 text-accent-dark dark:bg-accent/20" label="School Forms" value="SF1 & SF2" />
        <StatTile icon={CalendarDays} tint="bg-accent-light/20 text-primary-dark dark:bg-accent-light/20" label="Current School Year" value="No data available yet." />
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-6">
        <div className="space-y-4">
          <SectionCard title="School Management Overview">
            <p className="text-sm text-gray-400 mt-2 dark:text-gray-400">
              Summary of learners and enrollment. Use the quick actions to manage forms and learners.
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              <div className="flex-1 min-w-[140px] p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">Learner Summary</div>
                <div className="mt-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">No data available yet.</div>
              </div>
              <div className="flex-1 min-w-[140px] p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">Enrollment Summary</div>
                <div className="mt-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">No data available yet.</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick actions</div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button onClick={goToSF1}>
                  <Plus size={16} /> Add Learner — SF1
                </Button>
                <Button variant="secondary" onClick={goToViewLearners}>
                  <ClipboardList size={16} /> View Learners
                </Button>
                <Button variant="secondary" onClick={goToSF2}>
                  <FilePlus2 size={16} /> School Form 2
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recent Activity">
            <div className="mt-3">
              <EmptyState text="Recent events will appear here." />
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          {canSeeLardo && <LardoRiskSummary goToLardo={goToLardo} />}

          <SectionCard>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-md bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 flex items-center justify-center shrink-0">
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
