import { useState } from 'react';
import { canAccessPage } from '../pageAccess.js';
import Tooltip from './Tooltip.jsx';
import useAcademicCalendar from '../hooks/useAcademicCalendar';
import useTeacherScope from '../hooks/useTeacherScope';
import {
  LayoutDashboard,
  FileText,
  Users,
  GraduationCap,
  IdCard,
  BarChart3,
  NotebookPen,
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
  'Academic Hub': LayoutDashboard,
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
  'Import Center': UploadCloud,
  'SF1 Bulk Import': UploadCloud,
  'SF10 Import': UploadCloud,
};

export default function Sidebar({ currentPage, onNavigate, user, userRoles, openMobile = false, onCloseMobile }) {
  const [collapsed, setCollapsed] = useState(false);
  const { schoolYears } = useAcademicCalendar();
  // Every subject this user is actually assigned to teach (from
  // users/{uid}.assignments) -- Class Record's sidebar subcategories are
  // built from this alone, never the school's full subject catalog.
  const { subjectMap } = useTeacherScope(user, schoolYears[0] || "2026-2027");
  const subjectNames = Array.from(subjectMap.keys()).sort();

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
    {
      label: 'Learner Records',
      children: [
        { label: 'View Learners', page: 'viewLearners' },
        { label: 'SF1', page: 'sf1' },
        { label: 'Transfers', page: 'transfersLog' },
      ],
    },
    {
      label: 'Attendance & Forms',
      children: [
        { label: 'SF2', page: 'sf2' },
        { label: 'SF4', page: 'sf4' },
      ],
    },
    {
      label: 'Academics',
      children: [
        {
          label: 'Class Record',
          page: 'classRecord',
          // One subcategory per subject this user is actually assigned to
          // teach (from users/{uid}.assignments) -- never every subject in
          // the school. An adviser-only user (no subject assignments) keeps
          // the plain link, unchanged.
          subcategories: subjectNames.map((subject) => {
            const firstClass = subjectMap.get(subject)?.[0];
            return {
              label: subject,
              page: 'classRecord',
              payload: firstClass
                ? { subject, gradeLevel: firstClass.gradeLevel, section: firstClass.section }
                : { subject },
            };
          }),
        },
        { label: 'Consolidated Grades', page: 'consolidatedGrades' },
        { label: 'Academic Hub', page: 'academicHub' },
        { label: 'Report Card (SF9)', page: 'reportCard' },
        { label: 'SF10 Generator', page: 'sf10Generate' },
        { label: 'Class Program & Load', page: 'classProgram' },
      ],
    },
    {
      label: 'Learner Welfare',
      children: [
        { label: 'LARDO Tracking', page: 'lardoTracking' },
        { label: 'Nutrition Status', page: 'nutritionStatus' },
        { label: 'Nutrition Consolidator', page: 'nutritionConsolidator' },
        { label: 'Anecdotal Records', page: 'anecdotalRecords' },
      ],
    },
    {
      label: 'SMEA',
      children: [{ label: 'Enrollment', page: 'smeaEnrollment' }],
    },
    {
      label: 'Documents',
      children: [
        { label: 'Certificates', page: 'certificates' },
        { label: 'ID Generator', page: 'idGenerator' },
      ],
    },
    {
      label: 'Admin',
      children: [
        { label: 'Import Center', page: 'importCenter' },
        { label: 'SF1 Bulk Import', page: 'sf1Import' },
        { label: 'SF10 Import', page: 'sf10Import' },
        { label: 'User Management', page: 'userManagement' },
        // Branding is a tab inside School Settings now, not a separate page.
        { label: 'School Settings', page: 'schoolSettings' },
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

  function handleNavClick(page, payload) {
    onNavigate(page, payload);
    if (openMobile) {
      toggleMobile();
    }
  }

  function NavIcon({ label }) {
    const Icon = icons[label];
    return Icon ? <Icon size={18} strokeWidth={2} /> : null;
  }

  function NavButton({ label, page, payload, active, indent = false }) {
    return (
      <button
        type="button"
        title={collapsed ? label : undefined}
        className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 active:scale-[0.97] ${
          active
            ? 'bg-white/15 text-white font-semibold shadow-sm dark:bg-white/10'
            : 'text-white/75 hover:bg-white/10 hover:text-white dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
        } ${collapsed ? 'justify-center' : ''} ${indent && !collapsed ? 'pl-8' : ''}`}
        onClick={() => handleNavClick(page, payload)}
      >
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-accent transition-all duration-150 ${
            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
          }`}
        />
        <span className={`flex-shrink-0 transition-transform duration-150 ease-out ${active ? 'scale-110' : ''}`}>
          <NavIcon label={label} />
        </span>
        <span
          className={`truncate overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${
            collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100 delay-75'
          }`}
        >
          {label}
        </span>
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
          {collapsed ? (
            <Tooltip label="Expand sidebar" position="right" className="hidden md:inline-flex">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-expanded={false}
                aria-label="Expand sidebar"
                className="group/logo relative flex-shrink-0 w-[38px] h-[38px] rounded-full transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
              >
                <img
                  src={'/Tingub%20National%20High%20School%28clear%29.png'}
                  alt="Tingub National High School"
                  width={38}
                  height={38}
                  className="absolute inset-0 rounded-full bg-white ring-2 ring-white/20 transition-opacity duration-150 group-hover/logo:opacity-0"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/10 ring-2 ring-white/20 text-white opacity-0 scale-75 transition-all duration-150 ease-out group-hover/logo:opacity-100 group-hover/logo:scale-100">
                  <ChevronRight size={18} />
                </span>
              </button>
            </Tooltip>
          ) : (
            <img
              src={'/Tingub%20National%20High%20School%28clear%29.png'}
              alt="Tingub National High School"
              width={38}
              height={38}
              className="rounded-full bg-white ring-2 ring-white/20 flex-shrink-0"
            />
          )}
          <div
            className={`min-w-0 overflow-hidden transition-all duration-200 ease-out ${
              collapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100 delay-75'
            }`}
          >
            <div className="text-sm font-semibold text-white dark:text-gray-100 leading-tight truncate">Tingub National High School</div>
            <div className="text-[11px] font-medium tracking-wide text-accent-light dark:text-accent-light truncate">LIKHA-SIS</div>
          </div>
        </div>

        {!collapsed && (
          <Tooltip label="Collapse sidebar" position="right" className="hidden md:inline-flex animate-fade-in">
            <button
              className="group flex items-center justify-center w-7 h-7 rounded-lg text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all duration-150 dark:text-gray-300 dark:hover:text-white"
              aria-expanded={true}
              aria-label="Collapse sidebar"
              onClick={toggleCollapsed}
              type="button"
            >
              <ChevronLeft size={16} className="transition-transform duration-150 group-hover:-translate-x-0.5" />
            </button>
          </Tooltip>
        )}

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
                  {item.children.map((c) =>
                    c.subcategories && c.subcategories.length > 0 ? (
                      <li key={c.label}>
                        {!collapsed && (
                          <p
                            className={`px-3 pt-1 pb-0.5 text-xs font-semibold ${
                              currentPage === c.page ? 'text-white dark:text-white' : 'text-white/60 dark:text-gray-400'
                            }`}
                          >
                            {c.label}
                          </p>
                        )}
                        <ul className="space-y-1">
                          {c.subcategories.map((sub) => (
                            <li key={sub.label}>
                              {/* Which of these subjects is currently loaded lives
                                  inside ClassRecord's own state, not Sidebar's --
                                  these are one-shot navigation actions rather than
                                  a persistently "active" item. */}
                              <NavButton label={sub.label} page={sub.page} payload={sub.payload} active={false} indent />
                            </li>
                          ))}
                        </ul>
                      </li>
                    ) : (
                      <li key={c.label}>
                        <NavButton label={c.label} page={c.page} active={currentPage === c.page} />
                      </li>
                    )
                  )}
                </ul>
              </li>
            ) : (
              <li key={item.label}>
                <NavButton label={item.label} page={item.page} active={currentPage === item.page} />
              </li>
            )
          )}
        </ul>
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
