// src/App.jsx
// Traffic controller: now handles THREE possible screens —
// Login, Dashboard, and SF1 — based on login state + which page is selected.

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import Dashboard from "./Dashboard";
import SF1 from "./SF1";

function App() {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [currentPage, setCurrentPage] = useState("dashboard"); // "dashboard" or "sf1"

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsChecking(false);
    });
    return () => unsubscribe();
  }, []);

  if (isChecking) {
    return <p style={{ textAlign: "center", marginTop: "80px" }}>Loading...</p>;
  }

  if (!user) {
    return <Login />;
  }

  // Logged in — decide which page to show based on currentPage
  if (currentPage === "sf1") {
    return <SF1 user={user} goBack={() => setCurrentPage("dashboard")} />;
  }

  return <Dashboard user={user} goToSF1={() => setCurrentPage("sf1")} />;
}

export default App;