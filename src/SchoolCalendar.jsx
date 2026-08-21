// src/SchoolCalendar.jsx
// Month-grid school calendar layering four sources on each day: DepEd 3-term
// boundaries (academicCalendar.js), Philippine holidays, posted class
// suspensions, and the school's own events.
//
// All date arithmetic lives in utils/schoolCalendar.js -- this file only
// renders what buildCalendarMonth() produces.

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import Tooltip from "./components/Tooltip.jsx";
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_MAP,
  WEEKDAY_LABELS,
  buildCalendarMonth,
  getUpcomingEntries,
} from "./utils/schoolCalendar.js";
import { toDateKey, daysUntil } from "./utils/philippineHolidays.js";
import { canManageSchoolEvents } from "./pageAccess.js";
import PageHeader from "./components/PageHeader.jsx";
import Button from "./components/Button.jsx";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Tailwind can't build class names at runtime, so every tint a calendar entry
// can carry is spelled out here for the JIT compiler to see.
const ENTRY_TONES = {
  red: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors";
const labelClass = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300";

function emptyEvent() {
  const today = toDateKey(new Date());
  return { title: "", category: "activity", startDate: today, endDate: "", description: "" };
}

function relativeLabel(dateKey) {
  const days = daysUntil(dateKey);
  if (days === null) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

export default function SchoolCalendar({ user, userRoles }) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [schoolEvents, setSchoolEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [weatherAdvisories, setWeatherAdvisories] = useState([]);
  const [depedCalendarEvents, setDepedCalendarEvents] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(emptyEvent);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canManage = canManageSchoolEvents(userRoles);

  useEffect(() => {
    const q = query(collection(db, "schoolEvents"), orderBy("startDate", "desc"), limit(300));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setSchoolEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadError("");
      },
      (error) => {
        console.error("Failed to load school events:", error);
        setLoadError("Could not load school events. Check your connection and try again.");
      }
    );
    return () => unsubscribe();
  }, []);

  // Class suspensions are announcements, not events -- the calendar reads them
  // so a suspended day is blocked out without anyone re-entering it here.
  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("effectiveDate", "desc"), limit(100));
    const unsubscribe = onSnapshot(
      q,
      (snap) => setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setAnnouncements([])
    );
    return () => unsubscribe();
  }, []);

  // PAGASA tropical cyclone bulletins, synced by the pagasa-sync Cloud Run
  // service (functions/pagasa-sync) -- decoupled from how that job parses
  // bulletins; this just reads the collection it writes.
  useEffect(() => {
    const q = query(collection(db, "weatherAdvisories"), orderBy("issuedAt", "desc"), limit(20));
    const unsubscribe = onSnapshot(
      q,
      (snap) => setWeatherAdvisories(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setWeatherAdvisories([])
    );
    return () => unsubscribe();
  }, []);

  // DepEd's published official School Calendar, synced daily by the
  // syncDepedCalendar scheduled Cloud Function (functions/syncDepedCalendar.js)
  // -- supplementary/informational only, never overrides Term 1/2/3 boundaries.
  useEffect(() => {
    const q = query(collection(db, "depedCalendarEvents"), orderBy("startDate", "desc"), limit(200));
    const unsubscribe = onSnapshot(
      q,
      (snap) => setDepedCalendarEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setDepedCalendarEvents([])
    );
    return () => unsubscribe();
  }, []);

  const month = useMemo(
    () =>
      buildCalendarMonth(viewYear, viewMonth, {
        schoolEvents,
        announcements,
        weatherAdvisories,
        depedCalendarEvents,
        today,
      }),
    [viewYear, viewMonth, schoolEvents, announcements, weatherAdvisories, depedCalendarEvents, today]
  );

  const upcoming = useMemo(
    () =>
      getUpcomingEntries(
        { schoolEvents, announcements, weatherAdvisories, depedCalendarEvents, limit: 10 },
        today,
        45
      ),
    [schoolEvents, announcements, weatherAdvisories, depedCalendarEvents, today]
  );

  function shiftMonth(delta) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  function updateDraft(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!draft.title.trim()) {
      setFormError("Event title is required.");
      return;
    }
    if (!draft.startDate) {
      setFormError("Start date is required.");
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      setFormError("End date cannot be before the start date.");
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, "schoolEvents"), {
        title: draft.title.trim(),
        category: draft.category,
        startDate: draft.startDate,
        endDate: draft.endDate || draft.startDate,
        description: draft.description.trim(),
        createdByUid: user?.uid || "",
        createdByName: user?.displayName || user?.email || "Unknown",
        createdAt: serverTimestamp(),
      });
      setDraft(emptyEvent());
      setComposing(false);
    } catch (error) {
      console.error("Failed to save school event:", error);
      setFormError("Failed to save the event. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEvent(eventId) {
    try {
      await deleteDoc(doc(db, "schoolEvents", eventId));
    } catch (error) {
      console.error("Failed to delete school event:", error);
      setLoadError("Could not delete that event. Please try again.");
    }
  }

  return (
    <div className="max-w-none w-full space-y-6 pb-12">
      <PageHeader
        description="Terms, holidays, class suspensions, and school events."
        actions={
          canManage && !composing && (
            <Button onClick={() => setComposing(true)}>
              <Plus size={16} /> Add Event
            </Button>
          )
        }
      />

      {loadError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300 animate-fade-in">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{loadError}</p>
        </div>
      )}

      {composing && canManage && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card space-y-4 animate-fade-in"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New School Event</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={`${labelClass} sm:col-span-2`}>
              Title
              <input
                className={inputClass}
                value={draft.title}
                onChange={(e) => updateDraft("title", e.target.value)}
                placeholder="e.g. Term 1 Final Examinations"
              />
            </label>

            <label className={labelClass}>
              Category
              <select
                className={inputClass}
                value={draft.category}
                onChange={(e) => updateDraft("category", e.target.value)}
              >
                {EVENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Start Date
              <input
                type="date"
                className={inputClass}
                value={draft.startDate}
                onChange={(e) => updateDraft("startDate", e.target.value)}
              />
            </label>

            <label className={labelClass}>
              End Date <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
              <input
                type="date"
                className={inputClass}
                value={draft.endDate}
                onChange={(e) => updateDraft("endDate", e.target.value)}
              />
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Description <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
              <textarea
                className={`${inputClass} min-h-[4.5rem] resize-y`}
                value={draft.description}
                onChange={(e) => updateDraft("description", e.target.value)}
              />
            </label>
          </div>

          {formError && <p className="text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setComposing(false);
                setDraft(emptyEvent());
                setFormError("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Event"}
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToToday}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
            {WEEKDAY_LABELS.map((d) => (
              <div
                key={d}
                className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {month.weeks.flat().map((day) => (
              <div
                key={day.dateKey}
                className={`min-h-[5.5rem] border-b border-r border-gray-100 dark:border-gray-800 p-1.5 ${
                  day.inMonth ? "" : "bg-gray-50/60 dark:bg-gray-950/40"
                } ${day.isWeekend && day.inMonth ? "bg-gray-50/40 dark:bg-gray-800/20" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                      day.isToday
                        ? "bg-primary text-white font-bold"
                        : day.inMonth
                          ? "text-gray-700 dark:text-gray-200"
                          : "text-gray-300 dark:text-gray-600"
                    }`}
                  >
                    {day.dayOfMonth}
                  </span>
                  {day.termBoundary && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-primary dark:text-primary-light">
                      {day.termBoundary.term.label} {day.termBoundary.edge === "start" ? "starts" : "ends"}
                    </span>
                  )}
                </div>

                <div className="mt-1 space-y-0.5">
                  {day.entries.slice(0, 3).map((entry, i) => (
                    <div
                      key={`${entry.kind}-${entry.id || entry.title}-${i}`}
                      title={entry.subtitle ? `${entry.title} — ${entry.subtitle}` : entry.title}
                      className={`px-1 py-0.5 rounded text-[10px] leading-tight line-clamp-2 break-words ${
                        ENTRY_TONES[entry.tone] || ENTRY_TONES.blue
                      }`}
                    >
                      {entry.title}
                    </div>
                  ))}
                  {day.entries.length > 3 && (
                    <div className="px-1 text-[10px] text-gray-400 dark:text-gray-500">
                      +{day.entries.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-200 dark:bg-red-900" /> Suspension / Weather Advisory
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-200 dark:bg-rose-900" /> Holiday
            </span>
            {EVENT_CATEGORIES.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-sm ${(ENTRY_TONES[c.tint] || "").split(" ")[0]}`}
                />
                {c.label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card overflow-hidden">
            <h2 className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Next 45 Days
            </h2>
            {upcoming.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                Nothing scheduled.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {upcoming.map((entry, i) => (
                  <li key={`${entry.kind}-${entry.id || entry.title}-${i}`} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{entry.title}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {new Date(`${entry.dateKey}T00:00:00`).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {entry.subtitle ? ` — ${entry.subtitle}` : ""} · {relativeLabel(entry.dateKey)}
                        </p>
                      </div>
                      {canManage && entry.kind === "event" && entry.id && (
                        <Tooltip label="Delete event">
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(entry.id)}
                            className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            aria-label={`Delete event: ${entry.title}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Event Categories</h2>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
              Holidays follow Presidential Proclamation and can be moved; entries marked “subject to
              proclamation” are provisional.
            </p>
            <ul className="space-y-1.5">
              {EVENT_CATEGORIES.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      ENTRY_TONES[c.tint] || ENTRY_TONES.blue
                    }`}
                  >
                    {EVENT_CATEGORY_MAP[c.id].label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
