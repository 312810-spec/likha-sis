// src/ConsolidatedGrades.jsx
// Consolidated Grades page for LIKHA-SIS.
// Computes each learner's Final Grade per subject and General Average across terms, per DO 15, s.2026.

import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { getSubjectWeights } from "./utils/subjectWeights";
import { transmuteGrade } from "./utils/transmutationTable";
import {
  computeComponentPS,
  computeWeightedScore,
  computeExamPS,
  computeInitialGrade,
} from "./utils/gradeComputations";
import { ArrowLeft, Award, RefreshCw, Info } from "lucide-react";

export default function ConsolidatedGrades({ goBack }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];

  // Filter state
  const [gradeLevel, setGradeLevel] = useState(gradeOptions[0] || "Grade 4");
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");

  // Grid / Data state
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [learnersData, setLearnersData] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);

  const GRADE_OPTIONS = gradeOptions;

  // Pure helper to recompute a single Term Grade from raw scores in a classRecord document
  function computeLearnerTermGrade(record, learnerId) {
    if (!record) return null;
    const subject = record.subject;
    const weights = getSubjectWeights(subject) || { ww: 0.2, pt: 0.5, ex: 0.3 };
    const wwItems = Array.isArray(record.wwItems) ? record.wwItems : [];
    const ptItems = Array.isArray(record.ptItems) ? record.ptItems : [];
    const exHPS = record.exHPS || { st1: 0, st2: 0, te: 0 };
    const learnerScores = (record.scores && record.scores[learnerId]) || {};

    // Compute WW
    const wwRaw = wwItems.map((item) => {
      const val = learnerScores.ww?.[item.id];
      return typeof val === "number" && !isNaN(val) ? val : 0;
    });
    const wwHPSArr = wwItems.map((item) => Number(item.hps) || 0);
    const wwPS = computeComponentPS(wwRaw, wwHPSArr);
    const wwWS = computeWeightedScore(wwPS, weights.ww);

    // Compute PT
    const ptRaw = ptItems.map((item) => {
      const val = learnerScores.pt?.[item.id];
      return typeof val === "number" && !isNaN(val) ? val : 0;
    });
    const ptHPSArr = ptItems.map((item) => Number(item.hps) || 0);
    const ptPS = computeComponentPS(ptRaw, ptHPSArr);
    const ptWS = computeWeightedScore(ptPS, weights.pt);

    // Compute Exam
    const st1Raw =
      typeof learnerScores.st1 === "number" && !isNaN(learnerScores.st1)
        ? learnerScores.st1
        : 0;
    const st2Raw =
      typeof learnerScores.st2 === "number" && !isNaN(learnerScores.st2)
        ? learnerScores.st2
        : 0;
    const teRaw =
      typeof learnerScores.te === "number" && !isNaN(learnerScores.te)
        ? learnerScores.te
        : 0;

    const st1HPS = Number(exHPS.st1) || 0;
    const st2HPS = Number(exHPS.st2) || 0;
    const teHPS = Number(exHPS.te) || 0;

    const exPS = computeExamPS(st1Raw, st1HPS, st2Raw, st2HPS, teRaw, teHPS);
    const exWS = computeWeightedScore(exPS, weights.ex);

    // Compute Initial and Transmuted Term Grade
    const initialGrade = computeInitialGrade(wwWS, ptWS, exWS);
    const termGrade = transmuteGrade(initialGrade);

    return termGrade;
  }

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
              const tg = computeLearnerTermGrade(rec, learner.id);
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
    } catch (err) {
      console.error("Error loading consolidated grades:", err);
      setErrorMessage("Failed to load consolidated grades. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {goBack && (
            <button
              onClick={goBack}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Back to Dashboard"
              type="button"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Award className="text-primary" size={26} />
              Consolidated Grades
            </h1>
            <p className="text-sm text-slate-500">
              Consolidated Final Grades and General Average per DO 15, s.2026.
            </p>
          </div>
        </div>

        {isLoaded && (
          <button
            onClick={() => setIsLoaded(false)}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
            type="button"
          >
            <RefreshCw size={16} />
            Change Setup
          </button>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Setup / Filter Card */}
      {!isLoaded ? (
        <form
          onSubmit={handleLoad}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-xl space-y-4"
        >
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Select Section Setup</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Grade Level
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Section
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Diamond"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              School Year
            </label>
            <input
              type="text"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="2026-2027"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? "Loading Records..." : "Load Consolidated Grades"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Muted Helper Legend */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            <Info size={16} className="text-slate-400 flex-shrink-0" />
            <span>
              Final Grade is the average of completed terms. A learner with fewer than 3 completed
              terms shows a partial average.
            </span>
          </div>

          {/* Consolidated Table Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {gradeLevel} - {section}
                </h2>
                <p className="text-xs text-slate-500">School Year: {schoolYear}</p>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                {learnersData.length} Learner{learnersData.length !== 1 ? "s" : ""} |{" "}
                {subjectsList.length} Subject{subjectsList.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-primary text-white sticky top-0 z-20 text-xs font-semibold uppercase tracking-wider border-b border-primary-dark">
                    <th className="px-4 py-3 sticky left-0 z-30 bg-primary min-w-[220px]">
                      Learner Name
                    </th>
                    <th className="px-3 py-3 text-center min-w-[60px]">Sex</th>
                    {subjectsList.map((subj) => (
                      <th key={subj} className="px-3 py-3 text-center min-w-[110px]">
                        {subj}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center bg-accent text-primary-dark font-bold min-w-[120px]">
                      General Average
                    </th>
                    <th className="px-4 py-3 text-center bg-primary-dark min-w-[80px]">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {learnersData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={subjectsList.length + 4}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        No learners found matching Grade Level &quot;{gradeLevel}&quot; and Section
                        &quot;{section}&quot;.
                      </td>
                    </tr>
                  ) : (
                    learnersData.map((learner, idx) => (
                      <tr
                        key={learner.id}
                        className={`hover:bg-blue-50/50 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-900 sticky left-0 z-10 bg-inherit truncate max-w-[240px]">
                          <span className="text-slate-400 font-normal mr-2">{idx + 1}.</span>
                          {learner.name}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600 font-mono">
                          {learner.sex}
                        </td>
                        {subjectsList.map((subj) => {
                          const grade = learner.subjectFinalGrades[subj];
                          return (
                            <td
                              key={subj}
                              className="px-3 py-2.5 text-center font-mono text-slate-800"
                            >
                              {grade}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-center font-mono font-bold text-primary-dark bg-amber-50/80">
                          {learner.genAvg}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-semibold text-slate-700 bg-slate-100/50">
                          {learner.rank}
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
