// src/ClassProgramGenerator.jsx
// Class Program & Teacher's Load generator. Section grids are the only stored
// timetable; every teacher sheet is derived from them on read.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer, Wand2 } from "lucide-react";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { SCHEDULE_EDIT_ROLES } from "./pageAccess";
import { generatePeriodRows, validateShift } from "./utils/scheduleModel";
import { findConflicts } from "./utils/scheduleConflicts";
import { deriveTeacherLoad } from "./utils/teacherLoadDerivation";
import { buildTeacherRoster } from "./utils/schedulePalette";
import { seedSectionCells } from "./utils/scheduleSeeding";
import SubjectPalette from "./components/schedule/SubjectPalette";
import ScheduleGrid from "./components/schedule/ScheduleGrid";
import ClassProgramSheet from "./components/schedule/ClassProgramSheet";
import TeacherLoadSheet from "./components/schedule/TeacherLoadSheet";

const TABS = ["Builder", "Class Program", "Teacher's Load"];

export default function ClassProgramGenerator({ goBack, userRoles = [] }) {
  const [schoolYear] = useState("2026-2027");
  const [config, setConfig] = useState(null);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [activeTab, setActiveTab] = useState("Builder");
  const [activeSectionId, setActiveSectionId] = useState("");
  const [armed, setArmed] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dirtySectionIds, setDirtySectionIds] = useState(new Set());
  // Data-integrity warnings (sessionsPerWeek repairs, degraded roster sources)
  // live in their own channel so an ordinary action like Seed or Save -- which
  // writes to `status` -- can never silently erase them.
  const [dataWarnings, setDataWarnings] = useState([]);

  const editable = SCHEDULE_EDIT_ROLES.some((role) => userRoles.includes(role));

  useEffect(() => {
    async function load() {
      try {
        const base = doc(db, "schedules", schoolYear);
        let usersListDegraded = false;
        const [configSnap, sectionSnap, teacherSnap, userSnap] = await Promise.all([
          getDoc(base),
          getDocs(collection(base, "sections")),
          getDocs(collection(base, "teachers")),
          getDocs(collection(db, "users")).catch((err) => {
            // adviser/masterTeacher cannot LIST users (firestore.rules:142-144), and
            // an ictCoordinator/principal can hit a transient network error too; they
            // read schedules only, so fall back to the stored teacher docs for names
            // (see buildTeacherRoster's storedTeachers source).
            console.warn("users list unavailable for this role:", err);
            usersListDegraded = true;
            return { docs: [] };
          }),
        ]);

        setConfig(configSnap.exists() ? configSnap.data() : null);

        const sessionsPerWeekWarnings = [];
        const loadedSections = sectionSnap.docs.map((d) => {
          const data = d.data();
          const subjects = Array.isArray(data.subjects)
            ? data.subjects.map((entry) => {
                const raw = entry.sessionsPerWeek;
                const wasAlreadyValid =
                  typeof raw === "number" && Number.isFinite(raw) && raw >= 0;
                const coerced = Number(raw);
                const repairable = Number.isFinite(coerced) && coerced >= 0;
                const finalValue = repairable ? coerced : 0;

                if (!wasAlreadyValid) {
                  sessionsPerWeekWarnings.push(
                    `${entry.subject} in ${data.gradeLevel} - ${data.name}: sessionsPerWeek ` +
                      `${JSON.stringify(raw)} ${
                        repairable
                          ? `was repaired to ${finalValue}`
                          : "could not be repaired and was set to 0"
                      }.`
                  );
                }

                return { ...entry, sessionsPerWeek: finalValue };
              })
            : [];
          return { id: d.id, ...data, subjects };
        });
        setSections(loadedSections);
        if (loadedSections.length > 0) setActiveSectionId(loadedSections[0].id);

        const warnings = [...sessionsPerWeekWarnings];
        if (usersListDegraded) {
          warnings.push(
            "Teacher accounts could not be loaded; names are shown from the schedule's own teacher records."
          );
        }
        if (warnings.length > 0) setDataWarnings(warnings);

        const stored = teacherSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const storedHandles = {};
        stored.forEach((t) => {
          // Convention: schedules/{sy}/teachers/{id} doc id === the user id.
          // (adviserId, elsewhere, is a roster id -- not a user id.) A hand-created
          // doc may omit the redundant userId field, so key on the doc id first.
          const key = t.id || t.userId;
          if (key && Array.isArray(t.handles)) storedHandles[key] = t.handles;
        });

        setTeachers(
          buildTeacherRoster({
            users: userSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
            adhocTeachers: stored.filter((t) => t.source === "adhoc"),
            storedHandles,
            storedTeachers: stored.filter((t) => t.source !== "adhoc"),
          }).map((t) => {
            // Join on doc id, per the teacher-doc-id === user-id convention above.
            const match = stored.find((s) => s.id === t.id);
            return match ? { ...t, ...match, handles: t.handles } : t;
          })
        );
      } catch (err) {
        console.error("Failed to load schedules:", err);
        setStatus("Could not load schedules. Please refresh and try again.");
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [schoolYear]);

  const shiftsById = useMemo(() => {
    const map = {};
    ((config && config.shifts) || []).forEach((shift) => {
      map[shift.id] = shift;
    });
    return map;
  }, [config]);

  const teachersById = useMemo(() => {
    const map = {};
    teachers.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [teachers]);

  const activeSection = sections.find((s) => s.id === activeSectionId) || null;

  const activeRows = useMemo(() => {
    if (!activeSection || !shiftsById[activeSection.shiftId]) return [];
    return generatePeriodRows(shiftsById[activeSection.shiftId]);
  }, [activeSection, shiftsById]);

  const conflicts = useMemo(
    () => findConflicts({ sections, teachersById }),
    [sections, teachersById]
  );

  const sectionConflicts = conflicts.filter(
    (c) => !c.sectionId || c.sectionId === activeSectionId
  );

  // The per-section emission (one conflict per involved section) is correct
  // for the grid -- ScheduleGrid needs it to scope red cells -- but it makes
  // every double-booking appear twice in the summary panel below. Dedupe by
  // message for the panel only; the grid keeps consuming `conflicts` as-is.
  const dedupedConflicts = useMemo(() => {
    const seen = new Set();
    const result = [];
    conflicts.forEach((c) => {
      if (seen.has(c.message)) return;
      seen.add(c.message);
      result.push(c);
    });
    return result;
  }, [conflicts]);

  // Derived once per render so the Teacher's Load tab can both draw sheets and
  // report how many teachers were silently excluded (a teacher doc id that
  // doesn't match any cell's teacherId, or a section referencing an absent
  // shiftId) instead of the packet just quietly coming up short.
  const teacherLoads = useMemo(
    () =>
      teachers.map((teacher) => ({
        teacher,
        load: deriveTeacherLoad({ teacher, sections, shiftsById }),
      })),
    [teachers, sections, shiftsById]
  );

  // A teacher with no grid rows but real counted minutes -- e.g. a full-time
  // coordinator whose only load is an ancillary designation -- still has a
  // weekly load under the DepEd loading-minutes rule, so their sheet must be
  // printed rather than dropped. Only a genuinely empty load is excluded.
  const hasPrintableLoad = (load) =>
    load.rows.length > 0 || load.totals.countedMinutesPerWeek > 0;

  const excludedTeacherCount = teacherLoads.filter(
    ({ load }) => !hasPrintableLoad(load)
  ).length;

  // A misconfigured shift (hand-seeded in the Firebase console, no validating
  // UI) must produce a visible message rather than a silently blank document.
  const shiftProblems = useMemo(() => {
    const problems = [];
    ((config && config.shifts) || []).forEach((shift) => {
      const issues = validateShift(shift);
      if (issues.length > 0) {
        problems.push(
          `Shift "${shift.id || shift.label || "unknown"}" is misconfigured: ${issues.join(" ")}`
        );
      }
    });
    return problems;
  }, [config]);

  function updateSection(sectionId, updater) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? updater(s) : s))
    );
    setDirtySectionIds((prev) => new Set(prev).add(sectionId));
  }

  function handlePaint(periodId, day, value) {
    updateSection(activeSectionId, (section) => {
      const cells = { ...(section.cells || {}) };
      const row = { ...(cells[periodId] || {}) };
      if (value) row[day] = value;
      else delete row[day];
      cells[periodId] = row;
      return { ...section, cells };
    });
  }

  function handleSeed() {
    // generatePeriodRows returns [] for any malformed shift (see shiftProblems
    // above); seeding against an empty row set would call seedSectionCells
    // with rows: [], which returns {} and wipes the section's grid on the
    // next Save. Refuse instead of quietly destroying the stored timetable.
    if (activeRows.length === 0) {
      setStatus(
        "Cannot seed: this section's shift has no valid periods. Fix the shift configuration first."
      );
      return;
    }
    updateSection(activeSectionId, (section) => ({
      ...section,
      cells: seedSectionCells({ section, rows: activeRows }),
    }));
    setStatus("Seeded from sessions per week. Adjust any cell before saving.");
  }

  async function handleSave() {
    // Full-replace setDoc on every section would let two authorized editors
    // (ictCoordinator + principal) working on different sections silently
    // destroy each other's work. Only write sections actually touched here.
    const idsToSave = sections.filter((section) => dirtySectionIds.has(section.id));
    const savedIds = idsToSave.map((section) => section.id);
    try {
      await Promise.all(
        idsToSave.map((section) =>
          setDoc(doc(db, "schedules", schoolYear, "sections", section.id), section)
        )
      );
      // Clear only the ids just written, not the whole set -- the coordinator
      // may have kept editing (a different section, or this one) during the
      // await, and that edit is still dirty and unsaved.
      setDirtySectionIds((prev) => {
        const next = new Set(prev);
        savedIds.forEach((id) => next.delete(id));
        return next;
      });
      setStatus("Saved.");
    } catch (err) {
      console.error("Failed to save schedule:", err);
      setStatus("Failed to save. Please try again.");
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading schedules…</p>;
  }

  if (!config) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={goBack} className="text-sm text-primary">
          ← Back
        </button>
        {loadFailed ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {status || "Could not load schedules. Please refresh and try again."}
          </p>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No schedule configuration exists for S.Y. {schoolYear} yet. An ICT
            Coordinator or Principal needs to set up the shifts before class
            programs can be built.
          </p>
        )}
        {/* Data-integrity warnings (e.g. the users-list degradation notice) can
            fire even when there is no config doc yet, so render them here too
            instead of dropping them with this early return. */}
        {dataWarnings.length > 0 && (
          <div className="text-sm space-y-1">
            {dataWarnings.map((warning, i) => (
              <p key={i} className="text-amber-700 dark:text-amber-400">
                {warning}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .schedule-print-area, .schedule-print-area * { visibility: visible; }
          .schedule-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            box-sizing: border-box;
            background: #ffffff !important;
            color: #111827 !important;
          }
          .class-program-doc, .teacher-load-doc { break-inside: avoid; }
          .class-program-doc + .class-program-doc,
          .teacher-load-doc + .teacher-load-doc { break-before: page; }
          @page { size: landscape; }
        }
      `}</style>

      <div className="no-print flex items-center gap-3">
        {goBack && (
          <button
            type="button"
            onClick={goBack}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h2 className="font-display text-xl font-semibold text-gray-900 dark:text-gray-100">
          Class Program &amp; Teacher&rsquo;s Load
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">S.Y. {schoolYear}</span>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              activeTab === tab
                ? "bg-primary text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
        >
          <Printer size={15} /> Print
        </button>
      </div>

      {(status || dataWarnings.length > 0 || shiftProblems.length > 0) && (
        <div className="no-print text-sm space-y-1">
          {status && <p className="text-gray-600 dark:text-gray-300">{status}</p>}
          {dataWarnings.map((warning, i) => (
            <p key={i} className="text-amber-700 dark:text-amber-400">
              {warning}
            </p>
          ))}
          {shiftProblems.map((problem, i) => (
            <p key={i} className="text-red-600 dark:text-red-400">
              {problem}
            </p>
          ))}
        </div>
      )}

      {activeTab === "Builder" && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="space-y-3">
            <select
              value={activeSectionId}
              onChange={(e) => setActiveSectionId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.gradeLevel} - {s.name}
                </option>
              ))}
            </select>

            <SubjectPalette
              subjects={(activeSection && activeSection.subjects) || []}
              teachers={teachers}
              armed={armed}
              onArm={setArmed}
              editable={editable}
            />

            {editable && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={activeRows.length === 0}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 size={15} /> Seed
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={activeRows.length === 0}
                  className="px-3 py-2 rounded-lg text-sm bg-primary text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-3">
            <ScheduleGrid
              rows={activeRows}
              cells={(activeSection && activeSection.cells) || {}}
              conflicts={sectionConflicts}
              activeSectionId={activeSectionId}
              armed={armed}
              onPaint={handlePaint}
              editable={editable}
            />

            {dedupedConflicts.length > 0 && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  {dedupedConflicts.length} issue(s) to review
                </p>
                <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                  {dedupedConflicts.slice(0, 12).map((c, i) => (
                    <li key={i}>{c.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "Class Program" && (
        <div className="schedule-print-area space-y-6">
          {sections.map((section) => (
            <ClassProgramSheet
              key={section.id}
              section={section}
              rows={
                shiftsById[section.shiftId]
                  ? generatePeriodRows(shiftsById[section.shiftId])
                  : []
              }
              teachersById={teachersById}
              schoolYear={schoolYear}
              signatories={{
                ...(config.signatories || {}),
                preparedByName:
                  (teachersById[section.adviserId] || {}).displayName || "",
              }}
            />
          ))}
        </div>
      )}

      {activeTab === "Teacher's Load" && (
        <div className="space-y-6">
          {excludedTeacherCount > 0 && (
            <p className="no-print text-sm text-amber-700 dark:text-amber-400">
              {excludedTeacherCount} teacher(s) have no assigned load and were excluded
              from this packet.
            </p>
          )}
          <div className="schedule-print-area space-y-6">
            {teacherLoads.map(({ teacher, load }) => {
              if (!hasPrintableLoad(load)) return null;

              const advisory = sections.find((s) => s.adviserId === teacher.id);

              return (
                <TeacherLoadSheet
                  key={teacher.id}
                  teacher={teacher}
                  load={load}
                  schoolYear={schoolYear}
                  advisoryLabel={
                    advisory ? `Grade ${advisory.gradeLevel} - ${advisory.name}` : ""
                  }
                  signatories={config.signatories || {}}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
