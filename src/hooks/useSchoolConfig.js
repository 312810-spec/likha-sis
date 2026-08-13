import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import fallbackConfig from "../schoolConfig";

export const DEFAULT_GRADE_LEVELS = [
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
];

// Helper exported for unit testing
export function snapshotToConfig(docSnap, fallback = fallbackConfig) {
  if (!docSnap || !docSnap.exists()) {
    return {
      ...fallback,
      gradeLevelsOffered: fallback.gradeLevelsOffered || [...DEFAULT_GRADE_LEVELS],
    };
  }

  const data = docSnap.data() || {};
  const gradeLevelsOffered =
    Array.isArray(data.gradeLevelsOffered) && data.gradeLevelsOffered.length > 0
      ? [...data.gradeLevelsOffered]
      : fallback.gradeLevelsOffered || [...DEFAULT_GRADE_LEVELS];

  return {
    ...fallback,
    ...data,
    gradeLevelsOffered,
  };
}

export default function useSchoolConfig() {
  const [config, setConfig] = useState(() => ({
    ...fallbackConfig,
    gradeLevelsOffered: fallbackConfig.gradeLevelsOffered || [...DEFAULT_GRADE_LEVELS],
  }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "settings", "schoolConfig");
    const unsubscribe = onSnapshot(
      ref,
      (docSnap) => {
        setConfig(snapshotToConfig(docSnap, fallbackConfig));
        setLoading(false);
      },
      () => {
        // on error, keep fallback but stop loading
        setConfig({
          ...fallbackConfig,
          gradeLevelsOffered: fallbackConfig.gradeLevelsOffered || [...DEFAULT_GRADE_LEVELS],
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { config, loading };
}
