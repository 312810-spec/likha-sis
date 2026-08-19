import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function useAvailableSections(gradeLevel, schoolYear, refreshKey) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // If gradeLevel or schoolYear is falsy, return an empty array without querying.
      if (!gradeLevel || !schoolYear) {
        setSections([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch the learners collection and derive distinct sections CLIENT-SIDE.
        //
        // This deliberately avoids a compound Firestore query
        // (where("gradeLevel", ...) + where("schoolYear", ...)), which would
        // require a composite index on the learners collection. That index is
        // not declared in firestore.indexes.json, so the compound query throws
        // "query requires an index" at runtime and the catch below silently
        // returned [], meaning sections never showed up — e.g. a section that
        // was just created by an SF1 bulk import never appeared on the SF1 /
        // Class Record / Report Card pages. Fetching the whole collection and
        // filtering here matches how every other learner-reading module in the
        // app reads Firestore (ReportCard, ClassRecord, ConsolidatedGrades, ...).
        const snapshot = await getDocs(collection(db, "learners"));
        if (cancelled) return;

        // Extract distinct, non-empty section values for the matching class.
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
      } catch (err) {
        console.error("Error fetching available sections:", err);
        if (!cancelled) setSections([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [gradeLevel, schoolYear, refreshKey]);

  return { sections, loading };
}