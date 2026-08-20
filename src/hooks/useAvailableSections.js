import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// `refreshKey` is accepted for backward compatibility with existing callers
// but is no longer needed: the collection listener below already pushes
// updates live, so a section created by an SF1 bulk import (or anywhere
// else) now appears immediately without the caller having to force a
// re-render by changing gradeLevel/schoolYear and back.
export default function useAvailableSections(gradeLevel, schoolYear) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    async function subscribe() {
      // If gradeLevel or schoolYear is falsy, return an empty array without querying.
      if (!gradeLevel || !schoolYear) {
        setSections([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Listen to the learners collection and derive distinct sections
      // CLIENT-SIDE, live.
      //
      // This deliberately avoids a compound Firestore query
      // (where("gradeLevel", ...) + where("schoolYear", ...)), which would
      // require a composite index on the learners collection. That index is
      // not declared in firestore.indexes.json, so the compound query throws
      // "query requires an index" at runtime and would otherwise silently
      // return [], meaning sections never showed up — e.g. a section that
      // was just created by an SF1 bulk import never appeared on the SF1 /
      // Class Record / Report Card pages. Listening to the whole collection
      // and filtering here matches how every other learner-reading module in
      // the app reads Firestore (ReportCard, ClassRecord, ConsolidatedGrades, ...).
      unsubscribe = onSnapshot(
        collection(db, "learners"),
        (snapshot) => {
          const sectionSet = new Set();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.gradeLevel !== gradeLevel) return;
            if (data.schoolYear !== schoolYear) return;
            const section = data.section;
            if (section && section.trim()) {
              sectionSet.add(section.trim());
            }
          });
          setSections(Array.from(sectionSet).sort());
          setLoading(false);
        },
        (err) => {
          console.error("Error fetching available sections:", err);
          setSections([]);
          setLoading(false);
        }
      );
    }

    subscribe();
    return () => unsubscribe();
  }, [gradeLevel, schoolYear]);

  return { sections, loading };
}