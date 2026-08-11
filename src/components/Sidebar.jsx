import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Sidebar({ currentPage, onNavigate, user }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);

  function toggleCollapsed() {
    setCollapsed((s) => !s);
  }

  function toggleMobile() {
    setOpenMobile((s) => !s);
  }

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  const nav = [
    { label: 'Dashboard', page: 'dashboard' },
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
  ];

  const future = [
    {
      label: 'SMEA',
      children: [
        { label: 'Enrollment' },
        { label: 'Anecdotal Records' },
      ],
    },
    {
      label: 'Academic',
      children: [
        { label: 'Grades' },
        { label: 'Attendance' },
      ],
    },
  ];

  function handleNavClick(page) {
    onNavigate(page);
    if (openMobile) {
      toggleMobile();
    }
  }

  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${openMobile ? 'open' : ''}`}
      aria-label="Primary"
    >
      <div className="top-row">
        <div className="brand">
          <img
            src={'/Tingub%20National%20High%20School.png'}
            alt="Tingub National High School"
            width={44}
            height={44}
          />
          <div className="school-meta">
            <div className="school-name">Tingub National High School</div>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>LIKHA-SIS</div>
          </div>
        </div>

        <div className="controls">
          <button
            className="mobile-toggle"
            aria-label="Toggle sidebar"
            onClick={toggleMobile}
            title="Open menu"
            type="button"
          >
            ☰
          </button>

          <button
            className="collapse-btn"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
            type="button"
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
      </div>

      <nav className="nav" aria-label="Sidebar navigation">
        <div className="nav-section" aria-hidden={collapsed}>
          <ul className="nav-list">
            {nav.map((item) => (
              item.children ? (
                <li key={item.label}>
                  <div className="nav-group">
                    <h3>{item.label}</h3>
                    <ul className="nav-list">
                      {item.children.map((c) => (
                        <li key={c.label}>
                          <button
                            type="button"
                            className={`nav-link ${currentPage === c.page ? 'active' : ''}`}
                            onClick={() => handleNavClick(c.page)}
                          >
                            <span className="icon">{c.label[0]}</span>
                            <span className="label">{c.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ) : (
                <li key={item.label}>
                  <button
                    type="button"
                    className={`nav-link ${currentPage === item.page ? 'active' : ''}`}
                    onClick={() => handleNavClick(item.page)}
                  >
                    <span className="icon">{item.label[0]}</span>
                    <span className="label">{item.label}</span>
                  </button>
                </li>
              )
            ))}
          </ul>
        </div>

        <div className="nav-section">
          <h3>Future</h3>
          <ul className="nav-list">
            {future.map((sec) => (
              <li key={sec.label}>
                <div>
                  <h3>{sec.label}</h3>
                  <ul className="nav-list">
                    {sec.children.map((c) => (
                      <li key={c.label}>
                        <button className="nav-link disabled" disabled type="button">
                          <span className="icon">{c.label[0]}</span>
                          <span className="label">{c.label} (Coming Soon)</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="nav-section" style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px' }}>
            <span className="icon" style={{ fontSize: '12px' }}>👤</span>
            {!collapsed && (
              <div style={{ textAlign: 'left', flex: 1, fontSize: '12px', minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-h)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email || 'User'}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="nav-link"
            style={{ width: '100%' }}
          >
            <span className="icon">🚪</span>
            {!collapsed && <span className="label">Logout</span>}
          </button>
        </div>
      </nav>

      {/* Mobile overlay close (rendered in DOM, toggled via class) */}
      {openMobile && <div className="main-content-overlay" onClick={toggleMobile} />}
    </aside>
  );
}
