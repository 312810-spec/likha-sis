// src/Dashboard.jsx
// This is the main screen teachers see after logging in.
// Right now it just shows a welcome message and placeholder menu —
// each menu item will become a real feature (forms, ID generator, etc.) in later phases.

import { signOut } from "firebase/auth";
import { auth } from "./firebase";

function Dashboard({ user, goToSF1, goToViewLearners }) {
  async function handleLogout() {
    try {
      await signOut(auth);
      // After sign-out, App.jsx will automatically detect "no user" and show Login again.
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  // These are placeholders for now — in later phases, each becomes its own real page.
  const menuItems = [
    "School Form 1 (Learner's Info)",
    "School Form 2 (Attendance)",
    "Certificates",
    "School Monitoring",
    "Evaluation & Assessment",
    "Anecdotal Records",
    "ID Generator (QR Code)",
    "Grade Data",
  ];

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "700px", margin: "40px auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ marginBottom: "4px" }}>LIKHA-SIS Dashboard</h1>
          <p style={{ color: "#555", marginTop: 0 }}>
            Logged in as: <strong>{user.email}</strong>
          </p>
        </div>
        <button onClick={handleLogout} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Log Out
        </button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h2>School Forms & Tools</h2>
<ul style={{ listStyle: "none", padding: 0 }}>
        {menuItems.map((item) => {
          const isSF1 = item.startsWith("School Form 1");
          return (
            <li
              key={item}
              onClick={isSF1 ? goToSF1 : undefined}
              style={{
                padding: "12px",
                marginBottom: "8px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                color: isSF1 ? "#000" : "#999",
                cursor: isSF1 ? "pointer" : "default",
                background: isSF1 ? "#eef6ff" : "transparent",
              }}
            >
              {item} {!isSF1 && <span style={{ fontSize: "12px" }}>(coming soon)</span>}
            </li>
          );
        })}
      </ul>
      <button
        onClick={goToViewLearners}
        style={{ marginTop: "16px", padding: "10px 16px", cursor: "pointer" }}
      >
        📋 View Saved Learners
      </button>
    </div>
  );
}

export default Dashboard;