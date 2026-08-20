// src/hooks/useSchoolSections.js
// CRUD access to the canonical section registry at
// schedules/{schoolYear}/sections/{sectionId} -- the same collection Class
// Program Generator reads for its weekly grid and teacher-load sheets
// (gradeLevel, name, shiftId, adviserId). School Settings' Sections tab and
// the SetupWizard write into this one collection so there is a single
// source of truth for "what sections exist" instead of a second list.

import { useCallback, useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function useSchoolSections(schoolYear) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!schoolYear) {
        setSections([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError("");
      try {
        const snap = await getDocs(collection(db, "schedules", schoolYear, "sections"));
        if (cancelled) return;
        setSections(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load sections:", err);
        if (!cancelled) setLoadError("Could not load sections. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [schoolYear, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const saveSection = useCallback(
    async (section) => {
      await setDoc(doc(db, "schedules", schoolYear, "sections", section.id), section);
      reload();
    },
    [schoolYear, reload]
  );

  const removeSection = useCallback(
    async (sectionId) => {
      await deleteDoc(doc(db, "schedules", schoolYear, "sections", sectionId));
      reload();
    },
    [schoolYear, reload]
  );

  return { sections, loading, loadError, saveSection, removeSection, reload };
}
