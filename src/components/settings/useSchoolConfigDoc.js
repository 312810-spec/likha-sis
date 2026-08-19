// src/components/settings/useSchoolConfigDoc.js
// One-shot read/write access to settings/schoolConfig for the School Settings
// tabs. Each tab loads and saves only its own fields (always with merge: true),
// so saving School Identity can never wipe branding, SHS config or the
// academic calendar written by another tab.

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export default function useSchoolConfigDoc() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", "schoolConfig"));
        if (cancelled) return;
        setData(snap.exists() ? snap.data() : {});
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load school config:", err);
        setLoadError("Could not load school settings. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (patch) => {
    await setDoc(
      doc(db, "settings", "schoolConfig"),
      { ...patch, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }, []);

  return { data, loading, loadError, save };
}
