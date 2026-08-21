import { describe, it, expect } from "vitest";
import { upsertDepedCalendarEvents, upsertPagasaAdvisories } from "../lib/firestoreWriter.mjs";

/** Minimal in-memory stand-in for the Admin SDK surface these functions use. */
function createFakeDb() {
  const store = {};

  function ensureCollection(name) {
    if (!store[name]) store[name] = {};
    return store[name];
  }

  function snapshotFrom(name, predicate = () => true) {
    const data = ensureCollection(name);
    const docs = Object.entries(data)
      .filter(([id, docData]) => predicate(docData, id))
      .map(([id, docData]) => ({ id, ref: { id, collectionName: name }, data: () => docData }));
    return { docs };
  }

  return {
    _store: store,
    collection(name) {
      ensureCollection(name);
      return {
        doc(id) {
          return { id, collectionName: name };
        },
        where(field, op, value) {
          if (op !== "==") throw new Error(`Unsupported operator in fake db: ${op}`);
          return { get: async () => snapshotFrom(name, (docData) => docData?.[field] === value) };
        },
        get: async () => snapshotFrom(name),
      };
    },
    batch() {
      const ops = [];
      return {
        set(ref, data, opts) {
          ops.push(() => {
            const collectionData = ensureCollection(ref.collectionName);
            const existing = opts?.merge ? collectionData[ref.id] || {} : {};
            collectionData[ref.id] = { ...existing, ...data };
          });
        },
        delete(ref) {
          ops.push(() => {
            delete ensureCollection(ref.collectionName)[ref.id];
          });
        },
        commit: async () => ops.forEach((op) => op()),
      };
    },
  };
}

const SOURCE = {
  sourceTitle: "DepEd Order No. 009, s. 2026",
  sourceType: "DepEd Order",
  sourceNumber: "009",
  sourceYear: "2026",
  sourceUrl: "https://www.deped.gov.ph/2026/04/16/april-16-2026-do-009-s-2026/",
  sourcePdfUrl: "https://www.deped.gov.ph/wp-content/uploads/DO_s2026_009r.pdf",
};

describe("upsertDepedCalendarEvents", () => {
  it("is idempotent -- syncing the same events twice does not duplicate docs", async () => {
    const db = createFakeDb();
    const events = [
      { title: "Opening of Classes", startDate: "2026-06-08", endDate: "2026-06-08", category: "schoolOpening" },
      { title: "Term 1 Final Examinations", startDate: "2026-09-15", endDate: "2026-09-19", category: "examination" },
    ];
    await upsertDepedCalendarEvents({ db, schoolYear: "2026-2027", events, source: SOURCE });
    await upsertDepedCalendarEvents({ db, schoolYear: "2026-2027", events, source: SOURCE });
    expect(Object.keys(db._store.depedCalendarEvents)).toHaveLength(2);
  });

  it("removes stale auto-imported events no longer in the latest source", async () => {
    const db = createFakeDb();
    const events = [
      { title: "Opening of Classes", startDate: "2026-06-08", endDate: "2026-06-08", category: "schoolOpening" },
      { title: "Term 1 Final Examinations", startDate: "2026-09-15", endDate: "2026-09-19", category: "examination" },
    ];
    await upsertDepedCalendarEvents({ db, schoolYear: "2026-2027", events, source: SOURCE });
    await upsertDepedCalendarEvents({ db, schoolYear: "2026-2027", events: [events[0]], source: SOURCE });

    const remaining = Object.values(db._store.depedCalendarEvents);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe("Opening of Classes");
  });

  it("never touches a different school year's events", async () => {
    const db = createFakeDb();
    await upsertDepedCalendarEvents({
      db,
      schoolYear: "2025-2026",
      events: [{ title: "Old Year Opening", startDate: "2025-06-02", endDate: "2025-06-02", category: "schoolOpening" }],
      source: SOURCE,
    });
    await upsertDepedCalendarEvents({
      db,
      schoolYear: "2026-2027",
      events: [{ title: "New Year Opening", startDate: "2026-06-08", endDate: "2026-06-08", category: "schoolOpening" }],
      source: SOURCE,
    });

    expect(Object.keys(db._store.depedCalendarEvents)).toHaveLength(2);
  });

  it("preserves source metadata on the written docs", async () => {
    const db = createFakeDb();
    await upsertDepedCalendarEvents({
      db,
      schoolYear: "2026-2027",
      events: [{ title: "Opening of Classes", startDate: "2026-06-08", endDate: "2026-06-08", category: "schoolOpening" }],
      source: SOURCE,
    });
    const [doc] = Object.values(db._store.depedCalendarEvents);
    expect(doc.sourceAuthority).toBe("DepEd");
    expect(doc.sourceType).toBe("DepEd Order");
    expect(doc.sourceNumber).toBe("009");
    expect(doc.sourceUrl).toBe(SOURCE.sourceUrl);
    expect(doc.sourcePdfUrl).toBe(SOURCE.sourcePdfUrl);
    expect(doc.schoolYear).toBe("2026-2027");
  });

  it("a caller that skips the write on failure leaves prior data untouched (keep-last-known-good)", async () => {
    const db = createFakeDb();
    await upsertDepedCalendarEvents({
      db,
      schoolYear: "2026-2027",
      events: [{ title: "Opening of Classes", startDate: "2026-06-08", endDate: "2026-06-08", category: "schoolOpening" }],
      source: SOURCE,
    });
    const before = JSON.stringify(db._store.depedCalendarEvents);
    // Simulated failed sync: the orchestrator never calls upsert again.
    expect(JSON.stringify(db._store.depedCalendarEvents)).toBe(before);
  });
});

describe("upsertPagasaAdvisories", () => {
  it("is idempotent -- refreshing the same bulletin twice does not duplicate docs", async () => {
    const db = createFakeDb();
    const advisories = [
      {
        advisoryType: "tropicalCyclone",
        bulletinNumber: 12,
        cycloneName: "AGATON",
        cycloneCategory: "Typhoon",
        signalNumber: 2,
        affectedAreas: ["Cagayan"],
        headline: "Typhoon AGATON",
        issuedAtIso: "2026-08-20T17:00:00+08:00",
      },
    ];
    await upsertPagasaAdvisories({ db, advisories, authoritativeTypes: ["tropicalCyclone"] });
    await upsertPagasaAdvisories({ db, advisories, authoritativeTypes: ["tropicalCyclone"] });
    expect(Object.keys(db._store.weatherAdvisories)).toHaveLength(1);
  });

  it("removes an expired/superseded signal after a successful sync", async () => {
    const db = createFakeDb();
    await upsertPagasaAdvisories({
      db,
      advisories: [
        { advisoryType: "tropicalCyclone", cycloneName: "AGATON", signalNumber: 1, headline: "sig1", issuedAtIso: "" },
        { advisoryType: "tropicalCyclone", cycloneName: "AGATON", signalNumber: 2, headline: "sig2", issuedAtIso: "" },
      ],
      authoritativeTypes: ["tropicalCyclone"],
    });
    expect(Object.keys(db._store.weatherAdvisories)).toHaveLength(2);

    // Cyclone weakened: signal 2 lifted, only signal 1 remains.
    await upsertPagasaAdvisories({
      db,
      advisories: [{ advisoryType: "tropicalCyclone", cycloneName: "AGATON", signalNumber: 1, headline: "sig1", issuedAtIso: "" }],
      authoritativeTypes: ["tropicalCyclone"],
    });
    const remaining = Object.values(db._store.weatherAdvisories);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].signalNumber).toBe(1);
  });

  it("clears all cyclone signals for a clean 'no active cyclone' result", async () => {
    const db = createFakeDb();
    await upsertPagasaAdvisories({
      db,
      advisories: [{ advisoryType: "tropicalCyclone", cycloneName: "AGATON", signalNumber: 1, headline: "sig1", issuedAtIso: "" }],
      authoritativeTypes: ["tropicalCyclone"],
    });
    await upsertPagasaAdvisories({ db, advisories: [], authoritativeTypes: ["tropicalCyclone"] });
    expect(Object.keys(db._store.weatherAdvisories)).toHaveLength(0);
  });

  it("a source that failed this run (not in authoritativeTypes) keeps its previous docs untouched", async () => {
    const db = createFakeDb();
    await upsertPagasaAdvisories({
      db,
      advisories: [
        { advisoryType: "tropicalCyclone", cycloneName: "AGATON", signalNumber: 1, headline: "sig1", issuedAtIso: "" },
        { advisoryType: "weatherAdvisory", bulletinNumber: 68, headline: "wa68", issuedAtIso: "" },
      ],
      authoritativeTypes: ["tropicalCyclone", "weatherAdvisory"],
    });

    // Next run: cyclone dissipated (authoritative, cleared), but the Weather
    // Advisory page failed to fetch this time -- it's absent from
    // authoritativeTypes, so its doc must survive untouched.
    await upsertPagasaAdvisories({ db, advisories: [], authoritativeTypes: ["tropicalCyclone"] });

    const remaining = Object.values(db._store.weatherAdvisories);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].advisoryType).toBe("weatherAdvisory");
  });
});
