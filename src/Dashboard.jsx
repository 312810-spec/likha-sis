// src/Dashboard.jsx
// Dashboard content redesigned to fit inside DashboardShell.
// Responsible only for content; navigation and auth remain in the shell/sidebar.


function Dashboard({ user, goToSF1, goToSF2, goToViewLearners }) {
  const emailOrName = (user && (user.displayName || user.email)) || "Teacher";

  const styles = {
    container: { padding: "24px", fontFamily: "Inter, Arial, sans-serif", color: "#0b1220" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "18px" },
    titleGroup: { display: "flex", flexDirection: "column" },
    title: { margin: 0, fontSize: "20px", color: "#0306C3" },
    subtitle: { margin: 0, fontSize: "13px", color: "#475569" },
    cardsRow: { display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "14px" },
    card: { flex: "1 1 200px", minWidth: "180px", background: "#fff", border: "1px solid #e6e9ef", borderRadius: "8px", padding: "12px", boxShadow: "0 1px 4px rgba(3,6,195,0.06)", display: "flex", alignItems: "center", gap: "12px" },
    cardIcon: { width: "40px", height: "40px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "18px" },
    cardContent: { display: "flex", flexDirection: "column" },
    cardLabel: { fontSize: "12px", color: "#334155" },
    cardValue: { fontSize: "16px", color: "#0b1220", fontWeight: 600, marginTop: "6px" },

    mainGrid: { display: "grid", gridTemplateColumns: "1fr 320px", gap: "16px", marginTop: "20px" },
    panel: { background: "#fff", border: "1px solid #e6e9ef", borderRadius: "8px", padding: "14px", boxShadow: "0 1px 6px rgba(2,6,23,0.04)" },
    panelTitle: { margin: 0, fontSize: "14px", color: "#0b1220" },
    sectionRow: { display: "flex", justifyContent: "space-between", marginTop: "12px", gap: "8px" },
    smallStat: { flex: "1 1 0", padding: "8px", borderRadius: "6px", border: "1px solid #eef2ff", background: "#fff" },

    actionsList: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" },
    primaryButton: { background: "#0306C3", color: "#fff", border: "none", padding: "10px 12px", borderRadius: "6px", cursor: "pointer", textAlign: "left" },
    secondaryButton: { background: "#fff", color: "#0306C3", border: "1px solid #cbd5e1", padding: "10px 12px", borderRadius: "6px", cursor: "pointer", textAlign: "left" },

    muted: { color: "#94a3b8", fontSize: "13px" },
    recentList: { marginTop: "12px", listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "8px" },
    recentItem: { padding: "8px", borderRadius: "6px", border: "1px solid #f1f5f9", background: "#fff", fontSize: "13px", color: "#0b1220" }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <h2 style={styles.title}>Dashboard</h2>
          <p style={styles.subtitle}>Welcome back, <strong>{emailOrName}</strong></p>
        </div>
        <img src="/Tingub%20National%20High%20School%28clear%29.png" alt="School Logo" style={{ height: 48, borderRadius: 6 }} />
      </div>

      <div style={styles.cardsRow}>
        <div style={styles.card}>
          <div style={{ ...styles.cardIcon, background: "#0306C3" }}>👥</div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>Total Learners</div>
            <div style={styles.cardValue}>No data available yet.</div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ ...styles.cardIcon, background: "#074C0B" }}>🟢</div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>Enrollment</div>
            <div style={styles.cardValue}>No data available yet.</div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ ...styles.cardIcon, background: "#FE9C2F" }}>📄</div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>School Forms</div>
            <div style={styles.cardValue}>SF1 & SF2</div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ ...styles.cardIcon, background: "#F8F56A", color: "#0b1220" }}>📅</div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>Current School Year</div>
            <div style={styles.cardValue}>No data available yet.</div>
          </div>
        </div>
      </div>

      <section style={styles.mainGrid}>
        <div>
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>School Management Overview</h3>
            <p style={{ ...styles.muted, marginTop: 8 }}>Summary of learners and enrollment. Use the quick actions to manage forms and learners.</p>

            <div style={styles.sectionRow}>
              <div style={styles.smallStat}>
                <div style={{ fontSize: 12, color: "#334155" }}>Learner Summary</div>
                <div style={{ marginTop: 8, fontWeight: 600 }}>No data available yet.</div>
              </div>

              <div style={styles.smallStat}>
                <div style={{ fontSize: 12, color: "#334155" }}>Enrollment Summary</div>
                <div style={{ marginTop: 8, fontWeight: 600 }}>No data available yet.</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0b1220" }}>Quick access</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={goToSF1} style={{ ...styles.primaryButton }}>➕ Add Learner — SF1</button>
                <button onClick={goToViewLearners} style={{ ...styles.secondaryButton }}>📋 View Learners</button>
                <button onClick={goToSF2} style={{ ...styles.secondaryButton }}>📝 School Form 2</button>
              </div>
            </div>
          </div>

          <div style={{ ...styles.panel, marginTop: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>Recent Activity</h4>
            <p style={{ ...styles.muted, marginTop: 8 }}>Recent events will appear here.</p>
            <ul style={styles.recentList}>
              <li style={styles.recentItem}>No data available yet.</li>
            </ul>
          </div>
        </div>

        <aside>
          <div style={styles.panel}>
            <h4 style={{ margin: 0, fontSize: 14 }}>Quick Actions</h4>
            <div style={styles.actionsList}>
              <button onClick={goToSF1} style={styles.primaryButton}>Add Learner → SF1</button>
              <button onClick={goToViewLearners} style={styles.secondaryButton}>View Learners</button>
              <button onClick={goToSF2} style={styles.secondaryButton}>School Form 2 → SF2</button>
            </div>
          </div>

          <div style={{ ...styles.panel, marginTop: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>Support</h4>
            <p style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>Need help? Use the sidebar to access account or logout controls.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

export default Dashboard;