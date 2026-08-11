// src/Login.jsx
// This is the login screen teachers will see first.
// It asks for email + password, checks them against Firebase, and reports success/failure.

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { Mail, Lock, LogIn } from "lucide-react";

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
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/Tingub%20National%20High%20School%28clear%29.png"
            alt="Tingub National High School"
            className="w-16 h-16 mb-3"
          />
          <h1 className="text-xl font-bold text-primary">LIKHA-SIS</h1>
          <p className="text-sm text-gray-500 mt-1">Tingub National High School</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="teacher@tinguibnhs.edu.ph"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {errorMessage && (
            <p className="text-red-600 text-sm mb-4">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold text-white transition-colors ${
              isLoading ? "bg-primary-light cursor-not-allowed" : "bg-primary hover:bg-primary-light"
            }`}
          >
            <LogIn size={18} />
            {isLoading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;