// src/components/settings/SettingsLockScreen.jsx
// The safety net in front of School Settings. Two modes:
//
//   * "create" -- settings/security has no key yet (every school installed
//     before this feature shipped). The ICT Coordinator sets one here, so
//     nobody is ever locked out by the upgrade itself.
//   * "unlock" -- a key exists; it must be entered to reveal the tabs.
//
// Only the PBKDF2 derivation is ever written to Firestore. Wrong attempts are
// throttled client-side (see settingsLock.js for the honest threat model).

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import {
  MAX_UNLOCK_ATTEMPTS,
  SETTINGS_KEY_MIN_LENGTH,
  getCooldownRemainingMs,
  hasSettingsKey,
  hashSettingsKey,
  validateSettingsKey,
  verifySettingsKey,
} from "../../utils/settingsLock.js";
import { inputClass, labelClass, primaryButtonClass } from "./settingsStyles.js";
import { Lock, KeyRound, ShieldCheck, AlertCircle } from "lucide-react";

export const SETTINGS_SECURITY_DOC = "security";

export default function SettingsLockScreen({ user, onUnlocked }) {
  const [record, setRecord] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error

  const [keyInput, setKeyInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lastFailedAt, setLastFailedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const keyExists = hasSettingsKey(record);
  const cooldownMs = getCooldownRemainingMs(failedAttempts, lastFailedAt, now);
  const cooldownSeconds = Math.ceil(cooldownMs / 1000);

  useEffect(() => {
    let cancelled = false;
    async function loadSecurity() {
      try {
        const snap = await getDoc(doc(db, "settings", SETTINGS_SECURITY_DOC));
        if (cancelled) return;
        // A missing doc means "no key set yet" -- that is the create flow, not
        // an open door: the tabs still stay hidden until a key is chosen.
        setRecord(snap.exists() ? snap.data() : null);
        setLoadState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to read settings security doc:", err);
        // Fail closed. A read error must never be mistaken for "no key".
        setLoadState("error");
      }
    }
    loadSecurity();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ticks only while a cooldown is actually counting down.
  useEffect(() => {
    if (cooldownMs <= 0) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [cooldownMs]);

  const heading = useMemo(
    () => (keyExists ? "School Settings are locked" : "Create your School Settings key"),
    [keyExists]
  );

  async function handleCreateKey(event) {
    event.preventDefault();
    setErrorMessage("");

    const validationError = validateSettingsKey(keyInput, confirmInput);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setBusy(true);
    try {
      const hashed = await hashSettingsKey(keyInput);
      await setDoc(doc(db, "settings", SETTINGS_SECURITY_DOC), {
        ...hashed,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email || "",
      });
      setKeyInput("");
      setConfirmInput("");
      onUnlocked();
    } catch (err) {
      console.error("Failed to save School Settings key:", err);
      setErrorMessage("Could not save the School Settings key. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(event) {
    event.preventDefault();
    setErrorMessage("");

    if (cooldownMs > 0) return;

    setBusy(true);
    try {
      const ok = await verifySettingsKey(keyInput, record);
      if (ok) {
        setFailedAttempts(0);
        setLastFailedAt(null);
        setKeyInput("");
        onUnlocked();
        return;
      }
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      setLastFailedAt(Date.now());
      setNow(Date.now());
      setKeyInput("");
      setErrorMessage(
        attempts >= MAX_UNLOCK_ATTEMPTS
          ? "Too many incorrect attempts. Please wait before trying again."
          : `Incorrect School Settings key. ${MAX_UNLOCK_ATTEMPTS - attempts} attempt(s) left before a short lockout.`
      );
    } catch (err) {
      console.error("Failed to verify School Settings key:", err);
      setErrorMessage(err.message || "Could not verify the key. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className="max-w-md mx-auto">
        <div className="space-y-3 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="h-6 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-800 shadow-sm">
        <div className="flex items-start gap-3 text-red-800 dark:text-red-300">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Could not check the School Settings lock.</p>
            <p className="text-xs">
              Settings stay locked until this check succeeds. Check your connection and reload the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto animate-slide-up">
      <form
        onSubmit={keyExists ? handleUnlock : handleCreateKey}
        className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            {keyExists ? <Lock size={20} /> : <KeyRound size={20} />}
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{heading}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {keyExists
                ? "These settings shape every school form, report card and SF10 in the system. Enter the School Settings key to edit them."
                : `Choose a key of at least ${SETTINGS_KEY_MIN_LENGTH} characters. It is separate from your login password and will be required before any school setting can be changed.`}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-2.5 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{errorMessage}</p>
          </div>
        )}

        <label className={labelClass}>
          {keyExists ? "School Settings key" : "New School Settings key"}
          <input
            type="password"
            className={inputClass}
            value={keyInput}
            autoComplete="off"
            onChange={(e) => setKeyInput(e.target.value)}
            disabled={busy || cooldownMs > 0}
          />
        </label>

        {!keyExists && (
          <label className={labelClass}>
            Confirm School Settings key
            <input
              type="password"
              className={inputClass}
              value={confirmInput}
              autoComplete="off"
              onChange={(e) => setConfirmInput(e.target.value)}
              disabled={busy}
            />
          </label>
        )}

        {cooldownMs > 0 && (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Locked for {cooldownSeconds} more second(s).
          </p>
        )}

        <button type="submit" className={primaryButtonClass} disabled={busy || cooldownMs > 0}>
          <ShieldCheck size={16} />
          {busy ? "Checking..." : keyExists ? "Unlock Settings" : "Set Key & Continue"}
        </button>

        {!keyExists && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
            Store this key somewhere safe. LIKHA-SIS never stores the key itself — only a one-way hash — so
            it cannot be recovered, only reset by deleting settings/security in Firestore.
          </p>
        )}
      </form>
    </div>
  );
}
