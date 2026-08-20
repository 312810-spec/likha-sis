// src/Announcements.jsx
// School-wide announcements board: DepEd Orders, DepEd Memoranda, NDRRMC /
// weather advisories, class suspensions, and general notices.
//
// Reading is open to every assigned role. Composing is restricted to the
// principal and the ICT Coordinator (canPostAnnouncements), because an
// ndrrmcAdvisory or classSuspension post surfaces as a DANGER alert in every
// user's notification bell -- that is the authority to tell the whole school
// classes are cancelled, not an ordinary posting permission.

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
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_TYPE_MAP,
  ANNOUNCEMENT_PRIORITIES,
  validateAnnouncement,
  isAnnouncementActive,
  sortAnnouncements,
  toAnnouncementDocument,
} from "./utils/announcements.js";
import { canPostAnnouncements } from "./pageAccess.js";
import { toDateKey } from "./utils/philippineHolidays.js";
import PageHeader from "./components/PageHeader.jsx";
import Button from "./components/Button.jsx";
import {
  Megaphone,
  FileText,
  FileSignature,
  ShieldAlert,
  CalendarX,
  Plus,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Archive,
} from "lucide-react";

const TYPE_ICONS = {
  Megaphone,
  FileText,
  FileSignature,
  ShieldAlert,
  CalendarX,
};

// Advisory and suspension posts read as emergencies wherever they appear, so
// they get their own visual weight here too rather than blending into notices.
const TYPE_TONES = {
  general: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  depedOrder: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  depedMemorandum: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  ndrrmcAdvisory: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  classSuspension: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white dark:focus:bg-gray-800 transition-colors";
const labelClass = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300";

function emptyDraft() {
  return {
    title: "",
    body: "",
    type: "general",
    referenceNo: "",
    referenceUrl: "",
    priority: "normal",
    effectiveDate: toDateKey(new Date()),
    expiresAt: "",
  };
}

function formatPostedDate(announcement) {
  if (!announcement?.effectiveDate) return "";
  const date = new Date(`${announcement.effectiveDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return announcement.effectiveDate;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function TypeBadge({ typeId }) {
  const type = ANNOUNCEMENT_TYPE_MAP[typeId];
  const Icon = TYPE_ICONS[type?.icon] || Megaphone;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
        TYPE_TONES[typeId] || TYPE_TONES.general
      }`}
    >
      <Icon size={12} />
      {type?.label || "Announcement"}
    </span>
  );
}

export default function Announcements({ user, userRoles }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const canPost = canPostAnnouncements(userRoles);

  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("effectiveDate", "desc"), limit(200));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadError("");
      },
      (error) => {
        console.error("Failed to load announcements:", error);
        setLoadError("Could not load announcements. Check your connection and try again.");
      }
    );
    return () => unsubscribe();
  }, []);

  const visible = useMemo(() => {
    const today = new Date();
    return sortAnnouncements(
      announcements.filter((a) => {
        if (filter !== "all" && a.type !== filter) return false;
        // Expired notices stay retrievable but out of the way -- an old class
        // suspension shouldn't sit at the top of the board all year.
        return showArchived ? true : isAnnouncementActive(a, today);
      })
    );
  }, [announcements, filter, showArchived]);

  const archivedCount = useMemo(() => {
    const today = new Date();
    return announcements.filter((a) => !isAnnouncementActive(a, today)).length;
  }, [announcements]);

  function updateDraft(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function cancelCompose() {
    setComposing(false);
    setDraft(emptyDraft());
    setErrors({});
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccessMessage("");

    const { valid, errors: validationErrors } = validateAnnouncement(draft);
    setErrors(validationErrors);
    if (!valid) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, "announcements"), {
        ...toAnnouncementDocument(draft, user),
        createdAt: serverTimestamp(),
      });
      setSuccessMessage("Announcement posted.");
      cancelCompose();
    } catch (error) {
      console.error("Failed to post announcement:", error);
      setErrors({ submit: "Failed to post. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(announcement) {
    // No window.confirm here: a browser modal blocks the whole tab, and this is
    // a two-click delete on a role-gated page whose contents are recoverable by
    // reposting. The button is styled destructively instead.
    try {
      await deleteDoc(doc(db, "announcements", announcement.id));
    } catch (error) {
      console.error("Failed to delete announcement:", error);
      setLoadError("Could not delete that announcement. Please try again.");
    }
  }

  const selectedType = ANNOUNCEMENT_TYPE_MAP[draft.type];

  return (
    <div className="max-w-none w-full space-y-6 pb-12">
      <PageHeader
        description="DepEd issuances, advisories, and school-wide notices."
        actions={
          canPost && !composing && (
            <Button onClick={() => setComposing(true)}>
              <Plus size={16} /> New Post
            </Button>
          )
        }
      />

      {successMessage && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-start gap-3 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 animate-fade-in">
          <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {loadError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300 animate-fade-in">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{loadError}</p>
        </div>
      )}

      {composing && canPost && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-card space-y-4 animate-fade-in"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Announcement</h2>

          <label className={labelClass}>
            Type
            <select
              className={inputClass}
              value={draft.type}
              onChange={(e) => updateDraft("type", e.target.value)}
            >
              {ANNOUNCEMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {selectedType && (
              <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
                {selectedType.description}
              </span>
            )}
          </label>

          {(draft.type === "ndrrmcAdvisory" || draft.type === "classSuspension") && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              <strong className="font-semibold">Post only what an official source actually issued.</strong>{" "}
              This appears as a top-priority alert for every user, labelled as a posted advisory rather
              than an automated reading. Transcribe the NDRRMC, PAGASA, or LGU bulletin — don't summarise
              from the weather card.
            </div>
          )}

          <label className={labelClass}>
            Title
            <input
              className={inputClass}
              value={draft.title}
              onChange={(e) => updateDraft("title", e.target.value)}
              placeholder="e.g. Suspension of Classes — Signal No. 2"
            />
            {errors.title && <span className="text-[11px] font-normal text-red-600 dark:text-red-400">{errors.title}</span>}
          </label>

          {selectedType?.requiresReference && (
            <label className={labelClass}>
              Reference Number
              <input
                className={inputClass}
                value={draft.referenceNo}
                onChange={(e) => updateDraft("referenceNo", e.target.value)}
                placeholder={selectedType.referencePlaceholder}
              />
              {errors.referenceNo && (
                <span className="text-[11px] font-normal text-red-600 dark:text-red-400">{errors.referenceNo}</span>
              )}
            </label>
          )}

          <label className={labelClass}>
            Details
            <textarea
              className={`${inputClass} min-h-[7rem] resize-y`}
              value={draft.body}
              onChange={(e) => updateDraft("body", e.target.value)}
              placeholder="Full text of the notice, order, or advisory."
            />
            {errors.body && <span className="text-[11px] font-normal text-red-600 dark:text-red-400">{errors.body}</span>}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={labelClass}>
              Effective Date
              <input
                type="date"
                className={inputClass}
                value={draft.effectiveDate}
                onChange={(e) => updateDraft("effectiveDate", e.target.value)}
              />
              {errors.effectiveDate && (
                <span className="text-[11px] font-normal text-red-600 dark:text-red-400">{errors.effectiveDate}</span>
              )}
            </label>

            <label className={labelClass}>
              Expires On <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
              <input
                type="date"
                className={inputClass}
                value={draft.expiresAt}
                onChange={(e) => updateDraft("expiresAt", e.target.value)}
              />
              {errors.expiresAt && (
                <span className="text-[11px] font-normal text-red-600 dark:text-red-400">{errors.expiresAt}</span>
              )}
            </label>

            <label className={labelClass}>
              Priority
              <select
                className={inputClass}
                value={draft.priority}
                onChange={(e) => updateDraft("priority", e.target.value)}
              >
                {ANNOUNCEMENT_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Source Link <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
              <input
                className={inputClass}
                value={draft.referenceUrl}
                onChange={(e) => updateDraft("referenceUrl", e.target.value)}
                placeholder="https://www.deped.gov.ph/..."
              />
              {errors.referenceUrl && (
                <span className="text-[11px] font-normal text-red-600 dark:text-red-400">{errors.referenceUrl}</span>
              )}
            </label>
          </div>

          {errors.submit && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{errors.submit}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={cancelCompose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Posting..." : "Post Announcement"}
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            filter === "all"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          All
        </button>
        {ANNOUNCEMENT_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === t.id
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}

        {archivedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <Archive size={13} />
            {showArchived ? "Hide expired" : `Show expired (${archivedCount})`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-12 text-center">
          <Megaphone size={32} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {filter === "all" ? "No announcements posted yet." : "No announcements of this type."}
          </p>
          {canPost && filter === "all" && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Use “New Post” to publish a notice to the whole school.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => {
            const expired = !isAnnouncementActive(a, new Date());
            return (
              <li
                key={a.id}
                className={`bg-white dark:bg-gray-900 border rounded-xl p-5 shadow-card ${
                  expired
                    ? "border-gray-200 dark:border-gray-800 opacity-60"
                    : a.priority === "urgent"
                      ? "border-red-200 dark:border-red-900"
                      : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge typeId={a.type} />
                      {a.priority === "urgent" && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-red-600 text-white">
                          Urgent
                        </span>
                      )}
                      {expired && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Expired
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                      {a.title}
                    </h3>
                    {a.referenceNo && (
                      <p className="text-xs font-medium text-primary dark:text-primary-light">{a.referenceNo}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {a.body}
                    </p>

                    {a.referenceUrl && (
                      <a
                        href={a.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary dark:text-primary-light hover:underline"
                      >
                        View source <ExternalLink size={12} />
                      </a>
                    )}

                    <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
                      {formatPostedDate(a)}
                      {a.expiresAt ? ` — until ${a.expiresAt}` : ""}
                      {a.postedByName ? ` · Posted by ${a.postedByName}` : ""}
                    </p>
                  </div>

                  {canPost && (
                    <Tooltip label="Delete announcement">
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        aria-label={`Delete announcement: ${a.title}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
