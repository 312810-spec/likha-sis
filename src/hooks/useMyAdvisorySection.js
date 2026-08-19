// src/hooks/useMyAdvisorySection.js
// Once an ICT Coordinator has assigned a teacher as a section's adviser
// (schedules/{schoolYear}/sections/{id}.adviserId), this hook lets that
// teacher's own screens (Class Record, Dashboard) find the section without
// them re-picking it from a dropdown every time.

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export default function useMyAdvisorySection(userId, schoolYear) {
  const [advisorySection, setAdvisorySection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId || !schoolYear) {
        setAdvisorySection(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const q = query(
          collection(db, "schedules", schoolYear, "sections"),
          where("adviserId", "==", userId)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const first = snap.docs[0];
        setAdvisorySection(first ? { id: first.id, ...first.data() } : null);
      } catch (err) {
        console.error("Failed to load advisory section:", err);
        if (!cancelled) setAdvisorySection(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, schoolYear]);

  return { advisorySection, loading };
}
