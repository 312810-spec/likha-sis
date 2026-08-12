import { useState } from 'react';
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
} from 'lucide-react';

const icons = {
  Dashboard: LayoutDashboard,
  'School Forms': FileText,
  SF1: FileText,
  SF2: FileText,
  'View Learners': Users,
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

export default function Sidebar({ currentPage, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);

  function toggleCollapsed() {
    setCollapsed((s) => !s);
  }

  function toggleMobile() {
    setOpenMobile((s) => !s);
  }

  const nav = [
    { label: 'Dashboard', page: 'dashboard' },
    { label: 'Import Center', page: 'importCenter' },
    {
      label: 'School Forms',
      children: [
        { label: 'SF1', page: 'sf1' },
        { label: 'SF2', page: 'sf2' },
      ],
    },
    { label: 'View Learners', page: 'viewLearners' },
    { label: 'Certificates', page: 'certificates' },
    { label: 'ID Generator', page: 'idGenerator' },
    {
      label: 'SMEA',
      children: [
        { label: 'Enrollment', page: 'smeaEnrollment' },
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

  const future = [
    {
      label: 'SMEA',
      children: [{ label: 'Anecdotal Records' }],
    },
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
    return Icon ? <Icon size={18} /> : null;
  }

  return (
    <aside
      className={`${collapsed ? 'w-20' : 'w-64'} ${openMobile ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static top-0 left-0 h-screen bg-primary text-white flex flex-col transition-all duration-200 z-40`}
      aria-label="Primary"
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={'/Tingub%20National%20High%20School%28clear%29.png'}
            alt="Tingub National High School"
            width={36}
            height={36}
            className="rounded-full bg-white flex-shrink-0"
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Tingub National High School</div>
              <div className="text-xs text-accent-light">LIKHA-SIS</div>
            </div>
          )}
        </div>

        <button
          className="hidden md:block text-white/70 hover:text-white text-lg"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
          type="button"
        >
          {collapsed ? '»' : '«'}
        </button>

        <button
          className="md:hidden text-white/70 hover:text-white text-lg"
          aria-label="Toggle sidebar"
          onClick={toggleMobile}
          type="button"
        >
          ☰
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-1">
          {nav.map((item) =>
            item.children ? (
              <li key={item.label}>
                {!collapsed && (
                  <h3 className="px-3 pt-3 pb-1 text-xs uppercase tracking-wide text-accent-light font-semibold">
                    {item.label}
                  </h3>
                )}
                <ul className="space-y-1">
                  {item.children.map((c) => (
                    <li key={c.label}>
                      <button
                        type="button"
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          currentPage === c.page
                            ? 'bg-accent text-primary-dark font-semibold'
                            : 'text-white/80 hover:bg-white/10'
                        }`}
                        onClick={() => handleNavClick(c.page)}
                      >
                        <NavIcon label={c.label} />
                        {!collapsed && <span>{c.label}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={item.label}>
                <button
                  type="button"
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentPage === item.page
                      ? 'bg-accent text-primary-dark font-semibold'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                  onClick={() => handleNavClick(item.page)}
                >
                  <NavIcon label={item.label} />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              </li>
            )
          )}
        </ul>

        <div className="mt-6">
          {!collapsed && (
            <h3 className="px-3 pb-1 text-xs uppercase tracking-wide text-accent-light font-semibold">Future</h3>
          )}
          <ul className="space-y-1">
            {future.map((sec) => (
              <li key={sec.label}>
                {!collapsed && (
                  <h3 className="px-3 pt-2 pb-1 text-xs text-white/60">{sec.label}</h3>
                )}
                <ul className="space-y-1">
                  {sec.children.map((c) => (
                    <li key={c.label}>
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 cursor-not-allowed"
                        disabled
                        type="button"
                      >
                        <NavIcon label={c.label} />
                        {!collapsed && <span>{c.label} (Coming Soon)</span>}
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
          className="fixed inset-0 bg-black/40 md:hidden -z-10"
          onClick={toggleMobile}
        />
      )}
    </aside>
  );
}