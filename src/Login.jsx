// src/Login.jsx
// This is the login screen teachers will see first.
// It asks for email + password, checks them against Firebase, and reports success/failure.

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

function Login() {
  // "State" is like a sticky note React watches — whenever it changes, the screen re-draws automatically.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault(); // stops the page from doing a full reload on submit (default browser behavior we don't want)

    // Basic validation before we even talk to Firebase
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // If we reach here, login succeeded. We'll handle "what happens next" once we build the Dashboard.
    } catch (error) {
      // Firebase gives technical error codes — we translate them into friendly messages
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        setErrorMessage("Incorrect email or password.");
      } else if (error.code === "auth/user-not-found") {
        setErrorMessage("No account found with that email.");
      } else if (error.code === "auth/invalid-email") {
        setErrorMessage("Please enter a valid email address.");
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "360px", margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>LIKHA-SIS</h1>
      <p style={{ textAlign: "center", color: "#555" }}>Tingub National High School</p>

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: "12px" }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            placeholder="teacher@tinguibnhs.edu.ph"
          />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            placeholder="Enter your password"
          />
        </div>

        {errorMessage && (
          <p style={{ color: "red", fontSize: "14px" }}>{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{ width: "100%", padding: "10px", cursor: isLoading ? "not-allowed" : "pointer" }}
        >
          {isLoading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}

export default Login;