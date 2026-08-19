import { useState } from 'react';
import { canAccessPage } from '../pageAccess.js';
import {
  LayoutDashboard,
  FileText,
  Users,
  GraduationCap,
  IdCard,
  BarChart3,
  NotebookPen,
  Pencil,
  CalendarDays,
  UploadCloud,
  UserCog,
  ClipboardList,
  Megaphone,
  AlertTriangle,
  HeartPulse,
  ArrowLeftRight,
  Award,
  Palette,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

const icons = {
  Dashboard: LayoutDashboard,
  Announcements: Megaphone,
  'School Calendar': CalendarDays,
  'User Management': UserCog,
  Branding: Palette,
  'Branding Settings': Palette,
  'School Settings': Settings,
  'School Forms': FileText,
  SF1: FileText,
  SF2: FileText,
  'SF4': FileText,
  'School Form 4': FileText,
  'Class Record': ClipboardList,
  'Consolidated Grades': Award,
  'Report Card (SF9)': FileText,
  'SF10 Generator': FileText,
  'View Learners': Users,
  'LARDO Tracking': AlertTriangle,
  'Nutrition Status': HeartPulse,
  'Nutrition Consolidator': ClipboardList,
  Transfers: ArrowLeftRight,
  'Transfers Log': ArrowLeftRight,
  Certificates: GraduationCap,
  'ID Generator': IdCard,
  SMEA: BarChart3,
  Enrollment: BarChart3,
  'Anecdotal Records': NotebookPen,
  Academic: NotebookPen,
  Grades: Pencil,
  Attendance: CalendarDays,
  'Import Center': UploadCloud,
  'SF1 Bulk Import': UploadCloud,
  'SF10 Import': UploadCloud,
};

export default function Sidebar({ currentPage, onNavigate, userRoles, openMobile = false, onCloseMobile }) {
  const [collapsed, setCollapsed] = useState(false);

  function toggleCollapsed() {
    setCollapsed((s) => !s);
  }

  function toggleMobile() {
    if (onCloseMobile) onCloseMobile();
  }

  const nav = [
    { label: 'Dashboard', page: 'dashboard' },
    // Announcements and School Calendar sit directly under Dashboard because
    // every assigned role can open them — they're the school-wide pages, not
    // module-specific ones.
    { label: 'Announcements', page: 'announcements' },
    { label: 'School Calendar', page: 'schoolCalendar' },
    // NOTE: Access control for User Management will be restricted to ictCoordinator/principal roles in Phase B.
    { label: 'User Management', page: 'userManagement' },
    // Branding is a tab inside School Settings now, not a separate page.
    { label: 'School Settings', page: 'schoolSettings' },
    { label: 'Import Center', page: 'importCenter' },
    {
      label: 'School Forms',
      children: [
        { label: 'SF1', page: 'sf1' },
        { label: 'SF2', page: 'sf2' },
        { label: 'SF4', page: 'sf4' },
      ],
    },
    { label: 'Class Record', page: 'classRecord' },
    { label: 'Consolidated Grades', page: 'consolidatedGrades' },
    { label: 'Report Card (SF9)', page: 'reportCard' },
    { label: 'SF10 Generator', page: 'sf10Generate' },
    { label: 'Class Program & Load', page: 'classProgram' },
    { label: 'View Learners', page: 'viewLearners' },
    { label: 'LARDO Tracking', page: 'lardoTracking' },
    { label: 'Nutrition Status', page: 'nutritionStatus' },
    { label: 'Nutrition Consolidator', page: 'nutritionConsolidator' },
    { label: 'Transfers', page: 'transfersLog' },
    { label: 'Certificates', page: 'certificates' },
    { label: 'ID Generator', page: 'idGenerator' },
    {
      label: 'SMEA',
      children: [
        { label: 'Enrollment', page: 'smeaEnrollment' },
        { label: 'Anecdotal Records', page: 'anecdotalRecords' },
      ],
    },
    {
      label: 'Imports',
      children: [
        { label: 'SF1 Bulk Import', page: 'sf1Import' },
        { label: 'SF10 Import', page: 'sf10Import' },
      ],
    },
  ];

  const visibleNav = nav
    .map((item) => {
      if (item.children) {
        const allowedChildren = item.children.filter((c) =>
          canAccessPage(c.page, userRoles)
        );
        return allowedChildren.length > 0
          ? { ...item, children: allowedChildren }
          : null;
      }
      return canAccessPage(item.page, userRoles) ? item : null;
    })
    .filter(Boolean);

  const future = [
    {
      label: 'Academic',
      children: [{ label: 'Grades' }, { label: 'Attendance' }],
    },
  ];

  function handleNavClick(page) {
    onNavigate(page);
    if (openMobile) {
      toggleMobile();
    }
  }

  function NavIcon({ label }) {
    const Icon = icons[label];
    return Icon ? <Icon size={18} strokeWidth={2} /> : null;
  }

  function NavButton({ label, page, active }) {
    return (
      <button
        type="button"
        title={collapsed ? label : undefined}
        className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
          active
            ? 'bg-white/15 text-white font-semibold shadow-sm dark:bg-white/10'
            : 'text-white/75 hover:bg-white/10 hover:text-white dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
        } ${collapsed ? 'justify-center' : ''}`}
        onClick={() => handleNavClick(page)}
      >
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-accent transition-all duration-150 ${
            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
          }`}
        />
        <NavIcon label={label} />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  }

  return (
    <aside
      className={`${collapsed ? 'w-20' : 'w-64'} ${openMobile ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:sticky top-0 left-0 h-screen flex-shrink-0 bg-primary text-white flex flex-col transition-all duration-200 z-40 dark:bg-primary-dark dark:text-gray-100 shadow-xl md:shadow-none`}
      aria-label="Primary"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-white/10 dark:border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={'/Tingub%20National%20High%20School%28clear%29.png'}
            alt="Tingub National High School"
            width={38}
            height={38}
            className="rounded-full bg-white ring-2 ring-white/20 flex-shrink-0"
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate text-white dark:text-gray-100 leading-tight">Tingub National High School</div>
              <div className="text-[11px] font-medium tracking-wide text-accent-light dark:text-accent-light">LIKHA-SIS</div>
            </div>
          )}
        </div>

        <button
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors dark:text-gray-300 dark:hover:text-white"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
          type="button"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <button
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors dark:text-gray-300 dark:hover:text-white"
          aria-label="Close sidebar"
          onClick={toggleMobile}
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 sidebar-scroll">
        <ul className="space-y-1">
          {visibleNav.map((item) =>
            item.children ? (
              <li key={item.label}>
                {!collapsed && (
                  <h3 className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-accent-light/90 font-semibold dark:text-accent-light">
                    {item.label}
                  </h3>
                )}
                <ul className="space-y-1">
                  {item.children.map((c) => (
                    <li key={c.label}>
                      <NavButton label={c.label} page={c.page} active={currentPage === c.page} />
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={item.label}>
                <NavButton label={item.label} page={item.page} active={currentPage === item.page} />
              </li>
            )
          )}
        </ul>

        <div className="mt-6">
          {!collapsed && (
            <h3 className="px-3 pb-1 text-[11px] uppercase tracking-wider text-white/50 font-semibold dark:text-gray-500">Future</h3>
          )}
          <ul className="space-y-1">
            {future.map((sec) => (
              <li key={sec.label}>
                {!collapsed && (
                  <h3 className="px-3 pt-2 pb-1 text-xs text-white/50 dark:text-gray-500">{sec.label}</h3>
                )}
                <ul className="space-y-1">
                  {sec.children.map((c) => (
                    <li key={c.label}>
                      <button
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 cursor-not-allowed dark:text-gray-500 ${collapsed ? 'justify-center' : ''}`}
                        disabled
                        type="button"
                        title={collapsed ? `${c.label} (Coming Soon)` : undefined}
                      >
                        <NavIcon label={c.label} />
                        {!collapsed && <span className="truncate">{c.label} <span className="text-[10px] opacity-70">(Soon)</span></span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {openMobile && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] md:hidden -z-10"
          onClick={toggleMobile}
        />
      )}
    </aside>
  );
}
