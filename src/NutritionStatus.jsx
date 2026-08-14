// src/NutritionStatus.jsx
// DepEd / WHO BMI-for-Age Nutrition Status tracking page for LIKHA-SIS.

import { useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import {
  getAgeInMonths,
  computeBMI,
  classifyNutritionalStatus,
} from "./utils/nutritionComputations";
import {
  Save,
  RefreshCw,
  ArrowLeft,
  HeartPulse,
  AlertCircle,
  CheckCircle2,
  Users,
} from "lucide-react";

export default function NutritionStatus({ user, goBack }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  const GRADE_OPTIONS = gradeOptions;

  // Filter state
  const [gradeLevel, setGradeLevel] = useState(gradeOptions[0] || "Grade 4");
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [measurementDate, setMeasurementDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Status & Grid state
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [gridData, setGridData] = useState([]);

  // Load learners and matching nutrition records
  async function handleLoad(e) {
    if (e) e.preventDefault();
    if (!section.trim()) {
      setErrorMessage("Please enter a section name.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      // 1. Fetch learners matching Grade Level & Section
      const learnersSnap = await getDocs(collection(db, "learners"));
      const allLearners = learnersSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const filteredLearners = allLearners.filter(
        (l) =>
          (l.gradeLevel || "").trim().toLowerCase() === gradeLevel.trim().toLowerCase() &&
          (l.section || "").trim().toLowerCase() === section.trim().toLowerCase()
      );

      // Sort alphabetically by lastName, then firstName
      filteredLearners.sort((a, b) => {
        const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
        if (last !== 0) return last;
        return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
      });

      // 2. Fetch existing nutritionRecords for each learner
      const rows = await Promise.all(
        filteredLearners.map(async (learner) => {
          const docId = `${learner.id}_${schoolYear.trim()}`;
          let heightM = "";
          let weightKg = "";
          let recordMeasDate = measurementDate;

          try {
            const recordSnap = await getDoc(doc(db, "nutritionRecords", docId));
            if (recordSnap.exists()) {
              const data = recordSnap.data();
              if (data.heightM !== undefined && data.heightM !== null) heightM = String(data.heightM);
              if (data.weightKg !== undefined && data.weightKg !== null) weightKg = String(data.weightKg);
              if (data.measurementDate) recordMeasDate = data.measurementDate;
            }
          } catch (err) {
            console.error(`Failed to load record for ${docId}:`, err);
          }

          return {
            learner,
            heightM,
            weightKg,
            recordMeasDate,
          };
        })
      );

      setGridData(rows);
      setIsLoaded(true);
      if (rows.length === 0) {
        setStatusMessage("No learners found matching the selected Grade Level and Section.");
      }
    } catch (err) {
      console.error("Failed to load learners:", err);
      setErrorMessage("Failed to load learners. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Handle height change for a row
  function handleHeightChange(index, value) {
    setGridData((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], heightM: value };
      return next;
    });
  }

  // Handle weight change for a row
  function handleWeightChange(index, value) {
    setGridData((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], weightKg: value };
      return next;
    });
  }

  // Save batch nutrition records to Firestore
  async function handleSave() {
    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      let savedCount = 0;

      for (const item of gridData) {
        const { learner, heightM, weightKg } = item;
        const h = parseFloat(heightM);
        const w = parseFloat(weightKg);

        if (isNaN(h) || h <= 0 || isNaN(w) || w <= 0) {
          continue;
        }

        const ageInMonths = getAgeInMonths(learner.birthDate, measurementDate);
        const bmi = computeBMI(w, h);
        const nutritionalStatus = classifyNutritionalStatus(bmi, ageInMonths, learner.sex);

        const docId = `${learner.id}_${schoolYear.trim()}`;
        const fullName = `${learner.lastName || ""}, ${learner.firstName || ""}${
          learner.middleName ? " " + learner.middleName : ""
        }`.trim();

        const recordPayload = {
          learnerId: learner.id,
          learnerName: fullName,
          learnerLRN: learner.lrn || learner.learnerLRN || "",
          sex: learner.sex || "",
          birthDate: learner.birthDate || "",
          gradeLevel: gradeLevel.trim(),
          section: section.trim(),
          schoolYear: schoolYear.trim(),
          heightM: h,
          weightKg: w,
          measurementDate: measurementDate.trim(),
          bmi,
          ageInMonths,
          nutritionalStatus,
          measuredByEmail: user?.email || "",
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, "nutritionRecords", docId), recordPayload, { merge: true });
        savedCount++;
      }

      setStatusMessage(`✓ Nutrition status records saved successfully for ${savedCount} learner(s).`);
    } catch (err) {
      console.error("Failed to save nutrition records:", err);
      setErrorMessage("Failed to save nutrition records. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // Calculate live summary statistics
  const summaryCounts = {
    severelyWasted: 0,
    wasted: 0,
    normal: 0,
    overweight: 0,
    obese: 0,
    unclassified: 0,
    total: gridData.length,
  };

  gridData.forEach((item) => {
    const h = parseFloat(item.heightM);
    const w = parseFloat(item.weightKg);
    if (isNaN(h) || h <= 0 || isNaN(w) || w <= 0) {
      summaryCounts.unclassified++;
      return;
    }
    const ageInMonths = getAgeInMonths(item.learner.birthDate, measurementDate);
    const bmi = computeBMI(w, h);
    const status = classifyNutritionalStatus(bmi, ageInMonths, item.learner.sex);

    switch (status) {
      case "Severely Wasted":
        summaryCounts.severelyWasted++;
        break;
      case "Wasted":
        summaryCounts.wasted++;
        break;
      case "Normal":
        summaryCounts.normal++;
        break;
      case "Overweight":
        summaryCounts.overweight++;
        break;
      case "Obese":
        summaryCounts.obese++;
        break;
      default:
        summaryCounts.unclassified++;
        break;
    }
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          {goBack && (
            <button
              onClick={goBack}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-150 active:scale-[0.98] transition-transform"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <HeartPulse className="w-6 h-6 text-rose-500" />
              Nutrition Status Tracking
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              DepEd / WHO 2007 Growth Reference (BMI-for-Age) baseline &amp; annual monitoring
            </p>
          </div>
        </div>

        {isLoaded && gridData.length > 0 && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors duration-150 active:scale-[0.98] transition-transform shadow-sm text-sm"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? "Saving..." : "Save Nutrition Records"}
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleLoad}
        className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Grade Level
          </label>
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-colors"
          >
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Section
          </label>
          <input
            type="text"
            placeholder="e.g. Kindness"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            School Year
          </label>
          <input
            type="text"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Measurement Date
          </label>
          <input
            type="date"
            value={measurementDate}
            onChange={(e) => setMeasurementDate(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors duration-150 active:scale-[0.98] transition-transform shadow-sm text-sm"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            {isLoading ? "Loading..." : "Load Class"}
          </button>
        </div>
      </form>

      {/* Notifications */}
      {errorMessage && (
        <div className="animate-fade-in bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusMessage && (
        <div className="animate-fade-in bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
        </div>
      )}

      {/* Grid */}
      {isLoaded && !isLoading && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs uppercase tracking-wider sticky top-0 z-10">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Learner Name</th>
                  <th className="py-3 px-4">LRN</th>
                  <th className="py-3 px-4 w-16">Sex</th>
                  <th className="py-3 px-4 w-28">Birth Date</th>
                  <th className="py-3 px-4 w-24">Age (Mos)</th>
                  <th className="py-3 px-4 w-28">Height (m)</th>
                  <th className="py-3 px-4 w-28">Weight (kg)</th>
                  <th className="py-3 px-4 w-24">BMI</th>
                  <th className="py-3 px-4 w-36 text-center">Nutritional Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
                {gridData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-500 dark:text-gray-400">
                      No learners found for Grade {gradeLevel} - {section}.
                    </td>
                  </tr>
                ) : (
                  gridData.map((row, idx) => {
                    const { learner, heightM, weightKg } = row;
                    const h = parseFloat(heightM);
                    const w = parseFloat(weightKg);
                    const ageInMonths = getAgeInMonths(learner.birthDate, measurementDate);
                    const bmi = computeBMI(w, h);
                    const status = classifyNutritionalStatus(bmi, ageInMonths, learner.sex);

                    return (
                      <tr key={learner.id} className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150">
                        <td className="py-3 px-4 text-center text-gray-400 dark:text-gray-500 font-mono text-xs">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                          {learner.lastName}, {learner.firstName}{" "}
                          {learner.middleName ? learner.middleName : ""}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-mono text-xs">
                          {learner.lrn || learner.learnerLRN || "—"}
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">
                          {learner.sex || "—"}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">
                          {learner.birthDate || "—"}
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-mono text-xs">
                          {ageInMonths !== null ? ageInMonths : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            step="0.01"
                            min="0.5"
                            max="2.5"
                            placeholder="e.g. 1.45"
                            value={heightM}
                            onChange={(e) => handleHeightChange(idx, e.target.value)}
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1 text-sm text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none font-mono"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            step="0.1"
                            min="5"
                            max="200"
                            placeholder="e.g. 35.5"
                            value={weightKg}
                            onChange={(e) => handleWeightChange(idx, e.target.value)}
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1 text-sm text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none font-mono"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-gray-800 dark:text-gray-200">
                          {bmi !== null ? bmi.toFixed(2) : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {status === "Severely Wasted" || status === "Wasted" ? (
                            <span className="inline-block bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-500/20 font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {status}
                            </span>
                          ) : status === "Normal" ? (
                            <span className="inline-block bg-leaf/10 text-leaf-dark dark:bg-leaf/20 dark:text-leaf-light border border-leaf/20 font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {status}
                            </span>
                          ) : status === "Overweight" || status === "Obese" ? (
                            <span className="inline-block bg-accent/10 text-accent-dark dark:bg-accent/20 dark:text-accent-light border border-accent/20 font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {status}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Panel */}
      {isLoaded && !isLoading && gridData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            Nutritional Status Summary
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-lg p-3 text-center">
              <span className="block text-xs font-semibold text-red-700 dark:text-red-300">Severely Wasted</span>
              <span className="text-2xl font-bold text-red-800 dark:text-red-200">{summaryCounts.severelyWasted}</span>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-lg p-3 text-center">
              <span className="block text-xs font-semibold text-red-700 dark:text-red-300">Wasted</span>
              <span className="text-2xl font-bold text-red-800 dark:text-red-200">{summaryCounts.wasted}</span>
            </div>

            <div className="bg-leaf/10 dark:bg-leaf/20 border border-leaf/20 rounded-lg p-3 text-center">
              <span className="block text-xs font-semibold text-leaf-dark dark:text-leaf-light">
                Normal
              </span>
              <span className="text-2xl font-bold text-leaf-dark dark:text-leaf-light">
                {summaryCounts.normal}
              </span>
            </div>

            <div className="bg-accent/10 dark:bg-accent/20 border border-accent/20 rounded-lg p-3 text-center">
              <span className="block text-xs font-semibold text-accent-dark dark:text-accent-light">
                Overweight
              </span>
              <span className="text-2xl font-bold text-accent-dark dark:text-accent-light">
                {summaryCounts.overweight}
              </span>
            </div>

            <div className="bg-accent/10 dark:bg-accent/20 border border-accent/20 rounded-lg p-3 text-center">
              <span className="block text-xs font-semibold text-accent-dark dark:text-accent-light">
                Obese
              </span>
              <span className="text-2xl font-bold text-accent-dark dark:text-accent-light">
                {summaryCounts.obese}
              </span>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
              <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400">Pending / Unmeasured</span>
              <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{summaryCounts.unclassified}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
