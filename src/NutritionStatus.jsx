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

const GRADE_OPTIONS = [
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
];

export default function NutritionStatus({ user, goBack }) {
  // Filter state
  const [gradeLevel, setGradeLevel] = useState("Grade 4");
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
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3">
          {goBack && (
            <button
              onClick={goBack}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <HeartPulse className="w-6 h-6 text-rose-500" />
              Nutrition Status Tracking
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              DepEd / WHO 2007 Growth Reference (BMI-for-Age) baseline & annual monitoring
            </p>
          </div>
        </div>

        {isLoaded && gridData.length > 0 && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm text-sm"
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
        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Grade Level
          </label>
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Section
          </label>
          <input
            type="text"
            placeholder="e.g. Kindness"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            School Year
          </label>
          <input
            type="text"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Measurement Date
          </label>
          <input
            type="date"
            value={measurementDate}
            onChange={(e) => setMeasurementDate(e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-medium px-4 py-2 rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors shadow-sm text-sm"
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Grid */}
      {isLoaded && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
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
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {gridData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
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
                      <tr key={learner.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-xs">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {learner.lastName}, {learner.firstName}{" "}
                          {learner.middleName ? learner.middleName : ""}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                          {learner.lrn || learner.learnerLRN || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {learner.sex || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">
                          {learner.birthDate || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-mono text-xs">
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
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
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
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                          {bmi !== null ? bmi.toFixed(2) : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {status === "Severely Wasted" || status === "Wasted" ? (
                            <span className="inline-block bg-red-100 text-red-800 border border-red-300 font-semibold px-2.5 py-1 rounded-full text-xs">
                              {status}
                            </span>
                          ) : status === "Normal" ? (
                            <span
                              className="inline-block font-semibold px-2.5 py-1 rounded-full text-xs"
                              style={{
                                backgroundColor: "rgba(30, 92, 41, 0.12)",
                                color: "#1E5C29",
                                borderColor: "rgba(30, 92, 41, 0.3)",
                                borderWidth: "1px",
                              }}
                            >
                              {status}
                            </span>
                          ) : status === "Overweight" || status === "Obese" ? (
                            <span
                              className="inline-block font-semibold px-2.5 py-1 rounded-full text-xs"
                              style={{
                                backgroundColor: "rgba(242, 169, 59, 0.18)",
                                color: "#B87A14",
                                borderColor: "rgba(242, 169, 59, 0.4)",
                                borderWidth: "1px",
                              }}
                            >
                              {status}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
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
      {isLoaded && gridData.length > 0 && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            Nutritional Status Summary
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <span className="block text-xs font-semibold text-red-700">Severely Wasted</span>
              <span className="text-2xl font-bold text-red-800">{summaryCounts.severelyWasted}</span>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <span className="block text-xs font-semibold text-red-700">Wasted</span>
              <span className="text-2xl font-bold text-red-800">{summaryCounts.wasted}</span>
            </div>

            <div
              className="rounded-lg p-3 text-center"
              style={{
                backgroundColor: "rgba(30, 92, 41, 0.08)",
                borderColor: "rgba(30, 92, 41, 0.25)",
                borderWidth: "1px",
              }}
            >
              <span className="block text-xs font-semibold" style={{ color: "#1E5C29" }}>
                Normal
              </span>
              <span className="text-2xl font-bold" style={{ color: "#1E5C29" }}>
                {summaryCounts.normal}
              </span>
            </div>

            <div
              className="rounded-lg p-3 text-center"
              style={{
                backgroundColor: "rgba(242, 169, 59, 0.12)",
                borderColor: "rgba(242, 169, 59, 0.35)",
                borderWidth: "1px",
              }}
            >
              <span className="block text-xs font-semibold" style={{ color: "#B87A14" }}>
                Overweight
              </span>
              <span className="text-2xl font-bold" style={{ color: "#B87A14" }}>
                {summaryCounts.overweight}
              </span>
            </div>

            <div
              className="rounded-lg p-3 text-center"
              style={{
                backgroundColor: "rgba(242, 169, 59, 0.12)",
                borderColor: "rgba(242, 169, 59, 0.35)",
                borderWidth: "1px",
              }}
            >
              <span className="block text-xs font-semibold" style={{ color: "#B87A14" }}>
                Obese
              </span>
              <span className="text-2xl font-bold" style={{ color: "#B87A14" }}>
                {summaryCounts.obese}
              </span>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-center">
              <span className="block text-xs font-semibold text-slate-600">Pending / Unmeasured</span>
              <span className="text-2xl font-bold text-slate-700">{summaryCounts.unclassified}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
