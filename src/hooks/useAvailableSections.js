import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export default function useAvailableSections(gradeLevel, schoolYear) {
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
        // Query learners collection filtered by gradeLevel and schoolYear.
        const learnersRef = collection(db, "learners");
        const q = query(
          learnersRef,
          where("gradeLevel", "==", gradeLevel),
          where("schoolYear", "==", schoolYear)
        );
        const snapshot = await getDocs(q);
        if (cancelled) return;

        // Extract distinct, non-empty section values.
        const sectionSet = new Set();
        snapshot.forEach((docSnap) => {
          const section = docSnap.data().section;
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
  }, [gradeLevel, schoolYear]);

  return { sections, loading };
}