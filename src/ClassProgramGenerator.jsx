// src/ClassProgramGenerator.jsx
// Class Program & Teacher's Load generator. Section grids are the only stored
// timetable; every teacher sheet is derived from them on read.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer, Wand2 } from "lucide-react";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { SCHEDULE_EDIT_ROLES } from "./pageAccess";
import { generatePeriodRows } from "./utils/scheduleModel";
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

  const editable = SCHEDULE_EDIT_ROLES.some((role) => userRoles.includes(role));

  useEffect(() => {
    async function load() {
      try {
        const base = doc(db, "schedules", schoolYear);
        const [configSnap, sectionSnap, teacherSnap, userSnap] = await Promise.all([
          getDoc(base),
          getDocs(collection(base, "sections")),
          getDocs(collection(base, "teachers")),
          getDocs(collection(db, "users")),
        ]);

        setConfig(configSnap.exists() ? configSnap.data() : null);
        const loadedSections = sectionSnap.docs.map((d) => {
          const data = d.data();
          const subjects = Array.isArray(data.subjects)
            ? data.subjects.map((entry) => ({
                ...entry,
                sessionsPerWeek: Number.isFinite(entry.sessionsPerWeek)
                  ? entry.sessionsPerWeek
                  : 0,
              }))
            : [];
          return { id: d.id, ...data, subjects };
        });
        setSections(loadedSections);
        if (loadedSections.length > 0) setActiveSectionId(loadedSections[0].id);

        const stored = teacherSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const storedHandles = {};
        stored.forEach((t) => {
          if (t.userId && Array.isArray(t.handles)) storedHandles[t.userId] = t.handles;
        });

        setTeachers(
          buildTeacherRoster({
            users: userSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
            adhocTeachers: stored.filter((t) => t.source === "adhoc"),
            storedHandles,
          }).map((t) => {
            const match = stored.find((s) => s.id === t.id);
            return match ? { ...t, ...match, handles: t.handles } : t;
          })
        );
      } catch (err) {
        console.error("Failed to load schedules:", err);
        setStatus("Could not load schedules. Please refresh and try again.");
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

  function updateSection(sectionId, updater) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? updater(s) : s))
    );
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
    updateSection(activeSectionId, (section) => ({
      ...section,
      cells: seedSectionCells({ section, rows: activeRows }),
    }));
    setStatus("Seeded from sessions per week. Adjust any cell before saving.");
  }

  async function handleSave() {
    try {
      await Promise.all(
        sections.map((section) =>
          setDoc(doc(db, "schedules", schoolYear, "sections", section.id), section)
        )
      );
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
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No schedule configuration exists for S.Y. {schoolYear} yet. An ICT
          Coordinator or Principal needs to set up the shifts before class
          programs can be built.
        </p>
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
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Class Program &amp; Teacher&rsquo;s Load
        </h1>
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

      {status && (
        <p className="no-print text-sm text-gray-600 dark:text-gray-300">{status}</p>
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
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                >
                  <Wand2 size={15} /> Seed
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-3 py-2 rounded-lg text-sm bg-primary text-white font-medium"
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
              armed={armed}
              onPaint={handlePaint}
              editable={editable}
            />

            {conflicts.length > 0 && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  {conflicts.length} issue(s) to review
                </p>
                <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                  {conflicts.slice(0, 12).map((c, i) => (
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
        <div className="schedule-print-area space-y-6">
          {teachers.map((teacher) => {
            const load = deriveTeacherLoad({ teacher, sections, shiftsById });
            if (load.rows.length === 0) return null;

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
      )}
    </div>
  );
}
