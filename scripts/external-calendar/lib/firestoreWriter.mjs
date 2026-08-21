// scripts/external-calendar/lib/firestoreWriter.mjs
// Firestore access for the sync scripts, and the idempotent-upsert /
// keep-last-known-good logic that both syncDepedCalendar.mjs and
// syncPagasaAdvisories.mjs build on. No frontend code imports this --
// it runs only from Node, authenticated via a service account.

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Initializes (once) and returns the Admin SDK Firestore handle.
 *
 * Credential resolution order:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON env var (the GitHub Actions secret) --
 *      the whole service-account JSON key as a string.
 *   2. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or
 *      gcloud/local ADC) -- for local runs where a developer already has the
 *      Firebase CLI or gcloud authenticated.
 */
export function getFirestoreDb() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(raw);
      } catch {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
      }
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp({ credential: applicationDefault() });
    }
  }
  return getFirestore();
}

function normalizeIdPart(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Deterministic doc ID: schoolYear + startDate + normalizedTitle (spec section 7). */
export function depedEventId({ schoolYear, startDate, title }) {
  const id = [normalizeIdPart(schoolYear), normalizeIdPart(startDate), normalizeIdPart(title)]
    .filter(Boolean)
    .join("-");
  return id.slice(0, 300) || `deped-event-${Date.now()}`;
}

/** Deterministic doc ID covering every advisory type this sync produces. */
export function pagasaAdvisoryId(advisory) {
  const parts = [
    advisory.advisoryType,
    advisory.cycloneName,
    advisory.signalNumber,
    advisory.bulletinNumber,
    advisory.regionSlug,
    advisory.headline,
    advisory.issuedAtIso,
  ]
    .map(normalizeIdPart)
    .filter(Boolean);
  const id = parts.join("-");
  return id.slice(0, 300) || `advisory-${Date.now()}`;
}

/**
 * Upserts this sync run's DepEd calendar events for one school year and
 * removes stale auto-imported events for that same school year that no
 * longer appear in the latest official source (spec section 7). Only ever
 * called with a non-empty `events` array -- the caller is responsible for
 * skipping this entirely (keeping last-known-good data) on fetch/parse
 * failure or an unexpectedly empty parse.
 */
export async function upsertDepedCalendarEvents({ db, schoolYear, events, source, syncedAt = new Date().toISOString() }) {
  const collectionRef = db.collection("depedCalendarEvents");
  const currentIds = new Set();
  const batch = db.batch();

  for (const event of events) {
    const id = depedEventId({ schoolYear, startDate: event.startDate, title: event.title });
    currentIds.add(id);
    batch.set(
      collectionRef.doc(id),
      {
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate || event.startDate,
        category: event.category || "other",
        schoolYear,
        sourceAuthority: "DepEd",
        sourceTitle: source?.sourceTitle || "",
        sourceType: source?.sourceType || "",
        sourceNumber: source?.sourceNumber || "",
        sourceYear: source?.sourceYear || "",
        sourceUrl: source?.sourceUrl || "",
        sourcePdfUrl: source?.sourcePdfUrl || "",
        syncedAt,
        updatedAt: syncedAt,
      },
      { merge: true }
    );
  }

  const existing = await collectionRef.where("schoolYear", "==", schoolYear).get();
  let removed = 0;
  for (const doc of existing.docs) {
    if (!currentIds.has(doc.id)) {
      batch.delete(doc.ref);
      removed += 1;
    }
  }

  await batch.commit();
  return { synced: events.length, removed };
}

/**
 * Upserts this sync run's current PAGASA advisories and removes any
 * previously-synced advisory that is no longer current (expired, superseded,
 * or a cyclone that dissipated -- spec section 13). `advisories` may
 * legitimately be an empty array (no active cyclone/advisory is a clean,
 * successful result) -- the caller only skips this call entirely when the
 * fetch/parse itself failed.
 *
 * `authoritativeTypes` (an iterable of `advisoryType` strings, e.g.
 * `["tropicalCyclone"]`) scopes which existing docs are eligible for stale
 * removal -- only types this run actually fetched successfully. Defaults to
 * the types present in `advisories` when omitted. This keeps one source's
 * failure (e.g. the Weather Advisory page being unreachable) from wiping a
 * different source's still-current data (e.g. an active cyclone bulletin).
 */
export async function upsertPagasaAdvisories({ db, advisories, authoritativeTypes, syncedAt = new Date().toISOString() }) {
  const collectionRef = db.collection("weatherAdvisories");
  const currentIds = new Set();
  const batch = db.batch();
  const authoritative = authoritativeTypes instanceof Set ? authoritativeTypes : new Set(authoritativeTypes || advisories.map((a) => a.advisoryType));

  for (const advisory of advisories) {
    const id = pagasaAdvisoryId(advisory);
    currentIds.add(id);
    const issuedDateKey = advisory.issuedAtIso ? advisory.issuedAtIso.slice(0, 10) : advisory.issuedAt || "";
    const validDateKey = advisory.validUntilIso ? advisory.validUntilIso.slice(0, 10) : advisory.validUntil || "";
    batch.set(
      collectionRef.doc(id),
      {
        advisoryType: advisory.advisoryType || "weatherAdvisory",
        bulletinNumber: advisory.bulletinNumber ?? null,
        cycloneName: advisory.cycloneName || "",
        cycloneCategory: advisory.cycloneCategory || "",
        signalNumber: advisory.signalNumber ?? null,
        affectedAreas: advisory.affectedAreas || [],
        headline: advisory.headline || "",
        issuedAt: issuedDateKey,
        validUntil: validDateKey,
        issuedAtIso: advisory.issuedAtIso || "",
        validUntilIso: advisory.validUntilIso || "",
        sourceUrl: advisory.sourceUrl || "",
        sourceAuthority: "DOST-PAGASA",
        regionalLabel: advisory.regionalLabel || "",
        isLocalMatch: Boolean(advisory.isLocalMatch),
        updatedAt: syncedAt,
      },
      { merge: true }
    );
  }

  // Stale removal is scoped to advisoryTypes this run actually has fresh data
  // for -- e.g. if the Weather Advisory fetch failed but the Tropical Cyclone
  // Bulletin fetch succeeded, a stale/expired tropicalCyclone doc is removed
  // as normal, but any existing weatherAdvisory doc is left untouched rather
  // than being wiped by a fetch failure elsewhere (spec section 13).
  const existing = await collectionRef.get();
  let removed = 0;
  for (const doc of existing.docs) {
    const docType = doc.data()?.advisoryType;
    if (authoritative.has(docType) && !currentIds.has(doc.id)) {
      batch.delete(doc.ref);
      removed += 1;
    }
  }

  await batch.commit();
  return { synced: advisories.length, removed };
}
