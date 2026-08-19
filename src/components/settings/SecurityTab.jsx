// src/components/settings/SecurityTab.jsx
// Changes the School Settings key. The current key is required even though the
// page is already unlocked -- that is the point of the safety net: an unlocked
// tab left open on a shared staff machine must not be enough to silently
// change the key and lock the real ICT Coordinator out.

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { KeyRound, ShieldCheck } from "lucide-react";
import {
  SETTINGS_KEY_MIN_LENGTH,
  hashSettingsKey,
  validateSettingsKey,
  verifySettingsKey,
} from "../../utils/settingsLock.js";
import { SETTINGS_SECURITY_DOC } from "./SettingsLockScreen.jsx";
import StatusMessages from "./StatusMessages.jsx";
import { inputClass, labelClass, cardClass, primaryButtonClass } from "./settingsStyles.js";

export default function SecurityTab({ user }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentKey, setCurrentKey] = useState("");
  const [newKey, setNewKey] = useState("");
  const [confirmKey, setConfirmKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", SETTINGS_SECURITY_DOC));
        if (!cancelled) setRecord(snap.exists() ? snap.data() : null);
      } catch (err) {
        console.error("Failed to load settings security doc:", err);
        if (!cancelled) setErrorMessage("Could not load the current key settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChangeKey(e) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validateSettingsKey(newKey, confirmKey);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const currentOk = await verifySettingsKey(currentKey, record);
      if (!currentOk) {
        setErrorMessage("The current School Settings key is incorrect.");
        return;
      }

      const hashed = await hashSettingsKey(newKey);
      await setDoc(doc(db, "settings", SETTINGS_SECURITY_DOC), {
        ...hashed,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email || "",
      });
      setRecord(hashed);
      setCurrentKey("");
      setNewKey("");
      setConfirmKey("");
      setSuccessMessage("School Settings key changed. Use the new key the next time settings are locked.");
    } catch (err) {
      console.error("Failed to change School Settings key:", err);
      setErrorMessage("Failed to change the School Settings key. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />;
  }

  return (
    <form onSubmit={handleChangeKey} className="space-y-6 max-w-lg">
      <StatusMessages successMessage={successMessage} errorMessage={errorMessage} />

      <div className={`${cardClass} space-y-4`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Change School Settings Key</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              At least {SETTINGS_KEY_MIN_LENGTH} characters. LIKHA-SIS stores only a one-way hash, so a
              forgotten key cannot be recovered — only reset by deleting settings/security in Firestore.
            </p>
          </div>
        </div>

        <label className={labelClass}>
          Current key
          <input
            type="password"
            autoComplete="off"
            className={inputClass}
            value={currentKey}
            onChange={(e) => setCurrentKey(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          New key
          <input
            type="password"
            autoComplete="off"
            className={inputClass}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Confirm new key
          <input
            type="password"
            autoComplete="off"
            className={inputClass}
            value={confirmKey}
            onChange={(e) => setConfirmKey(e.target.value)}
          />
        </label>

        {record?.updatedByEmail && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Key last set by {record.updatedByEmail}.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSaving} className={primaryButtonClass}>
          <ShieldCheck size={16} />
          {isSaving ? "Saving..." : "Change Key"}
        </button>
      </div>
    </form>
  );
}
