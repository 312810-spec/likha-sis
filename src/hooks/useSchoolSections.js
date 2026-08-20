// src/hooks/useSchoolSections.js
// CRUD access to the canonical section registry at
// schedules/{schoolYear}/sections/{sectionId} -- the same collection Class
// Program Generator reads for its weekly grid and teacher-load sheets
// (gradeLevel, name, shiftId, adviserId). School Settings' Sections tab and
// the SetupWizard write into this one collection so there is a single
// source of truth for "what sections exist" instead of a second list.

import { useCallback, useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// A live listener rather than a one-shot fetch, so a section an SF1 bulk
// import auto-creates (see firestoreImport.js) shows up here immediately
// instead of only after a remount/reselect forces a refetch.
export default function useSchoolSections(schoolYear) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let unsubscribe = () => {};

    async function subscribe() {
      if (!schoolYear) {
        setSections([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError("");
      unsubscribe = onSnapshot(
        collection(db, "schedules", schoolYear, "sections"),
        (snap) => {
          setSections(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          console.error("Failed to load sections:", err);
          setLoadError("Could not load sections. Please refresh and try again.");
          setLoading(false);
        }
      );
    }

    subscribe();
    return () => unsubscribe();
  }, [schoolYear]);

  const saveSection = useCallback(
    async (section) => {
      await setDoc(doc(db, "schedules", schoolYear, "sections", section.id), section);
    },
    [schoolYear]
  );

  const removeSection = useCallback(
    async (sectionId) => {
      await deleteDoc(doc(db, "schedules", schoolYear, "sections", sectionId));
    },
    [schoolYear]
  );

  return { sections, loading, loadError, saveSection, removeSection };
}
