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

// Defaults missing DO 017 SHS sub-fields so a pre-migration or
// partially-written schoolConfig doc never crashes a consumer that reads
// config.shs.subjects / config.shs.electiveClusters directly. The `{...data}`
// spread below replaces `fallback.shs` wholesale when `data.shs` exists, so
// this needs to run after that spread, not rely on it.
function normalizeShsConfig(shs) {
  return {
    subjects: Array.isArray(shs?.subjects) ? shs.subjects : [],
    electiveClusters: Array.isArray(shs?.electiveClusters) ? shs.electiveClusters : [],
  };
}

// Helper exported for unit testing
export function snapshotToConfig(docSnap, fallback = fallbackConfig) {
  if (!docSnap || !docSnap.exists()) {
    return {
      ...fallback,
      gradeLevelsOffered: fallback.gradeLevelsOffered || [...DEFAULT_GRADE_LEVELS],
      shs: normalizeShsConfig(fallback.shs),
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
    shs: normalizeShsConfig(data.shs || fallback.shs),
  };
}

export default function useSchoolConfig() {
  const [config, setConfig] = useState(() => ({
    ...fallbackConfig,
    gradeLevelsOffered: fallbackConfig.gradeLevelsOffered || [...DEFAULT_GRADE_LEVELS],
    shs: normalizeShsConfig(fallbackConfig.shs),
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
          shs: normalizeShsConfig(fallbackConfig.shs),
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { config, loading };
}
