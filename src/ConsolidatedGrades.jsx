// src/ConsolidatedGrades.jsx
// Consolidated Grades page for LIKHA-SIS.
// Computes each learner's Final Grade per subject and General Average across terms, per DO 15, s.2026.
//
// Adviser-style class scoping (matches School Forms/Class Record): an
// adviser's advisory section auto-resolves from users/{uid}.assignments[]
// via the canonical useTeacherScope/teacherScope.js -- never a raw
// independent parse of assignments -- and can never be switched to another
// section. An adviser aggregates EVERY subject recorded for their advisory,
// even ones encoded by a different subject teacher (that's the whole point
// of this page vs. Class Record, which is scoped to one explicit
// subjectTeacher assignment). Oversight roles (principal/masterTeacher/
// smeaCoordinator) keep the manual Grade+Section+School Year picker. A bare
// subjectTeacher (no adviser role) never reaches this page at all --
// pageAccess.js excludes it.

import { useEffect, useState } from "react";
import { collection, getDocs, getDoc, doc, query, where, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import useAvailableSections from "./hooks/useAvailableSections";
import useAcademicCalendar from "./hooks/useAcademicCalendar";
import useTeacherScope from "./hooks/useTeacherScope";
import { getSubjectWeights } from "./utils/subjectWeights";
import { makeSubjectWeightsResolver } from "./utils/shsSubjectWeights";
import { computeLearnerTermGrade } from "./utils/gradeComputations";
import { getSubjectsForGradeLevel } from "./utils/subjectDirectory";
import { RefreshCw, Info, Users, BookOpenCheck, Award, CheckCircle2, ShieldAlert } from "lucide-react";
import PageHeader from "./components/PageHeader.jsx";
import Button from "./components/Button.jsx";

import checkAutoFlagTriggers from "./utils/autoFlagTriggers";

const OVERSIGHT_ROLES = ["principal", "masterTeacher", "smeaCoordinator"];

function StatTile({ icon: Icon, tint, label, value, sub }) {
  return (
    <div className="flex-1 min-w-[140px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-card flex items-center gap-2.5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="font-tabular text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</div>
        {sub && <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
      </div>
    </div>
  );
}

function ClassSummary({ learnersData, subjectsList, gradeLevel, schoolYear }) {
  const numericAverages = learnersData.map((l) => l.genAvg).filter((g) => typeof g === "number");
  const classAverage = numericAverages.length > 0 ? Math.round(numericAverages.reduce((s, g) => s + g, 0) / numericAverages.length) : null;
  const passing = learnersData.filter((l) => typeof l.genAvg === "number" && l.genAvg >= 75).length;
  const needsIntervention = learnersData.filter((l) => {
    const numericGrades = subjectsList.map((s) => l.subjectFinalGrades[s]).filter((g) => typeof g === "number");
    return !!checkAutoFlagTriggers({ generalAverage: typeof l.genAvg === "number" ? l.genAvg : null, subjectFinalGrades: numericGrades });
  }).length;

  const expectedSubjects = getSubjectsForGradeLevel(gradeLevel, { schoolYear });
  const completeness = expectedSubjects.length > 0 ? `${subjectsList.length} / ${expectedSubjects.length} available` : null;

  return (
    <div className="flex flex-wrap gap-3">
      <StatTile icon={Users} tint="bg-primary/10 text-primary dark:bg-primary/20" label="Learners" value={learnersData.length} />
      <StatTile
        icon={BookOpenCheck}
        tint="bg-leaf/10 text-leaf dark:bg-leaf/20"
        label="Subjects with Records"
        value={subjectsList.length}
        sub={completeness}
      />
      <StatTile
        icon={Award}
        tint="bg-accent/10 text-accent-dark dark:bg-accent/20"
        label="Class General Average"
        value={classAverage === null ? "—" : classAverage}
      />
      <StatTile icon={CheckCircle2} tint="bg-leaf/10 text-leaf dark:bg-leaf/20" label="Passing Learners" value={passing} />
      <StatTile
        icon={ShieldAlert}
        tint="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400"
        label="Needs Intervention"
        value={needsIntervention}
      />
    </div>
  );
}

export default function ConsolidatedGrades({ user, userRoles = [] }) {
  const { config } = useSchoolConfig();
  const gradeOptions = config?.gradeLevelsOffered || ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];

  const shsSubjectList = [
    ...(config?.shs?.subjects || []),
    ...((config?.shs?.electiveClusters || []).flatMap((cluster) => cluster.subjects || [])),
  ];
  const getSHSAwareWeights = makeSubjectWeightsResolver(shsSubjectList, getSubjectWeights);

  const isAdviser = userRoles.includes("adviser");
  const hasOversightRole = userRoles.some((r) => OVERSIGHT_ROLES.includes(r));

  const { schoolYears } = useAcademicCalendar();
  const currentSchoolYear = schoolYears?.[0] || "2026-2027";
  // Self-scoped: reads only this user's own profile/advisory lookup.
  const teacherScope = useTeacherScope(user, currentSchoolYear);

  // Manual setup state -- oversight roles only.
  const [gradeLevelChoice, setGradeLevel] = useState(gradeOptions[0] || "Grade 4");
  const gradeLevel = gradeOptions.includes(gradeLevelChoice) ? gradeLevelChoice : gradeOptions[0] || "Grade 4";
  const [section, setSection] = useState("");
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear);
  const { sections: availableSections, loading: loadingSections } = useAvailableSections(gradeLevel, schoolYear);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [learnersData, setLearnersData] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [pendingFlagCandidates, setPendingFlagCandidates] = useState([]);
  const [loadedGradeLevel, setLoadedGradeLevel] = useState("");
  const [loadedSection, setLoadedSection] = useState("");
  const [loadedSchoolYear, setLoadedSchoolYear] = useState("");

  async function loadSection(targetGradeLevel, targetSection, targetSchoolYear) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      // Narrowly scoped queries -- never a whole-school classRecords/learners
      // read, regardless of adviser vs. oversight role.
      const recordsSnap = await getDocs(
        query(
          collection(db, "classRecords"),
          where("gradeLevel", "==", targetGradeLevel),
          where("section", "==", targetSection),
          where("schoolYear", "==", targetSchoolYear)
        )
      );
      const allRecords = recordsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

      const recordsBySubject = {};
      allRecords.forEach((rec) => {
        if (!rec.subject) return;
        const subjKey = rec.subject.trim().toUpperCase();
        if (!recordsBySubject[subjKey]) recordsBySubject[subjKey] = {};
        const termKey = (rec.term || "").trim();
        if (termKey) recordsBySubject[subjKey][termKey] = rec;
      });

      const subjects = Object.keys(recordsBySubject).sort();
      setSubjectsList(subjects);

      const learnersSnap = await getDocs(
        query(collection(db, "learners"), where("gradeLevel", "==", targetGradeLevel), where("section", "==", targetSection))
      );
      const sectionLearners = learnersSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        // Legacy learner docs may omit schoolYear entirely -- treated as a
        // match rather than excluded, same leniency the page has always had.
        .filter((l) => !l.schoolYear || (l.schoolYear || "").trim().toLowerCase() === targetSchoolYear.trim().toLowerCase());

      sectionLearners.sort((a, b) => {
        const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
        if (last !== 0) return last;
        return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
      });

      const computedLearners = sectionLearners.map((learner) => {
        const subjectFinalGrades = {};
        subjects.forEach((subj) => {
          const termGrades = [];
          const termsObj = recordsBySubject[subj] || {};
          ["Term 1", "Term 2", "Term 3"].forEach((termKey) => {
            const rec = termsObj[termKey];
            if (rec) {
              const tg = computeLearnerTermGrade(rec, learner.id, getSHSAwareWeights);
              if (typeof tg === "number" && !isNaN(tg)) termGrades.push(tg);
            }
          });
          if (termGrades.length > 0) {
            const avg = termGrades.reduce((sum, g) => sum + g, 0) / termGrades.length;
            subjectFinalGrades[subj] = Math.round(avg);
          } else {
            subjectFinalGrades[subj] = "—";
          }
        });

        const validFinalGrades = subjects.map((s) => subjectFinalGrades[s]).filter((g) => typeof g === "number");
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
          lrn: learner.lrn || learner.learnerLRN || "",
          subjectFinalGrades,
          genAvg,
        };
      });

      const sortedForRank = [...computedLearners].sort((a, b) => {
        const valA = typeof a.genAvg === "number" ? a.genAvg : -Infinity;
        const valB = typeof b.genAvg === "number" ? b.genAvg : -Infinity;
        return valB - valA;
      });
      const rankMap = new Map();
      for (let i = 0; i < sortedForRank.length; i++) {
        if (i > 0) {
          const prevVal = typeof sortedForRank[i - 1].genAvg === "number" ? sortedForRank[i - 1].genAvg : -Infinity;
          const currVal = typeof sortedForRank[i].genAvg === "number" ? sortedForRank[i].genAvg : -Infinity;
          if (currVal === prevVal) {
            rankMap.set(sortedForRank[i].id, rankMap.get(sortedForRank[i - 1].id));
          } else {
            rankMap.set(sortedForRank[i].id, i + 1);
          }
        } else {
          rankMap.set(sortedForRank[0].id, 1);
        }
      }
      const finalLearners = computedLearners.map((l) => ({ ...l, rank: rankMap.get(l.id) ?? "—" }));

      setLearnersData(finalLearners);
      setLoadedGradeLevel(targetGradeLevel);
      setLoadedSection(targetSection);
      setLoadedSchoolYear(targetSchoolYear);
      setIsLoaded(true);

      (async () => {
        try {
          await Promise.all(
            finalLearners.map(async (l) => {
              const numericGrades = subjects.map((s) => l.subjectFinalGrades[s]).filter((g) => typeof g === "number");
              const trigger = checkAutoFlagTriggers({
                generalAverage: typeof l.genAvg === "number" ? l.genAvg : null,
                subjectFinalGrades: numericGrades,
                nutritionStatus: null,
              });
              if (trigger) {
                const docId = `${l.id}_${targetSchoolYear.trim()}`;
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
                        gradeLevel: targetGradeLevel,
                        section: targetSection,
                        schoolYear: targetSchoolYear,
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

  // Adviser: auto-load the advisory section, no manual setup step.
  useEffect(() => {
    if (!isAdviser || !teacherScope.adviser || teacherScope.loading) return;
    async function autoLoad() {
      await loadSection(teacherScope.adviser.gradeLevel, teacherScope.adviser.section, currentSchoolYear);
    }
    autoLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdviser, teacherScope.adviser?.gradeLevel, teacherScope.adviser?.section, teacherScope.loading, currentSchoolYear]);

  async function handleManualLoad(e) {
    if (e) e.preventDefault();
    if (!section.trim()) {
      setErrorMessage("Please enter a section name.");
      return;
    }
    await loadSection(gradeLevel, section.trim(), schoolYear.trim() || currentSchoolYear);
  }

  async function handleConfirmFlag(c) {
    try {
      const nowIso = new Date().toISOString();
      const newRecordData = {
        learnerId: c.learnerId,
        learnerLRN: c.learner.lrn || "",
        learnerName: c.learner.name,
        gradeLevel: c.gradeLevel,
        section: c.section,
        schoolYear: c.schoolYear,
        riskFactors: c.trigger.riskFactors,
        status: "monitoring",
        interventions: [{ date: nowIso, note: c.trigger.suggestedNote }],
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
  }

  if (!isAdviser && !hasOversightRole) {
    return (
      <div className="p-8 text-center bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl max-w-xl mx-auto mt-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">You don't have access to Consolidated Grades.</p>
      </div>
    );
  }

  if (isAdviser && !teacherScope.loading && !teacherScope.adviser) {
    return (
      <div className="p-8 text-center bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl max-w-xl mx-auto mt-6">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No advisory class assigned.</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Contact the ICT Coordinator to update your assignment.</p>
      </div>
    );
  }

  const showManualSetup = !isAdviser && !isLoaded;

  return (
    <div className="space-y-6 max-w-none w-full">
      <PageHeader
        description="Consolidated Final Grades and General Average per DO 15, s.2026."
        actions={
          !isAdviser &&
          isLoaded && (
            <Button variant="secondary" size="small" onClick={() => setIsLoaded(false)}>
              <RefreshCw size={16} />
              Change Setup
            </Button>
          )
        }
      />

      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-fade-in">
          {errorMessage}
        </div>
      )}

      {pendingFlagCandidates.map((c) => (
        <div key={c.docId} className="animate-fade-in bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg text-sm flex items-center gap-4">
          <Info className="w-4 h-4 shrink-0 text-yellow-700" />
          <div className="flex-1">
            <div className="font-medium">This learner's grades suggest a LARDO risk flag.</div>
            <div className="text-xs mt-0.5">Flag {c.learner.name} for monitoring?</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="small" onClick={() => handleConfirmFlag(c)}>
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

      {isAdviser && (
        <div className="flex flex-wrap items-center gap-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-card">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Advisory Class</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {teacherScope.adviser?.gradeLevel} — {teacherScope.adviser?.section}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">School Year</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{currentSchoolYear}</div>
          </div>
        </div>
      )}

      {showManualSetup ? (
        <form
          onSubmit={handleManualLoad}
          className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-card border border-gray-200 dark:border-gray-700 max-w-xl space-y-4"
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
                {gradeOptions.map((g) => (
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
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
              {availableSections.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {loadingSections ? "Loading sections..." : "No sections found. Add learners in SF1 first."}
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

          <Button type="submit" disabled={isLoading} className="w-full justify-center">
            {isLoading ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Loading Records...
              </>
            ) : (
              "Load Consolidated Grades"
            )}
          </Button>
        </form>
      ) : isLoading && !isLoaded ? (
        <div className="space-y-3">
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      ) : (
        <div className="space-y-4">
          <ClassSummary learnersData={learnersData} subjectsList={subjectsList} gradeLevel={loadedGradeLevel} schoolYear={loadedSchoolYear} />

          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-600 dark:text-gray-300">
            <Info size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <span>
              Final Grade is the average of completed terms. A learner with fewer than 3 completed
              terms shows a partial average.
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-card border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40">
              <div>
                <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {loadedGradeLevel} - {loadedSection}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">School Year: {loadedSchoolYear}</p>
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
                    <th className="px-4 py-2.5 sticky left-0 z-30 bg-gray-50 dark:bg-gray-800 min-w-[220px]">
                      Learner Name
                    </th>
                    <th className="px-3 py-2.5 text-center min-w-[60px]">Sex</th>
                    {subjectsList.map((subj) => (
                      <th key={subj} className="px-3 py-2.5 text-center min-w-[110px]">
                        {subj}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-center bg-accent/15 text-accent-dark dark:bg-accent/25 dark:text-accent-light font-bold min-w-[120px]">
                      General Average
                    </th>
                    <th className="px-4 py-2.5 text-center min-w-[80px]">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm text-gray-800 dark:text-gray-200">
                  {learnersData.length === 0 ? (
                    <tr>
                      <td colSpan={subjectsList.length + 4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                        No learners found matching Grade Level &quot;{loadedGradeLevel}&quot; and Section &quot;{loadedSection}&quot;.
                      </td>
                    </tr>
                  ) : (
                    learnersData.map((learner, idx) => (
                      <tr
                        key={learner.id}
                        className="hover:bg-primary/5 dark:hover:bg-gray-800/50 transition-colors duration-150 bg-white dark:bg-gray-900"
                      >
                        <td
                          className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-inherit break-words max-w-[240px]"
                          title={learner.name}
                        >
                          <span className="text-gray-400 dark:text-gray-500 font-normal mr-2">{idx + 1}.</span>
                          {learner.name}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400 font-mono">{learner.sex}</td>
                        {subjectsList.map((subj) => {
                          const grade = learner.subjectFinalGrades[subj];
                          const isFailing = typeof grade === "number" && grade < 75;
                          return (
                            <td
                              key={subj}
                              className={`px-3 py-2.5 text-center font-mono ${
                                isFailing ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {grade}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center font-mono font-bold text-accent-dark dark:text-accent-light bg-accent/10 dark:bg-accent/20">
                          {learner.genAvg}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold">
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
