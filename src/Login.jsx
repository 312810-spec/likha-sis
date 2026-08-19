// src/Login.jsx
// This is the login screen teachers will see first.
// It asks for email + password, checks them against Firebase, and reports success/failure.

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { Mail, Lock, LogIn, AlertCircle, ShieldAlert } from "lucide-react";

function Login({ deactivated = false, onSwitchToParent }) {
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark flex items-center justify-center px-4 dark:from-gray-950 dark:via-gray-950 dark:to-black">
      {/* Decorative ambient glow */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-leaf/20 blur-3xl" />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-black/20 p-8 dark:bg-gray-900 dark:shadow-black/50 animate-slide-up">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/Tingub%20National%20High%20School%28clear%29.png"
            alt="Tingub National High School"
            className="w-16 h-16 mb-3 rounded-full ring-4 ring-primary/10 dark:ring-primary-light/20"
          />
          <h1 className="font-display text-xl font-semibold text-primary tracking-tight dark:text-primary-light">LIKHA-SIS</h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Tingub National High School</p>
        </div>

        {deactivated && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400 animate-fade-in">
            <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
            <span>Your account has been deactivated. Contact your ICT Coordinator if you believe this is a mistake.</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white transition-colors text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-800"
                placeholder="teacher@tinguibnhs.edu.ph"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white transition-colors text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-800"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 animate-fade-in">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-[0.99] ${
              isLoading ? "bg-primary-light cursor-not-allowed opacity-80" : "bg-primary hover:bg-primary-light hover:shadow-md"
            }`}
          >
            <LogIn size={18} />
            {isLoading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {onSwitchToParent && (
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <p className="text-xs text-gray-400 dark:text-gray-600">
              Parent or Guardian?{" "}
              <button
                type="button"
                onClick={onSwitchToParent}
                className="text-primary dark:text-primary-light font-semibold underline cursor-pointer bg-transparent border-none p-0 text-xs"
              >
                Parent Portal Login →
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
