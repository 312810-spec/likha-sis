// src/utils/announcements.js
// Pure logic for school-wide announcements: the type catalog, draft validation,
// and the active/sort rules. Kept out of Announcements.jsx so the rules that
// decide what a teacher sees are unit-testable without rendering React.

export const ANNOUNCEMENT_TYPES = [
  {
    id: "general",
    label: "General Announcement",
    icon: "Megaphone",
    requiresReference: false,
    description: "School-wide notice with no external issuance behind it.",
  },
  {
    id: "depedOrder",
    label: "DepEd Order",
    icon: "FileText",
    requiresReference: true,
    referencePlaceholder: "DO 015, s. 2026",
    description: "An issuance from the Department of Education central office.",
  },
  {
    id: "depedMemorandum",
    label: "DepEd Memorandum",
    icon: "FileSignature",
    requiresReference: true,
    referencePlaceholder: "DM 042, s. 2026",
    description: "A memorandum from DepEd central, regional, or division office.",
  },
  {
    id: "ndrrmcAdvisory",
    label: "NDRRMC / Weather Advisory",
    icon: "ShieldAlert",
    requiresReference: false,
    description:
      "Transcribed from an official NDRRMC, PAGASA, or LGU bulletin. Appears at the top of the alert feed.",
  },
  {
    id: "classSuspension",
    label: "Class Suspension",
    icon: "CalendarX",
    requiresReference: false,
    description:
      "An actual suspension of classes. Appears as a danger alert and blocks out the day on the School Calendar.",
  },
];

export const ANNOUNCEMENT_TYPE_IDS = ANNOUNCEMENT_TYPES.map((t) => t.id);

export const ANNOUNCEMENT_TYPE_MAP = ANNOUNCEMENT_TYPES.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});

export const ANNOUNCEMENT_PRIORITIES = [
  { id: "normal", label: "Normal" },
  { id: "urgent", label: "Urgent" },
];

export function getAnnouncementType(typeId) {
  return ANNOUNCEMENT_TYPE_MAP[typeId] || null;
}

/**
 * Validates a compose-form draft.
 *
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validateAnnouncement(draft) {
  const errors = {};
  const d = draft || {};

  if (!String(d.title || "").trim()) {
    errors.title = "Title is required.";
  }
  if (!String(d.body || "").trim()) {
    errors.body = "Details are required.";
  }

  const type = getAnnouncementType(d.type);
  if (!type) {
    errors.type = "Choose an announcement type.";
  } else if (type.requiresReference && !String(d.referenceNo || "").trim()) {
    // A DepEd Order without its number can't be looked up or cited, which
    // defeats the point of recording it separately from a general notice.
    errors.referenceNo = `${type.label} requires a reference number (e.g. ${type.referencePlaceholder}).`;
  }

  if (!String(d.effectiveDate || "").trim()) {
    errors.effectiveDate = "Effective date is required.";
  }

  if (d.expiresAt && d.effectiveDate && d.expiresAt < d.effectiveDate) {
    errors.expiresAt = "Expiry date cannot be before the effective date.";
  }

  if (d.referenceUrl && !/^https?:\/\//i.test(String(d.referenceUrl).trim())) {
    errors.referenceUrl = "Link must start with http:// or https://";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function dateKey(value) {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return String(value || "").slice(0, 10);
}

/**
 * True when an announcement should be shown today: already in effect and not
 * past its expiry. An announcement with no expiry never goes stale on its own.
 */
export function isAnnouncementActive(announcement, today = new Date()) {
  if (!announcement) return false;
  const key = dateKey(today);
  if (announcement.effectiveDate && announcement.effectiveDate > key) return false;
  if (announcement.expiresAt && announcement.expiresAt < key) return false;
  return true;
}

/** Urgent first, then most recently effective, then newest created. */
export function sortAnnouncements(list = []) {
  return [...list].sort((a, b) => {
    const aUrgent = a?.priority === "urgent" ? 1 : 0;
    const bUrgent = b?.priority === "urgent" ? 1 : 0;
    if (aUrgent !== bUrgent) return bUrgent - aUrgent;

    const dateDiff = String(b?.effectiveDate || "").localeCompare(String(a?.effectiveDate || ""));
    if (dateDiff !== 0) return dateDiff;

    const aCreated = a?.createdAt?.seconds ?? 0;
    const bCreated = b?.createdAt?.seconds ?? 0;
    return bCreated - aCreated;
  });
}

/** Active announcements, sorted, limited to those effective within `days`. */
export function getRecentAnnouncements(list = [], today = new Date(), days = 14) {
  const cutoff = new Date(dateKey(today));
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = dateKey(cutoff);

  return sortAnnouncements(
    list.filter(
      (a) => isAnnouncementActive(a, today) && String(a.effectiveDate || "") >= cutoffKey
    )
  );
}

/** Builds the Firestore payload from a validated draft. */
export function toAnnouncementDocument(draft, author) {
  return {
    title: String(draft.title).trim(),
    body: String(draft.body).trim(),
    type: draft.type,
    referenceNo: String(draft.referenceNo || "").trim(),
    referenceUrl: String(draft.referenceUrl || "").trim(),
    priority: draft.priority === "urgent" ? "urgent" : "normal",
    effectiveDate: draft.effectiveDate,
    expiresAt: draft.expiresAt || null,
    postedByUid: author?.uid || "",
    postedByName: author?.displayName || author?.email || "Unknown",
  };
}
