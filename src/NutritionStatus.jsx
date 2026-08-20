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
import useAvailableSections from "./hooks/useAvailableSections";
import {
  getAgeInMonths,
  computeBMI,
  classifyNutritionalStatus,
  classifyHeightForAge,
  normalizeSex,
} from "./utils/nutritionComputations";
import checkAutoFlagTriggers from "./utils/autoFlagTriggers";
import {
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
  Printer,
} from "lucide-react";
import PageHeader from "./components/PageHeader.jsx";
import Button from "./components/Button.jsx";

// Converts an age in months to the "X yrs Y mos" convention used on the SF8 report.
function formatAgeLabel(ageInMonths) {
  if (
    ageInMonths === null ||
    ageInMonths === undefined ||
    Number.isNaN(Number(ageInMonths))
  ) {
    return "—";
  }
  const totalMonths = Math.floor(Number(ageInMonths));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years} yrs ${months} mos` : `${years} yrs`;
}

export default function NutritionStatus({ user }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  const GRADE_OPTIONS = gradeOptions;

  // Filter state
  const [gradeLevelChoice, setGradeLevel] = useState(gradeOptions[0] || "Grade 4");
  // useSchoolConfig() resolves asynchronously, so gradeLevelChoice above is
  // seeded from the fallback grade list before the real (possibly narrower)
  // gradeLevelsOffered loads. Deriving the effective value at render time
  // (rather than syncing it back via an effect) keeps it always valid --
  // otherwise the section list would silently query a grade with none until
  // the user manually touched the dropdown.
  const gradeLevel = gradeOptions.includes(gradeLevelChoice)
    ? gradeLevelChoice
    : gradeOptions[0] || "Grade 4";
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [period, setPeriod] = useState("Baseline");
  const { sections: availableSections, loading } = useAvailableSections(gradeLevel, schoolYear);
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
  const [pendingFlagCandidates, setPendingFlagCandidates] = useState([]);
  // Renders the printable SF8 block while printing (same pattern as SF1/SF2).
  const [showPrintArea, setShowPrintArea] = useState(false);

  // Switching Baseline <-> Endline invalidates any grid already on screen:
  // the loaded heights/weights belong to the *previous* period, and handleSave
  // writes using the CURRENT period. Dropping the grid forces a fresh Load, so
  // measurements can never be saved under a period they weren't loaded for.
  function handlePeriodChange(nextPeriod) {
    if (nextPeriod === period) return;
    setPeriod(nextPeriod);
    setGridData([]);
    setIsLoaded(false);
    setErrorMessage("");
    setStatusMessage(
      `Period switched to ${nextPeriod}. Click "Load Class" to load the ${nextPeriod} measurements.`
    );
  }

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
          const docId = `${learner.id}_${schoolYear.trim()}_${period}`;
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
        const heightForAgeStatus = classifyHeightForAge(h, ageInMonths, learner.sex);

        const docId = `${learner.id}_${schoolYear.trim()}_${period}`;
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
          period,
          heightM: h,
          weightKg: w,
          measurementDate: measurementDate.trim(),
          bmi,
          ageInMonths,
          nutritionalStatus,
          heightForAgeStatus,
          measuredByEmail: user?.email || "",
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, "nutritionRecords", docId), recordPayload, { merge: true });
        savedCount++;

        // Auto-flag check based on nutrition status only
          try {
          const trigger = checkAutoFlagTriggers({ generalAverage: null, subjectFinalGrades: null, nutritionStatus: nutritionalStatus });
          if (trigger) {
            const lardoDocId = `${learner.id}_${schoolYear.trim()}`;
            const existing = await getDoc(doc(db, "lardoRecords", lardoDocId));
            const existsMonitoring = existing.exists() && existing.data()?.status === "monitoring";
            if (!existsMonitoring) {
              setPendingFlagCandidates((prev) => {
                if (prev.find((p) => p.docId === lardoDocId)) return prev;
                return [
                  ...prev,
                  {
                    docId: lardoDocId,
                    learner,
                    schoolYear: schoolYear.trim(),
                    trigger,
                  },
                ];
              });
            }
          }
        } catch (err) {
          console.error("Auto-flag check failed:", err);
        }
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

  // ---- Printable SF8 report data ------------------------------------------
  // School info fallbacks: use whichever config fields exist, dash otherwise.
  const sf8SchoolName = config?.schoolName || "—";
  const sf8District = config?.district || "—";
  const sf8Division = config?.division || config?.divisionOffice || "—";
  const sf8Region = config?.region || "—";
  const sf8SchoolId = config?.schoolId || "—";

  // Group rows by sex: all Male rows first, then Female rows, then any rows with
  // no sex value — matching the sex-grouped style of the SF1 printable register.
  const maleSf8Rows = gridData.filter((item) => normalizeSex(item.learner.sex) === "M");
  const femaleSf8Rows = gridData.filter((item) => normalizeSex(item.learner.sex) === "F");
  const unlabelledSf8Rows = gridData.filter((item) => normalizeSex(item.learner.sex) === "");

  // Ordered print rows with continuous numbering across the sex groups.
  const sf8PrintRows = [];
  let sf8RowNumber = 0;
  for (const group of [
    { label: "MALE", rows: maleSf8Rows },
    { label: "FEMALE", rows: femaleSf8Rows },
    { label: "SEX NOT INDICATED", rows: unlabelledSf8Rows },
  ]) {
    if (group.rows.length === 0) continue;
    sf8PrintRows.push({ groupHeader: true, label: group.label });
    for (const item of group.rows) {
      sf8RowNumber += 1;
      sf8PrintRows.push({ groupHeader: false, item, number: sf8RowNumber });
    }
  }

  // Summary counts per BMI category — reuses summaryCounts, no recomputation.
  const sf8SummaryRows = [
    { label: "Severely Wasted", count: summaryCounts.severelyWasted },
    { label: "Wasted", count: summaryCounts.wasted },
    { label: "Normal", count: summaryCounts.normal },
    { label: "Overweight", count: summaryCounts.overweight },
    { label: "Obese", count: summaryCounts.obese },
  ];

  function handlePrintReport() {
    setShowPrintArea(true);
    setTimeout(() => window.print(), 150);
  }

  // One printable SF8 data row, computed exactly the way handleSave does.
  function renderSf8Row(item, rowNumber) {
    const { learner, heightM, weightKg } = item;
    const h = parseFloat(heightM);
    const w = parseFloat(weightKg);
    const isValid = !isNaN(h) && h > 0 && !isNaN(w) && w > 0;

    const fullName = `${learner.lastName || ""}, ${learner.firstName || ""}${
      learner.middleName ? " " + learner.middleName : ""
    }`.trim();
    const lrn = learner.lrn || learner.learnerLRN || "—";
    const ageInMonths = getAgeInMonths(learner.birthDate, measurementDate);
    const bmi = computeBMI(w, h);
    const status = classifyNutritionalStatus(bmi, ageInMonths, learner.sex);
    const hfaStatus = classifyHeightForAge(h, ageInMonths, learner.sex);

    return (
      <tr key={rowNumber}>
        <td>{rowNumber}</td>
        <td className="sf8-cell-left">{lrn}</td>
        <td className="sf8-cell-left">{fullName || "—"}</td>
        <td>{learner.birthDate || "—"}</td>
        <td>{formatAgeLabel(ageInMonths)}</td>
        <td>{isValid ? String(w) : "—"}</td>
        <td>{isValid ? String(h) : "—"}</td>
        <td>{isValid ? (h * h).toFixed(2) : "—"}</td>
        <td>{bmi !== null && bmi !== undefined ? bmi.toFixed(2) : "—"}</td>
        <td>{status || "—"}</td>
        <td>{hfaStatus || "—"}</td>
        <td>{learner.remarks || "—"}</td>
      </tr>
    );
  }

  return (
    <div className="space-y-6 max-w-none w-full">
      {/* Print CSS — screen chrome hides, the printable SF8 report stays plain. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .sf8-print-area, .sf8-print-area * { visibility: visible; }
          .sf8-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            color: #000;
            background: #fff;
          }
          @page { size: A4 landscape; margin: 8mm; }
        }
        .sf8-table { border-collapse: collapse; width: 100%; }
        .sf8-table th, .sf8-table td {
          border: 1px solid #000;
          padding: 2px 3px;
          font-size: 7pt;
          text-align: center;
          line-height: 1.2;
          color: #000;
          background: #fff;
        }
        .sf8-table th { background: #e8e8e8; font-weight: bold; }
        .sf8-cell-left { text-align: left !important; }
        .sf8-table td.sf8-group-header {
          background: #e8e8e8;
          font-weight: bold;
          text-align: left;
        }
        .sf8-hdr-label, .sf8-hdr-value {
          border: 1px solid #000;
          padding: 3px 6px;
          color: #000;
          background: #fff;
        }
        .sf8-hdr-label { font-weight: bold; white-space: nowrap; }
        .sf8-hdr-value { text-align: left; }
      `}</style>
      {/* Header */}
      <PageHeader
        description="DepEd / WHO 2007 Growth Reference (BMI-for-Age) baseline & annual monitoring"
        actions={
          isLoaded && gridData.length > 0 && (
            <>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? "Saving..." : "Save Nutrition Records"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handlePrintReport}
                className="!bg-emerald-600 !text-white !border-emerald-600 hover:!bg-emerald-700"
              >
                <Printer className="w-4 h-4" />
                Print Report
              </Button>
            </>
          )
        }
      />

      {/* Filter Bar */}
      <form
        onSubmit={handleLoad}
        className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end"
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
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-colors"
          >
            <option value="">Select a section</option>
            {availableSections.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
          {availableSections.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {loading ? "Loading sections..." : "No sections found. Add learners in SF1 first."}
            </p>
          )}
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
            Period
          </label>
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-colors"
          >
            <option value="Baseline">Baseline</option>
            <option value="Endline">Endline</option>
          </select>
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
          <Button type="submit" disabled={isLoading} className="w-full justify-center">
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            {isLoading ? "Loading..." : "Load Class"}
          </Button>
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

      {/* Auto-flag confirmation banners */}
      {pendingFlagCandidates.map((c) => (
        <div key={c.docId} className="animate-fade-in bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg text-sm flex items-center gap-4">
          <AlertCircle className="w-4 h-4 shrink-0 text-yellow-700" />
          <div className="flex-1">
            <div className="font-medium">This learner's nutrition status suggests a LARDO risk flag.</div>
            <div className="text-xs mt-0.5">Flag {c.learner.lastName}, {c.learner.firstName} for monitoring?</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              onClick={async () => {
                try {
                  const nowIso = new Date().toISOString();
                  const lastName = c.learner.lastName || "";
                  const firstName = c.learner.firstName || "";
                  const learnerName = `${lastName}, ${firstName}`.trim();
                  const learnerLRN = c.learner.lrn || c.learner.learnerLRN || "";
                  const gradeLvl = c.learner.gradeLevel || gradeLevel;
                  const sectionName = c.learner.section || section;

                  const newRecordData = {
                    learnerId: c.learner.id,
                    learnerLRN,
                    learnerName,
                    gradeLevel: gradeLvl,
                    section: sectionName,
                    schoolYear: c.schoolYear,
                    riskFactors: c.trigger.riskFactors,
                    status: "monitoring",
                    interventions: [
                      {
                        date: nowIso,
                        note: c.trigger.suggestedNote,
                      },
                    ],
                    flaggedDate: nowIso,
                    flaggedByEmail: user?.email || "",
                    updatedAt: serverTimestamp(),
                  };

                  await setDoc(doc(db, "lardoRecords", c.docId), newRecordData, { merge: true });

                  setPendingFlagCandidates((prev) => prev.filter((p) => p.docId !== c.docId));
                  setStatusMessage("LARDO record created for learner.");
                } catch (err) {
                  console.error("Failed to create LARDO record:", err);
                  setErrorMessage("Failed to create LARDO record. Please try again.");
                }
              }}
            >
              Confirm
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setPendingFlagCandidates((prev) => prev.filter((p) => p.docId !== c.docId))}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}

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
                  <th className="py-3 px-4 w-36 text-center">Height-for-Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
                {gridData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-gray-500 dark:text-gray-400">
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
                    const hfaStatus = classifyHeightForAge(h, ageInMonths, learner.sex);

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
                        <td className="py-3 px-4 text-center">
                          {hfaStatus === "Severely Stunted" || hfaStatus === "Stunted" ? (
                            <span className="inline-block bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-500/20 font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {hfaStatus}
                            </span>
                          ) : hfaStatus === "Normal" ? (
                            <span className="inline-block bg-leaf/10 text-leaf-dark dark:bg-leaf/20 dark:text-leaf-light border border-leaf/20 font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {hfaStatus}
                            </span>
                          ) : hfaStatus === "Tall" ? (
                            <span className="inline-block bg-accent/10 text-accent-dark dark:bg-accent/20 dark:text-accent-light border border-accent/20 font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {hfaStatus}
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

      {/* Printable SF8 Health and Nutrition Report — only rendered while printing. */}
      {showPrintArea && gridData.length > 0 && (
        <div className="sf8-print-area">
          <div style={{ padding: "0.4in 0.5in", fontFamily: "Arial, Helvetica, sans-serif" }}>
            {/* Title */}
            <div style={{ textAlign: "center", color: "#000" }}>
              <div style={{ fontWeight: "bold", fontSize: "13pt", lineHeight: 1.3 }}>
                School Form 8 (SF8) Learner&apos;s Basic Health and Nutrition Report
              </div>
              <div style={{ fontSize: "10pt", marginTop: "2px" }}>
                (For All Grade Levels)
              </div>
            </div>

            {/* School info header */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                margin: "10px 0 8px",
                fontSize: "8.5pt",
                color: "#000",
              }}
            >
              <tbody>
                <tr>
                  <td className="sf8-hdr-label" style={{ width: "10%" }}>School Name:</td>
                  <td className="sf8-hdr-value" style={{ width: "15%" }}>{sf8SchoolName}</td>
                  <td className="sf8-hdr-label" style={{ width: "9%" }}>District:</td>
                  <td className="sf8-hdr-value" style={{ width: "16%" }}>{sf8District}</td>
                  <td className="sf8-hdr-label" style={{ width: "9%" }}>Division:</td>
                  <td className="sf8-hdr-value" style={{ width: "20%" }}>{sf8Division}</td>
                  <td className="sf8-hdr-label" style={{ width: "8%" }}>Region:</td>
                  <td className="sf8-hdr-value" style={{ width: "13%" }}>{sf8Region}</td>
                </tr>
                <tr>
                  <td className="sf8-hdr-label">School ID:</td>
                  <td className="sf8-hdr-value">{sf8SchoolId}</td>
                  <td className="sf8-hdr-label">Grade:</td>
                  <td className="sf8-hdr-value">{gradeLevel}</td>
                  <td className="sf8-hdr-label">Section:</td>
                  <td className="sf8-hdr-value">{section}</td>
                  <td className="sf8-hdr-label">School Year:</td>
                  <td className="sf8-hdr-value">{schoolYear}</td>
                </tr>
                {/* Two SF8 printouts now exist per section per school year
                    (Baseline and Endline) — this row is what tells them apart. */}
                <tr>
                  <td className="sf8-hdr-label">Period:</td>
                  <td className="sf8-hdr-value" colSpan={7}>{period}</td>
                </tr>
              </tbody>
            </table>

            {/* Nutrition table */}
            <table className="sf8-table">
              <thead>
                <tr>
                  <th style={{ width: "4%" }}>No.</th>
                  <th style={{ width: "10%" }}>LRN</th>
                  <th style={{ width: "20%" }}>
                    Learner&apos;s Name (Last, First, Name Extension, Middle)
                  </th>
                  <th style={{ width: "9%" }}>Birthdate</th>
                  <th style={{ width: "7%" }}>Age</th>
                  <th style={{ width: "7%" }}>Weight (kg)</th>
                  <th style={{ width: "7%" }}>Height (m)</th>
                  <th style={{ width: "7%" }}>Height&sup2; (m&sup2;)</th>
                  <th style={{ width: "8%" }}>BMI (kg/m&sup2;)</th>
                  <th style={{ width: "11%" }}>BMI Category</th>
                  <th style={{ width: "11%" }}>Height for Age (HFA)</th>
                  <th style={{ width: "8%" }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {sf8PrintRows.map((entry) =>
                  entry.groupHeader ? (
                    <tr key={entry.label}>
                      <td className="sf8-group-header" colSpan={12}>
                        {entry.label}
                      </td>
                    </tr>
                  ) : (
                    renderSf8Row(entry.item, entry.number)
                  )
                )}
              </tbody>
            </table>

            {/* Summary box */}
            <div style={{ marginTop: "14px", color: "#000" }}>
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "9pt",
                  textAlign: "center",
                  marginBottom: "4px",
                }}
              >
                SUMMARY — Number of Learners per BMI Nutritional Status
              </div>
              <table
                className="sf8-table"
                style={{ maxWidth: "540px", marginLeft: "auto", marginRight: "auto" }}
              >
                <thead>
                  <tr>
                    <th className="sf8-cell-left">BMI Category</th>
                    <th style={{ width: "35%" }}>Number of Learners</th>
                  </tr>
                </thead>
                <tbody>
                  {sf8SummaryRows.map((row) => (
                    <tr key={row.label}>
                      <td className="sf8-cell-left">{row.label}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="sf8-cell-left" style={{ fontWeight: "bold" }}>
                      Total
                    </td>
                    <td style={{ fontWeight: "bold" }}>{gridData.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
