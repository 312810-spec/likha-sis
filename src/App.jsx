// src/App.jsx
// This is the "traffic controller" of our app.
// It watches Firebase for "is anyone logged in?" and shows Login or Dashboard accordingly.

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import Dashboard from "./Dashboard";

function App() {
  const [user, setUser] = useState(null);       // who's logged in (or null if nobody)
  const [isChecking, setIsChecking] = useState(true); // are we still checking on first load?

  useEffect(() => {
    // onAuthStateChanged is Firebase's built-in "watcher" —
    // it runs automatically every time someone logs in OR logs out, anywhere in the app.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // currentUser is either a user object, or null
      setIsChecking(false);
    });

    // Cleanup: stop watching if this component ever goes away (good practice, prevents memory leaks)
    return () => unsubscribe();
  }, []);

  // While Firebase is still checking (happens fast, but not instantly), show a simple loading message
  if (isChecking) {
    return <p style={{ textAlign: "center", marginTop: "80px" }}>Loading...</p>;
  }

  // The core logic: if we have a user, show Dashboard. Otherwise, show Login.
  return user ? <Dashboard user={user} /> : <Login />;
}

export default App;