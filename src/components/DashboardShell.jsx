import Sidebar from './Sidebar';

export default function DashboardShell({ children, currentPage, onNavigate, user, pageTitle = 'Dashboard' }) {
  return (
    <div className="dashboard-shell" role="region" aria-label="Dashboard Shell">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} user={user} />

      <main className="main-content">
        <div className="header-row">
          <div>
            <h2>{pageTitle}</h2>
            <p style={{ marginTop: 6, color: 'var(--text)' }}>Welcome to LIKHA-SIS — Tingub National High School</p>
          </div>

          <div className="toolbar" aria-hidden>
            <button type="button" aria-label="Notifications">🔔</button>
            <button type="button" aria-label="Profile">👤</button>
          </div>
        </div>

        <section aria-label="Main" style={{ marginTop: 8 }}>
          {children ? children : <p style={{ color: 'var(--text)' }}>Select a section from the sidebar to begin.</p>}
        </section>
      </main>
    </div>
  );
}
