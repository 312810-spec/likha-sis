// src/pages/ParentLogin.jsx
// A separate, visually distinct login page for parents.
// Uses the same Firebase Auth underneath but routes to ParentPortal on success.
// Keeps parent and teacher login flows completely separate to avoid confusion.

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { Mail, Lock, GraduationCap, AlertCircle, LogIn } from "lucide-react";

/**
 * @param {object} props
 * @param {() => void} props.onSwitchToTeacher - Navigate back to the teacher login
 */
function ParentLogin({ onSwitchToTeacher }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    setErrorMessage("");
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // App.jsx will detect the new auth state and route to ParentPortal
      // based on the 'parent' role in the user's Firestore document.
    } catch (error) {
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
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
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, rgb(var(--color-primary-dark)) 0%, rgb(var(--color-primary)) 50%, rgb(var(--color-primary-dark)) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient decorative blobs */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          right: "-80px",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "rgb(var(--color-accent) / 0.16)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-80px",
          left: "-80px",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "rgba(99, 179, 237, 0.08)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "360px",
          background: "#ffffff",
          borderRadius: "20px",
          padding: "36px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-primary-light)))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              boxShadow: "0 4px 16px rgba(26,47,95,0.35)",
            }}
          >
            <GraduationCap size={26} color="rgb(var(--color-accent-light))" />
          </div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "rgb(var(--color-primary))",
              letterSpacing: "-0.01em",
              margin: "0 0 4px",
            }}
          >
            Parent Portal
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            Tingub National High School
          </p>
          <div
            style={{
              display: "inline-block",
              marginTop: "8px",
              background: "#FEF3C7",
              color: "#92400E",
              fontSize: "11px",
              fontWeight: 600,
              padding: "2px 10px",
              borderRadius: "12px",
              letterSpacing: "0.04em",
            }}
          >
            PARENT / GUARDIAN ACCESS
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              htmlFor="parent-email"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <Mail
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9ca3af",
                }}
              />
              <input
                id="parent-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                style={{
                  width: "100%",
                  paddingLeft: "36px",
                  paddingRight: "12px",
                  paddingTop: "10px",
                  paddingBottom: "10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  fontSize: "14px",
                  background: "#f9fafb",
                  color: "#111827",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgb(var(--color-primary))")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="parent-password"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9ca3af",
                }}
              />
              <input
                id="parent-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: "100%",
                  paddingLeft: "36px",
                  paddingRight: "12px",
                  paddingTop: "10px",
                  paddingBottom: "10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  fontSize: "14px",
                  background: "#f9fafb",
                  color: "#111827",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgb(var(--color-primary))")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>
          </div>

          {errorMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                padding: "10px 12px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                color: "#B91C1C",
                fontSize: "13px",
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "11px",
              background: isLoading ? "rgb(var(--color-primary-light))" : "linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-primary-light)))",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              boxShadow: isLoading ? "none" : "0 4px 12px rgba(26,47,95,0.35)",
              transition: "all 0.15s",
              letterSpacing: "0.01em",
            }}
          >
            <LogIn size={16} />
            {isLoading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Switch to teacher login */}
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#9ca3af" }}>
            Are you a teacher or staff member?{" "}
            <button
              onClick={onSwitchToTeacher}
              style={{
                background: "none",
                border: "none",
                color: "rgb(var(--color-primary))",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "12px",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Staff Login →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ParentLogin;
