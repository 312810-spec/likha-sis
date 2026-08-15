// src/ConsolidatedGrades.jsx
// Consolidated Grades page for LIKHA-SIS.
// Computes each learner's Final Grade per subject and General Average across terms, per DO 15, s.2026.

import { useState } from "react";
import { collection, getDocs, getDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import { getSubjectWeights } from "./utils/subjectWeights";
import { computeLearnerTermGrade } from "./utils/gradeComputations";
import { ArrowLeft, Award, RefreshCw, Info } from "lucide-react";

import checkAutoFlagTriggers from "./utils/autoFlagTriggers";

export default function ConsolidatedGrades({ goBack, user }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];

  // Filter state
  const [gradeLevel, setGradeLevel] = useState(gradeOptions[0] || "Grade 4");
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const { sections: availableSections, loading } = useAvailableSections(gradeLevel, schoolYear);

  // Grid / Data state
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [learnersData, setLearnersData] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [pendingFlagCandidates, setPendingFlagCandidates] = useState([]);

  const GRADE_OPTIONS = gradeOptions;

  // Load consolidated grades
  async function handleLoad(e) {
    if (e) e.preventDefault();
    if (!section.trim()) {
      setErrorMessage("Please enter a section name.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      // 1. Fetch classRecords matching gradeLevel, section, schoolYear
      const recordsSnap = await getDocs(collection(db, "classRecords"));
      const allRecords = recordsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const filteredRecords = allRecords.filter(
        (r) =>
          (r.gradeLevel || "").trim().toLowerCase() === gradeLevel.trim().toLowerCase() &&
          (r.section || "").trim().toLowerCase() === section.trim().toLowerCase() &&
          (r.schoolYear || "").trim().toLowerCase() === schoolYear.trim().toLowerCase()
      );

      // Group records by subject and term: recordsBySubject[subjectKey][termKey] = recordDoc
      const recordsBySubject = {};
      filteredRecords.forEach((rec) => {
        if (!rec.subject) return;
        const subjKey = rec.subject.trim().toUpperCase();
        if (!recordsBySubject[subjKey]) {
          recordsBySubject[subjKey] = {};
        }
        const termKey = (rec.term || "").trim();
        if (termKey) {
          recordsBySubject[subjKey][termKey] = rec;
        }
      });

      const subjects = Object.keys(recordsBySubject).sort();
      setSubjectsList(subjects);

      // 2. Fetch learners matching gradeLevel, section, schoolYear
      const learnersSnap = await getDocs(collection(db, "learners"));
      const allLearners = learnersSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const filteredLearners = allLearners.filter((l) => {
        const matchGrade =
          (l.gradeLevel || "").trim().toLowerCase() === gradeLevel.trim().toLowerCase();
        const matchSection =
          (l.section || "").trim().toLowerCase() === section.trim().toLowerCase();
        const matchSY =
          !l.schoolYear ||
          (l.schoolYear || "").trim().toLowerCase() === schoolYear.trim().toLowerCase();
        return matchGrade && matchSection && matchSY;
      });

      // Sort learners alphabetically by lastName, then firstName
      filteredLearners.sort((a, b) => {
        const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
        if (last !== 0) return last;
        return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
      });

      // 3. For each learner, calculate subject final grades and general average
      const computedLearners = filteredLearners.map((learner) => {
        const subjectFinalGrades = {};

        subjects.forEach((subj) => {
          const termGrades = [];
          const termsObj = recordsBySubject[subj] || {};

          ["Term 1", "Term 2", "Term 3"].forEach((termKey) => {
            const rec = termsObj[termKey];
            if (rec) {
              const tg = computeLearnerTermGrade(rec, learner.id, getSubjectWeights);
              if (typeof tg === "number" && !isNaN(tg)) {
                termGrades.push(tg);
              }
            }
          });

          if (termGrades.length > 0) {
            const avg = termGrades.reduce((sum, g) => sum + g, 0) / termGrades.length;
            subjectFinalGrades[subj] = Math.round(avg);
          } else {
            subjectFinalGrades[subj] = "—";
          }
        });

        // Compute General Average = average of non-"—" subject Final Grades
        const validFinalGrades = subjects
          .map((s) => subjectFinalGrades[s])
          .filter((g) => typeof g === "number");

        let genAvg = "—";
        if (validFinalGrades.length > 0) {
          const avg = validFinalGrades.reduce((sum, g) => sum + g, 0) / validFinalGrades.length;
          genAvg = Math.round(avg);
        }

        return {
          id: learner.id,
          name: `${learner.lastName || ""}, ${learner.firstName || ""} ${
            learner.middleName ? learner.middleName.charAt(0) + "." : ""
          }`.trim(),
          sex: learner.sex || "—",
          subjectFinalGrades,
          genAvg,
        };
      });

      // 4. Compute Ranks (competition ranking based on genAvg descending)
      const sortedForRank = [...computedLearners].sort((a, b) => {
        const valA = typeof a.genAvg === "number" ? a.genAvg : -Infinity;
        const valB = typeof b.genAvg === "number" ? b.genAvg : -Infinity;
        return valB - valA;
      });

      const rankMap = new Map();
      let currentRank = 1;

      for (let i = 0; i < sortedForRank.length; i++) {
        if (i > 0) {
          const prevVal =
            typeof sortedForRank[i - 1].genAvg === "number"
              ? sortedForRank[i - 1].genAvg
              : -Infinity;
          const currVal =
            typeof sortedForRank[i].genAvg === "number"
              ? sortedForRank[i].genAvg
              : -Infinity;

          if (currVal === prevVal) {
            rankMap.set(sortedForRank[i].id, rankMap.get(sortedForRank[i - 1].id));
          } else {
            currentRank = i + 1;
            rankMap.set(sortedForRank[i].id, currentRank);
          }
        } else {
          rankMap.set(sortedForRank[0].id, 1);
        }
      }

      const finalLearners = computedLearners.map((l) => ({
        ...l,
        rank: rankMap.get(l.id) ?? "—",
      }));

      setLearnersData(finalLearners);
      setIsLoaded(true);

      // After computing learners, run the auto-flag checks per learner
      (async () => {
        try {
          await Promise.all(
            finalLearners.map(async (l) => {
              const numericGrades = subjects
                .map((s) => l.subjectFinalGrades[s])
                .filter((g) => typeof g === "number");

              const trigger = checkAutoFlagTriggers({ generalAverage: typeof l.genAvg === "number" ? l.genAvg : null, subjectFinalGrades: numericGrades, nutritionStatus: null });
              if (trigger) {
                const docId = `${l.id}_${schoolYear.trim()}`;
                const existing = await getDoc(doc(db, "lardoRecords", docId));
                const existsMonitoring = existing.exists() && existing.data()?.status === "monitoring";
                if (!existsMonitoring) {
                  setPendingFlagCandidates((prev) => {
                    if (prev.find((p) => p.docId === docId)) return prev;
                    return [
                      ...prev,
                      {
                        docId,
                        learner: l,
                        learnerId: l.id,
                        schoolYear: schoolYear.trim(),
                        trigger,
                      },
                    ];
                  });
                }
              }
            })
          );
        } catch (err) {
          console.error("Auto-flag checks failed:", err);
        }
      })();
    } catch (err) {
      console.error("Error loading consolidated grades:", err);
      setErrorMessage("Failed to load consolidated grades. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-slide-up">
      {/* Top Banner / Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {goBack && (
            <button
              onClick={goBack}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 active:scale-[0.98]"
              title="Back to Dashboard"
              type="button"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Award className="text-primary" size={26} />
              Consolidated Grades
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Consolidated Final Grades and General Average per DO 15, s.2026.
            </p>
          </div>
        </div>

        {isLoaded && (
          <button
            onClick={() => setIsLoaded(false)}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 active:scale-[0.98] flex items-center gap-2"
            type="button"
          >
            <RefreshCw size={16} />
            Change Setup
          </button>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-fade-in">
          {errorMessage}
        </div>
      )}

      {/* Auto-flag confirmation banners */}
      {pendingFlagCandidates.map((c) => (
        <div key={c.docId} className="animate-fade-in bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg text-sm flex items-center gap-4">
          <Info className="w-4 h-4 shrink-0 text-yellow-700" />
          <div className="flex-1">
            <div className="font-medium">This learner's grades suggest a LARDO risk flag.</div>
            <div className="text-xs mt-0.5">Flag {c.learner.name} for monitoring?</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const nowIso = new Date().toISOString();
                  const newRecordData = {
                    learnerId: c.learnerId,
                    learnerLRN: "",
                    learnerName: c.learner.name,
                    gradeLevel: gradeLevel,
                    section: section,
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
                } catch (err) {
                  console.error("Failed to create LARDO record:", err);
                  setErrorMessage("Failed to create LARDO record. Please try again.");
                }
              }}
              className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg text-sm font-medium"
            >
              Confirm
            </button>
            <button
              onClick={() => setPendingFlagCandidates((prev) => prev.filter((p) => p.docId !== c.docId))}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}

      {/* Setup / Filter Card */}
      {!isLoaded ? (
        <form
          onSubmit={handleLoad}
          className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-xl space-y-4"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Select Section Setup</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Grade Level
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Section
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              School Year
            </label>
            <input
              type="text"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="2026-2027"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg shadow-sm transition-colors duration-150 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Loading Records...
              </>
            ) : (
              "Load Consolidated Grades"
            )}
          </button>

          {isLoading && (
            <div className="space-y-3 pt-2">
              <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            </div>
          )}
        </form>
      ) : (
        <div className="space-y-4">
          {/* Muted Helper Legend */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-600 dark:text-gray-300">
            <Info size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <span>
              Final Grade is the average of completed terms. A learner with fewer than 3 completed
              terms shows a partial average.
            </span>
          </div>

          {/* Consolidated Table Container */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {gradeLevel} - {section}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">School Year: {schoolYear}</p>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {learnersData.length} Learner{learnersData.length !== 1 ? "s" : ""} |{" "}
                {subjectsList.length} Subject{subjectsList.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-primary/5 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 sticky top-0 z-20 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3 sticky left-0 z-30 bg-gray-50 dark:bg-gray-800 min-w-[220px]">
                      Learner Name
                    </th>
                    <th className="px-3 py-3 text-center min-w-[60px]">Sex</th>
                    {subjectsList.map((subj) => (
                      <th key={subj} className="px-3 py-3 text-center min-w-[110px]">
                        {subj}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center bg-accent/15 text-accent-dark dark:bg-accent/25 dark:text-accent-light font-bold min-w-[120px]">
                      General Average
                    </th>
                    <th className="px-4 py-3 text-center min-w-[80px]">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm text-gray-800 dark:text-gray-200">
                  {learnersData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={subjectsList.length + 4}
                        className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                      >
                        No learners found matching Grade Level &quot;{gradeLevel}&quot; and Section
                        &quot;{section}&quot;.
                      </td>
                    </tr>
                  ) : (
                    learnersData.map((learner, idx) => (
                      <tr
                        key={learner.id}
                        className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150 bg-white dark:bg-gray-900"
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-inherit truncate max-w-[240px]">
                          <span className="text-gray-400 dark:text-gray-500 font-normal mr-2">{idx + 1}.</span>
                          {learner.name}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400 font-mono">
                          {learner.sex}
                        </td>
                        {subjectsList.map((subj) => {
                          const grade = learner.subjectFinalGrades[subj];
                          return (
                            <td
                              key={subj}
                              className="px-3 py-2.5 text-center font-mono text-gray-800 dark:text-gray-200"
                            >
                              {grade}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-center font-mono font-bold text-accent-dark dark:text-accent-light bg-accent/10 dark:bg-accent/20">
                          {learner.genAvg}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-semibold">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary-dark dark:bg-primary/20 dark:text-primary-light">
                            {learner.rank}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
