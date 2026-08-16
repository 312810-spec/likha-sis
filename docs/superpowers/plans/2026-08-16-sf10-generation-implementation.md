# SF10 Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let advisers, principals, and ICT Coordinators generate and print a learner's SF10 (Learner's Permanent Academic Record), single-learner or whole-section batch, from data already in LIKHA-SIS.

**Architecture:** Two new pure utility modules (`subjectRows.js` extracted from `ReportCard.jsx`, and `sf10Records.js` which merges live `classRecords` grades with imported `academicRecords`) feed a new `SF10Generator.jsx` page that mirrors `ReportCard.jsx`'s single-learner pattern and `IDGenerator.jsx`'s section-batch pattern. Read-only — no new Firestore writes, no new collections.

**Tech Stack:** React + Vite, Tailwind CSS, Firebase Firestore (client SDK), Vitest, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-08-16-sf10-generation-design.md`

## Global Constraints

- 3-Term system only (Term 1/2/3) — no quarter references.
- Reuse existing DO 15/DO 017 weight-resolution logic (`getSubjectWeights`, `makeSubjectWeightsResolver`) — never reimplement grading math.
- Printable output must keep a pure white `@media print` background, no dark/brand theme leakage (print-safety mandate).
- No new Firestore collections or writes — this feature is read-only.
- `npm run lint && npm run test` must pass before every commit.
- No auto-computed promotion/retention (spec decision 4) — imported years show the imported `promotionStatus` as-is; live years leave it blank/manual.

---

### Task 1: Extract `subjectRows.js` from `ReportCard.jsx`

**Files:**
- Create: `src/utils/subjectRows.js`
- Create: `src/utils/__tests__/subjectRows.test.js`
- Modify: `src/ReportCard.jsx:58-103` (remove `LEGACY_SUBJECT_ROWS`, `isShsGradeLevel`, `getSubjectRows`; import them instead)

**Interfaces:**
- Produces: `LEGACY_SUBJECT_ROWS` (array), `isShsGradeLevel(gradeLevel: string): boolean`, `getSubjectRows(gradeLevel: string, learner: object|null, shsConfig: object|null): Array<{label: string, key: string|null, isHeader: boolean, isIndented?: boolean}>`

- [ ] **Step 1: Write the failing test**

```javascript
// src/utils/__tests__/subjectRows.test.js
import { describe, it, expect } from "vitest";
import { LEGACY_SUBJECT_ROWS, isShsGradeLevel, getSubjectRows } from "../subjectRows.js";

describe("subjectRows", () => {
  describe("isShsGradeLevel", () => {
    it("returns true only for Grade 11 and Grade 12", () => {
      expect(isShsGradeLevel("Grade 11")).toBe(true);
      expect(isShsGradeLevel("Grade 12")).toBe(true);
      expect(isShsGradeLevel("Grade 10")).toBe(false);
      expect(isShsGradeLevel("")).toBe(false);
    });
  });

  describe("getSubjectRows", () => {
    it("returns the Grade 4-10 legacy rows unchanged for non-SHS grade levels", () => {
      expect(getSubjectRows("Grade 7", null, null)).toBe(LEGACY_SUBJECT_ROWS);
      expect(getSubjectRows("Grade 10", null, null)).toBe(LEGACY_SUBJECT_ROWS);
    });

    it("returns configured SHS core subjects for Grade 11/12", () => {
      const shsConfig = {
        subjects: [{ name: "Oral Communication" }, { name: "General Mathematics" }],
        electiveClusters: [],
      };
      const rows = getSubjectRows("Grade 11", null, shsConfig);
      expect(rows).toEqual([
        { label: "Oral Communication", key: "ORAL COMMUNICATION", isHeader: false },
        { label: "General Mathematics", key: "GENERAL MATHEMATICS", isHeader: false },
      ]);
    });

    it("appends the learner's elective cluster subjects under a header row", () => {
      const shsConfig = {
        subjects: [{ name: "Oral Communication" }],
        electiveClusters: [
          { id: "stem", name: "STEM", subjects: [{ name: "Pre-Calculus" }, { name: "Biology" }] },
        ],
      };
      const learner = { cluster: "stem" };
      const rows = getSubjectRows("Grade 12", learner, shsConfig);
      expect(rows).toEqual([
        { label: "Oral Communication", key: "ORAL COMMUNICATION", isHeader: false },
        { label: "STEM", key: null, isHeader: true },
        { label: "Pre-Calculus", key: "PRE-CALCULUS", isHeader: false, isIndented: true },
        { label: "Biology", key: "BIOLOGY", isHeader: false, isIndented: true },
      ]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/subjectRows.test.js`
Expected: FAIL — `Cannot find module '../subjectRows.js'`

- [ ] **Step 3: Write the implementation**

Move the existing code out of `ReportCard.jsx` verbatim (lines 58-103 today) into the new file:

```javascript
// src/utils/subjectRows.js
// Which learning areas appear on a printable per-learner document (SF9
// Report Card, SF10 Generator) for a given grade level. Shared so the two
// documents can never drift apart on which subjects appear per grade.

// Subject row definitions for Grade 4-10 — in exact Annex G order.
// Kept exactly as-is; the Grade 4-10 print layout must stay byte-identical.
export const LEGACY_SUBJECT_ROWS = [
  { label: "Filipino", key: "FILIPINO", isHeader: false },
  { label: "English", key: "ENGLISH", isHeader: false },
  { label: "Mathematics", key: "MATHEMATICS", isHeader: false },
  { label: "Science", key: "SCIENCE", isHeader: false },
  { label: "Araling Panlipunan (AP)", key: "ARALING PANLIPUNAN", isHeader: false },
  { label: "GMRC / Values Education", key: "GMRC/ESP", isHeader: false },
  { label: "EPP / TLE", key: "EPP/TLE", isHeader: false },
  { label: "MAPEH", key: null, isHeader: true },
  { label: "Music and Arts", key: "MUSIC AND ARTS", isHeader: false, isIndented: true },
  { label: "Physical Education and Health", key: "PE AND HEALTH", isHeader: false, isIndented: true },
];

export function isShsGradeLevel(gradeLevel) {
  return gradeLevel === "Grade 11" || gradeLevel === "Grade 12";
}

// DO 017 SHS: Grade 11/12 documents list the school's 5 configured core
// subjects plus the learner's assigned elective cluster's subjects, instead
// of the fixed Annex G Grade 4-10 list. Row keys must match
// recordsBySubject's key derivation (rec.subject.trim().toUpperCase()).
export function getSubjectRows(gradeLevel, learner, shsConfig) {
  if (!isShsGradeLevel(gradeLevel)) return LEGACY_SUBJECT_ROWS;

  const coreSubjects = shsConfig?.subjects || [];
  const clusters = shsConfig?.electiveClusters || [];
  const learnerCluster = clusters.find((c) => c.id === learner?.cluster);
  const clusterSubjects = learnerCluster?.subjects || [];

  const rows = coreSubjects
    .filter((s) => s?.name)
    .map((s) => ({ label: s.name, key: s.name.trim().toUpperCase(), isHeader: false }));

  if (clusterSubjects.length > 0) {
    rows.push({ label: learnerCluster.name || "Elective Cluster", key: null, isHeader: true });
    clusterSubjects
      .filter((s) => s?.name)
      .forEach((s) =>
        rows.push({ label: s.name, key: s.name.trim().toUpperCase(), isHeader: false, isIndented: true })
      );
  }

  return rows;
}
```

Then in `src/ReportCard.jsx`, delete lines 58-103 (the block from `// Subject row definitions...` through the closing `}` of `getSubjectRows`) and add an import:

```javascript
import { getSubjectRows } from "./utils/subjectRows.js";
```

(`ReportCard.jsx` doesn't reference `LEGACY_SUBJECT_ROWS` or `isShsGradeLevel` directly outside that block, so only `getSubjectRows` needs importing — confirm with a search before deleting.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/subjectRows.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Verify ReportCard.jsx still works**

Run: `npm run lint && npx vitest run`
Expected: lint clean, all existing tests still pass (no behavior change, pure extraction).

- [ ] **Step 6: Commit**

```bash
git add src/utils/subjectRows.js src/utils/__tests__/subjectRows.test.js src/ReportCard.jsx
git commit -m "refactor: extract subjectRows.js from ReportCard.jsx for SF10 reuse"
git push origin master
```

---

### Task 2: Build `sf10Records.js` — merge live + imported academic history

**Files:**
- Create: `src/utils/sf10Records.js`
- Create: `src/utils/__tests__/sf10Records.test.js`

**Interfaces:**
- Consumes: `computeLearnerTermGrade(record, learnerId, getSubjectWeightsFn)` from `src/utils/gradeComputations.js` (existing); `getSubjectWeights(subjectName)` from `src/utils/subjectWeights.js` (existing, used directly in tests).
- Produces: `buildLearnerAcademicHistory({ learnerId, lrn }, classRecordsList, academicRecordsList, getSubjectWeightsFn): Array<{ schoolYear: string, gradeLevel: string, subjects: Record<string, number|"—">, generalAverage: number|"—", promotionStatus: string, source: "live"|"imported" }>`, sorted ascending by `schoolYear`.

**Data shapes this task must work against (already established elsewhere in the codebase, do not invent new ones):**
- A `classRecords` doc: `{ subject, term: "Term 1"|"Term 2"|"Term 3", schoolYear: "2026-2027", gradeLevel: "Grade 7", section, scores: { [learnerId]: {...} }, wwItems, ptItems, exHPS }`. Presence of `record.scores?.[learnerId]` means this learner is in this record (see `computeInitialGradeFromRecord` in `gradeComputations.js:88-91`).
- An `academicRecords` doc (from `src/importers/sf10/normalizeSF10.js`): `{ lrn, schoolYear: "2026-2027", gradeLevel: "7" (bare digits, NOT "Grade 7" — see `normalizeGrade()` in `src/importers/shared/normalization.js:120-125`), learningAreas: [{ name: string, grades: number[] }], generalAverage: string, promotionStatus: string }`.

- [ ] **Step 1: Write the failing tests**

```javascript
// src/utils/__tests__/sf10Records.test.js
import { describe, it, expect } from "vitest";
import { buildLearnerAcademicHistory } from "../sf10Records.js";
import { getSubjectWeights } from "../subjectWeights.js";

// FILIPINO weights are ww:0.2, pt:0.5, ex:0.3 (subjectWeights.js). Perfect
// scores everywhere (raw == highest possible score) always transmute to
// 100, so this fixture gives a deterministic, non-mocked expected result.
function perfectClassRecord({ learnerId, subject, term, schoolYear, gradeLevel, section = "Kindness" }) {
  return {
    subject,
    term,
    schoolYear,
    gradeLevel,
    section,
    wwItems: [{ id: "ww1", hps: 10 }],
    ptItems: [{ id: "pt1", hps: 10 }],
    exHPS: { st1: 10, st2: 10, te: 10 },
    scores: {
      [learnerId]: {
        ww: { ww1: 10 },
        pt: { pt1: 10 },
        st1: 10,
        st2: 10,
        te: 10,
      },
    },
  };
}

describe("buildLearnerAcademicHistory", () => {
  it("returns an empty array when there are no records for the learner", () => {
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      [],
      [],
      getSubjectWeights
    );
    expect(result).toEqual([]);
  });

  it("builds a live row from classRecords with a computed subject grade and general average", () => {
    const classRecords = [
      perfectClassRecord({
        learnerId: "learner-1",
        subject: "Filipino",
        term: "Term 1",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
      perfectClassRecord({
        learnerId: "learner-1",
        subject: "Filipino",
        term: "Term 2",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      classRecords,
      [],
      getSubjectWeights
    );
    expect(result).toEqual([
      {
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
        subjects: { FILIPINO: 100 },
        generalAverage: 100,
        promotionStatus: "",
        source: "live",
      },
    ]);
  });

  it("ignores classRecords for a different learner", () => {
    const classRecords = [
      perfectClassRecord({
        learnerId: "someone-else",
        subject: "Filipino",
        term: "Term 1",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      classRecords,
      [],
      getSubjectWeights
    );
    expect(result).toEqual([]);
  });

  it("builds an imported row from academicRecords and normalizes bare-digit gradeLevel to 'Grade N'", () => {
    const academicRecords = [
      {
        lrn: "123456789012",
        schoolYear: "2024-2025",
        gradeLevel: "6",
        learningAreas: [
          { name: "Filipino", grades: [88, 90] },
          { name: "English", grades: [85] },
        ],
        generalAverage: "87",
        promotionStatus: "Promoted",
      },
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      [],
      academicRecords,
      getSubjectWeights
    );
    expect(result).toEqual([
      {
        schoolYear: "2024-2025",
        gradeLevel: "Grade 6",
        subjects: { FILIPINO: 90, ENGLISH: 85 },
        generalAverage: 87,
        promotionStatus: "Promoted",
        source: "imported",
      },
    ]);
  });

  it("ignores academicRecords for a different learner's LRN", () => {
    const academicRecords = [
      {
        lrn: "999999999999",
        schoolYear: "2024-2025",
        gradeLevel: "6",
        learningAreas: [{ name: "Filipino", grades: [88] }],
        generalAverage: "88",
        promotionStatus: "Promoted",
      },
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      [],
      academicRecords,
      getSubjectWeights
    );
    expect(result).toEqual([]);
  });

  it("prefers the live classRecords row over an imported row for the same school year + grade level", () => {
    const classRecords = [
      perfectClassRecord({
        learnerId: "learner-1",
        subject: "Filipino",
        term: "Term 1",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
    ];
    const academicRecords = [
      {
        lrn: "123456789012",
        schoolYear: "2026-2027",
        gradeLevel: "7",
        learningAreas: [{ name: "Filipino", grades: [70] }],
        generalAverage: "70",
        promotionStatus: "Promoted",
      },
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      classRecords,
      academicRecords,
      getSubjectWeights
    );
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("live");
    expect(result[0].subjects.FILIPINO).toBe(100);
  });

  it("merges and sorts a live year and an imported year chronologically regardless of input order", () => {
    const classRecords = [
      perfectClassRecord({
        learnerId: "learner-1",
        subject: "Filipino",
        term: "Term 1",
        schoolYear: "2026-2027",
        gradeLevel: "Grade 7",
      }),
    ];
    const academicRecords = [
      {
        lrn: "123456789012",
        schoolYear: "2024-2025",
        gradeLevel: "6",
        learningAreas: [{ name: "Filipino", grades: [85] }],
        generalAverage: "85",
        promotionStatus: "Promoted",
      },
    ];
    const result = buildLearnerAcademicHistory(
      { learnerId: "learner-1", lrn: "123456789012" },
      classRecords,
      academicRecords,
      getSubjectWeights
    );
    expect(result.map((r) => r.schoolYear)).toEqual(["2024-2025", "2026-2027"]);
    expect(result.map((r) => r.source)).toEqual(["imported", "live"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/sf10Records.test.js`
Expected: FAIL — `Cannot find module '../sf10Records.js'`

- [ ] **Step 3: Write the implementation**

```javascript
// src/utils/sf10Records.js
// Merges a learner's live LIKHA-SIS classRecords (any school year they were
// taught inside this system) with their imported academicRecords (SF10
// importer -- pre-adoption history or transferee records) into one
// chronological academic history for the SF10 Generator. classRecords wins
// for any school year + grade level it covers; academicRecords fills in the
// rest. Pure and Firestore-free -- callers fetch the collections and pass
// arrays in.

import { computeLearnerTermGrade } from "./gradeComputations.js";

const TERMS = ["Term 1", "Term 2", "Term 3"];

// "7" -> "Grade 7". Already-formatted values ("Grade 7") pass through
// unchanged. academicRecords.gradeLevel is bare digits (see
// src/importers/shared/normalization.js normalizeGrade()); classRecords
// docs already store "Grade N", so both sides must agree on this format to
// dedupe correctly and to render consistently in the SF10 grid.
function formatGradeLevel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^grade\s/i.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `Grade ${raw}`;
  return raw;
}

function yearGradeKey(schoolYear, gradeLevel) {
  return `${String(schoolYear ?? "").trim()}|${formatGradeLevel(gradeLevel)}`;
}

function average(numbers) {
  if (numbers.length === 0) return "—";
  return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
}

// Groups classRecords docs that mention this learner by school year + grade
// level, then computes each subject's final grade the same way
// ReportCard.jsx does: average of whichever Term 1/2/3 grades exist for
// that subject, rounded. Returns a Map<key, row>.
function buildLiveRows(learnerId, classRecordsList, getSubjectWeightsFn) {
  const mine = classRecordsList.filter((record) => record?.scores?.[learnerId]);

  const byYearGrade = new Map();
  mine.forEach((record) => {
    const key = yearGradeKey(record.schoolYear, record.gradeLevel);
    if (!byYearGrade.has(key)) {
      byYearGrade.set(key, {
        schoolYear: String(record.schoolYear ?? "").trim(),
        gradeLevel: formatGradeLevel(record.gradeLevel),
        bySubject: new Map(), // SUBJECT_KEY -> { "Term 1": record, ... }
      });
    }
    const entry = byYearGrade.get(key);
    const subjectKey = String(record.subject ?? "").trim().toUpperCase();
    if (!subjectKey) return;
    if (!entry.bySubject.has(subjectKey)) entry.bySubject.set(subjectKey, {});
    const termKey = String(record.term ?? "").trim();
    if (TERMS.includes(termKey)) {
      entry.bySubject.get(subjectKey)[termKey] = record;
    }
  });

  const rows = new Map();
  byYearGrade.forEach((entry, key) => {
    const subjects = {};
    const finals = [];
    entry.bySubject.forEach((termRecords, subjectKey) => {
      const termGrades = TERMS.map((term) =>
        termRecords[term]
          ? computeLearnerTermGrade(termRecords[term], learnerId, getSubjectWeightsFn)
          : null
      ).filter((g) => typeof g === "number" && !Number.isNaN(g));
      if (termGrades.length === 0) {
        subjects[subjectKey] = "—";
        return;
      }
      const final = average(termGrades);
      subjects[subjectKey] = final;
      finals.push(final);
    });

    rows.set(key, {
      schoolYear: entry.schoolYear,
      gradeLevel: entry.gradeLevel,
      subjects,
      generalAverage: average(finals),
      promotionStatus: "",
      source: "live",
    });
  });
  return rows;
}

// Builds one row per academicRecords doc matching this learner's LRN. Each
// learningAreas entry's LAST grade is treated as that subject's grade for
// the year (SF10 exports list one or more numeric columns per subject row;
// the rightmost is the subject's final/general-average grade for that year).
function buildImportedRows(lrn, academicRecordsList) {
  const mine = academicRecordsList.filter(
    (doc) => String(doc?.lrn ?? "").trim() === String(lrn ?? "").trim() && lrn
  );

  const rows = new Map();
  mine.forEach((doc) => {
    const key = yearGradeKey(doc.schoolYear, doc.gradeLevel);
    const subjects = {};
    (Array.isArray(doc.learningAreas) ? doc.learningAreas : []).forEach((area) => {
      const name = String(area?.name ?? "").trim().toUpperCase();
      const grades = Array.isArray(area?.grades) ? area.grades : [];
      if (!name || grades.length === 0) return;
      subjects[name] = grades[grades.length - 1];
    });
    const parsedAverage = Number(doc.generalAverage);
    rows.set(key, {
      schoolYear: String(doc.schoolYear ?? "").trim(),
      gradeLevel: formatGradeLevel(doc.gradeLevel),
      subjects,
      generalAverage: Number.isFinite(parsedAverage) ? parsedAverage : "—",
      promotionStatus: String(doc.promotionStatus ?? ""),
      source: "imported",
    });
  });
  return rows;
}

/**
 * Builds one learner's full multi-year academic history by merging live
 * classRecords (wins) with imported academicRecords (fills gaps).
 * @param {{learnerId: string, lrn: string}} learner
 * @param {Array} classRecordsList - full classRecords collection (or any superset)
 * @param {Array} academicRecordsList - full academicRecords collection (or any superset)
 * @param {(subjectName: string) => {ww:number,pt:number,ex:number}|null} getSubjectWeightsFn
 * @returns {Array} rows sorted ascending by schoolYear
 */
export function buildLearnerAcademicHistory(learner, classRecordsList, academicRecordsList, getSubjectWeightsFn) {
  const { learnerId, lrn } = learner || {};
  const liveRows = buildLiveRows(learnerId, classRecordsList || [], getSubjectWeightsFn);
  const importedRows = buildImportedRows(lrn, academicRecordsList || []);

  const merged = new Map(liveRows);
  importedRows.forEach((row, key) => {
    if (!merged.has(key)) merged.set(key, row);
  });

  return Array.from(merged.values()).sort((a, b) => a.schoolYear.localeCompare(b.schoolYear));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/sf10Records.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/sf10Records.js src/utils/__tests__/sf10Records.test.js
git commit -m "feat(sf10): add buildLearnerAcademicHistory merging live + imported records"
git push origin master
```

---

### Task 3: `pageAccess.js` — add `sf10Generate` access entry

**Files:**
- Modify: `src/pageAccess.js:21` (insert new entry after `sf10Import`)
- Modify: `src/__tests__/pageAccess.test.js` (extend the existing role-matrix test)

**Interfaces:**
- Produces: `PAGE_ACCESS.sf10Generate = ["adviser", "principal", "ictCoordinator"]`

- [ ] **Step 1: Write the failing test**

Add this block inside the existing `describe("canAccessPage", ...)` in `src/__tests__/pageAccess.test.js` (after the `userManagement` assertions, matching that block's style):

```javascript
      // sf10Generate: ["adviser", "principal", "ictCoordinator"]
      expect(canAccessPage("sf10Generate", ["adviser"])).toBe(true);
      expect(canAccessPage("sf10Generate", ["principal"])).toBe(true);
      expect(canAccessPage("sf10Generate", ["ictCoordinator"])).toBe(true);
      expect(canAccessPage("sf10Generate", ["subjectTeacher"])).toBe(false);
      expect(canAccessPage("sf10Generate", ["stakeholder"])).toBe(false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/pageAccess.test.js`
Expected: FAIL — `expect(received).toBe(true)` receives `false` for `sf10Generate`/adviser (key doesn't exist yet, `canAccessPage` returns `false` for unknown page keys).

- [ ] **Step 3: Write the implementation**

In `src/pageAccess.js`, add the entry right after `sf10Import`:

```javascript
  sf10Import: ["ictCoordinator"],
  sf10Generate: ["adviser", "principal", "ictCoordinator"],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/pageAccess.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pageAccess.js src/__tests__/pageAccess.test.js
git commit -m "feat(sf10): add sf10Generate page access for adviser/principal/ictCoordinator"
git push origin master
```

---

### Task 4: Widen `academicRecords` Firestore read access

**Files:**
- Modify: `firestore.rules:83-89`

**Interfaces:** None (rules-only change, no JS interface).

- [ ] **Step 1: Make the change**

```
    // ---- academicRecords (SF10 imports + SF10 Generator) ----
    // One imported document per learner per school year + grade level.
    // Write stays ictCoordinator-only (matches sf10Import in pageAccess.js --
    // only the importer writes this collection). Read now also includes
    // adviser/principal so they can see imported history when generating
    // SF10 (matches sf10Generate in pageAccess.js).
    match /academicRecords/{recordId} {
      allow read: if hasAnyRole(["ictCoordinator", "adviser", "principal"]);
      allow write: if hasAnyRole(["ictCoordinator"]);
    }
```

This replaces the existing single `allow read, write: if hasAnyRole(["ictCoordinator"]);` line with two separate `allow read` / `allow write` rules.

- [ ] **Step 2: Verify the rules file compiles and deploy**

Run: `npx firebase-tools deploy --only firestore:rules`
Expected: `rules file firestore.rules compiled successfully` then `released rules firestore.rules to cloud.firestore`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(sf10): widen academicRecords read to adviser/principal for SF10 Generator"
git push origin master
```

---

### Task 5: `SF10Generator.jsx` — single-learner mode

**Files:**
- Create: `src/SF10Generator.jsx`

**Interfaces:**
- Consumes: `buildLearnerAcademicHistory` (Task 2), `getSubjectRows` (Task 1), `db` from `./firebase`, `useSchoolConfig` from `./hooks/useSchoolConfig`, `getSubjectWeights` from `./utils/subjectWeights.js`, `makeSubjectWeightsResolver` from `./utils/shsSubjectWeights.js`.
- Produces: default export `SF10Generator({ goBack })`, consumed by Task 7's `App.jsx` routing.

- [ ] **Step 1: Write the component (single-learner mode + print scaffold; batch mode added in Task 6)**

```javascript
// src/SF10Generator.jsx
// SF10 (Learner's Permanent Academic Record / Form 137) generator. Merges
// live LIKHA-SIS classRecords with imported academicRecords into a
// multi-year grid, printable one learner at a time or for a whole section.
//
// Layout is built from general knowledge of the DepEd SF10 format (no
// reference template was available -- see the design spec's Decision 3).
// Treat this as needing a follow-up validation pass once a real blank SF10
// form is available to compare against; unlike ReportCard.jsx's Annex G
// layout, this one is NOT verified byte-exact.

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import useSchoolConfig from "./hooks/useSchoolConfig";
import { getSubjectWeights } from "./utils/subjectWeights.js";
import { makeSubjectWeightsResolver } from "./utils/shsSubjectWeights.js";
import { buildLearnerAcademicHistory } from "./utils/sf10Records.js";
import { getSubjectRows } from "./utils/subjectRows.js";
import { ArrowLeft, Printer } from "lucide-react";

function fullName(learner) {
  if (!learner) return "";
  const middle = learner.middleName ? ` ${learner.middleName} ` : " ";
  return `${learner.firstName || ""}${middle}${learner.lastName || ""}`.trim();
}

// One learner's printable SF10 grid: identity header + one row per subject
// (union of every subject that appears across the learner's history rows,
// in the current grade level's canonical order first) with one column per
// school year, plus a general-average row and a promotion-status row.
function SF10Document({ learner, history, shsConfig }) {
  const getSHSAwareWeights = makeSubjectWeightsResolver(
    [
      ...(shsConfig?.subjects || []),
      ...((shsConfig?.electiveClusters || []).flatMap((c) => c.subjects || [])),
    ],
    getSubjectWeights
  );
  void getSHSAwareWeights; // reserved for a future per-row SHS/legacy split; history rows already carry final grades

  const canonicalRows = getSubjectRows(learner?.gradeLevel, learner, shsConfig).filter(
    (r) => !r.isHeader && r.key
  );
  const seen = new Set(canonicalRows.map((r) => r.key));
  const extraKeys = [];
  history.forEach((row) => {
    Object.keys(row.subjects).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        extraKeys.push(key);
      }
    });
  });
  const subjectKeys = [...canonicalRows.map((r) => r.key), ...extraKeys];
  const subjectLabels = new Map(canonicalRows.map((r) => [r.key, r.label]));

  return (
    <div
      className="sf10-print-area"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", background: "#ffffff", color: "#111827", padding: "24px" }}
    >
      <div style={{ textAlign: "center", marginBottom: "12px" }}>
        <div style={{ fontWeight: "bold", fontSize: "14px" }}>SCHOOL FORM 10 (SF10)</div>
        <div style={{ fontSize: "12px" }}>Learner's Permanent Academic Record</div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "12px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "2px 6px" }}><strong>Name:</strong> {fullName(learner)}</td>
            <td style={{ padding: "2px 6px" }}><strong>LRN:</strong> {learner?.lrn || "—"}</td>
          </tr>
          <tr>
            <td style={{ padding: "2px 6px" }}><strong>Sex:</strong> {learner?.sex || "—"}</td>
            <td style={{ padding: "2px 6px" }}><strong>Birth Date:</strong> {learner?.birthDate || "—"}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #000", padding: "4px", textAlign: "left" }}>Learning Area</th>
            {history.map((row) => (
              <th key={`${row.schoolYear}-${row.gradeLevel}`} style={{ border: "1px solid #000", padding: "4px" }}>
                {row.schoolYear}
                <br />
                {row.gradeLevel}
              </th>
            ))}
            {history.length === 0 && (
              <th style={{ border: "1px solid #000", padding: "4px" }}>No records</th>
            )}
          </tr>
        </thead>
        <tbody>
          {subjectKeys.map((key) => (
            <tr key={key}>
              <td style={{ border: "1px solid #000", padding: "4px" }}>{subjectLabels.get(key) || key}</td>
              {history.map((row) => (
                <td
                  key={`${row.schoolYear}-${row.gradeLevel}-${key}`}
                  style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}
                >
                  {row.subjects[key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px", fontWeight: "bold" }}>General Average</td>
            {history.map((row) => (
              <td
                key={`${row.schoolYear}-${row.gradeLevel}-avg`}
                style={{ border: "1px solid #000", padding: "4px", textAlign: "center", fontWeight: "bold" }}
              >
                {row.generalAverage}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px" }}>Remarks</td>
            {history.map((row) => (
              <td
                key={`${row.schoolYear}-${row.gradeLevel}-remarks`}
                style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}
              >
                {row.promotionStatus || "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function SF10Generator({ goBack }) {
  const { config } = useSchoolConfig();

  const [learners, setLearners] = useState([]);
  const [classRecords, setClassRecords] = useState([]);
  const [academicRecords, setAcademicRecords] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedLearnerId, setSelectedLearnerId] = useState("");

  async function handleLoad(e) {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [learnersSnap, classRecordsSnap, academicRecordsSnap] = await Promise.all([
        getDocs(collection(db, "learners")),
        getDocs(collection(db, "classRecords")),
        getDocs(collection(db, "academicRecords")),
      ]);
      setLearners(learnersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setClassRecords(classRecordsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAcademicRecords(academicRecordsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIsLoaded(true);
    } catch (err) {
      console.error("Failed to load SF10 data:", err);
      setErrorMessage("Failed to load data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    handleLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedLearners = useMemo(
    () =>
      [...learners].sort((a, b) => {
        const last = (a.lastName || "").toLowerCase().localeCompare((b.lastName || "").toLowerCase());
        if (last !== 0) return last;
        return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
      }),
    [learners]
  );

  const selectedLearner = sortedLearners.find((l) => l.id === selectedLearnerId) || null;

  const selectedHistory = useMemo(() => {
    if (!selectedLearner) return [];
    return buildLearnerAcademicHistory(
      { learnerId: selectedLearner.id, lrn: selectedLearner.lrn },
      classRecords,
      academicRecords,
      getSubjectWeights
    );
  }, [selectedLearner, classRecords, academicRecords]);

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100 space-y-6 max-w-6xl mx-auto pb-12 animate-slide-up">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .sf10-print-area, .sf10-print-area * { visibility: visible; }
          .sf10-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            box-sizing: border-box;
            background: #ffffff !important;
            color: #111827 !important;
          }
        }
      `}</style>

      <div className="no-print flex items-center gap-3">
        {goBack && (
          <button type="button" onClick={goBack} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SF10 Generator</h1>
      </div>

      {errorMessage && (
        <div className="no-print bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl p-4 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="no-print bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Learner
        </label>
        <select
          value={selectedLearnerId}
          onChange={(e) => setSelectedLearnerId(e.target.value)}
          disabled={isLoading || !isLoaded}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800"
        >
          <option value="">-- Select a learner --</option>
          {sortedLearners.map((l) => (
            <option key={l.id} value={l.id}>
              {`${l.lastName || ""}, ${l.firstName || ""} — Grade ${l.gradeLevel || ""}, Section ${l.section || ""}`}
            </option>
          ))}
        </select>

        {selectedLearner && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-light"
          >
            <Printer size={16} /> Print SF10
          </button>
        )}
      </div>

      {selectedLearner && (
        <SF10Document learner={selectedLearner} history={selectedHistory} shsConfig={config?.shs} />
      )}
      {isLoaded && !selectedLearner && sortedLearners.length === 0 && (
        <p className="no-print text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          No learners found.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: no errors. If ESLint flags `getSHSAwareWeights`/`void` as unused-var noise, remove that reserved line — it's a forward-looking no-op for Task 6, not required for single-learner mode to work, and lint cleanliness wins over speculative wiring (YAGNI).

- [ ] **Step 3: Commit**

```bash
git add src/SF10Generator.jsx
git commit -m "feat(sf10): add SF10Generator single-learner mode"
git push origin master
```

---

### Task 6: `SF10Generator.jsx` — section-batch mode

**Files:**
- Modify: `src/SF10Generator.jsx` (add batch mode, reusing `SF10Document` from Task 5)

**Interfaces:**
- Consumes: `SF10Document` (defined in Task 5, same file — no new export needed since it's internal to this file).

- [ ] **Step 1: Add batch mode state and derived section list**

In `SF10Generator()`, after the `selectedLearnerId` state declaration, add:

```javascript
  const [mode, setMode] = useState("single"); // "single" | "section"
  const [sectionFilter, setSectionFilter] = useState("");

  const sectionOptions = useMemo(() => {
    const set = new Set();
    sortedLearners.forEach((l) => {
      if (l.gradeLevel && l.section) set.add(`${l.gradeLevel} - ${l.section}`);
    });
    return Array.from(set).sort();
  }, [sortedLearners]);

  const sectionLearners = useMemo(
    () =>
      sectionFilter
        ? sortedLearners.filter((l) => `${l.gradeLevel} - ${l.section}` === sectionFilter)
        : [],
    [sortedLearners, sectionFilter]
  );
```

- [ ] **Step 2: Add the mode toggle UI**

Immediately after the `<h1>SF10 Generator</h1>` line's closing `</div>` (the header row), insert:

```jsx
      <div className="no-print inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setMode("single")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "single" ? "bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Single Learner
        </button>
        <button
          type="button"
          onClick={() => setMode("section")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "section" ? "bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Section Batch
        </button>
      </div>
```

- [ ] **Step 3: Make the learner picker conditional on `mode === "single"`, and add the section picker**

Wrap the existing "Learner" `<label>`/`<select>` block (from Task 5) in `{mode === "single" && ( ... )}`. Immediately after that conditional block (still inside the same `no-print` picker card `<div>`), add:

```jsx
        {mode === "section" && (
          <>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Grade & Section
            </label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              disabled={isLoading || !isLoaded}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800"
            >
              <option value="">-- Select grade & section --</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </>
        )}
```

- [ ] **Step 4: Update the Print button and rendered documents to branch on `mode`**

Replace the existing `{selectedLearner && ( <button ...> )}` block with:

```jsx
        {((mode === "single" && selectedLearner) || (mode === "section" && sectionLearners.length > 0)) && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-light"
          >
            <Printer size={16} />
            {mode === "single" ? "Print SF10" : `Print SF10s (${sectionLearners.length})`}
          </button>
        )}
```

Replace the existing `{selectedLearner && ( <SF10Document ... /> )}` block with:

```jsx
      {mode === "single" && selectedLearner && (
        <SF10Document learner={selectedLearner} history={selectedHistory} shsConfig={config?.shs} />
      )}

      {mode === "section" &&
        sectionLearners.map((learner) => (
          <div key={learner.id} style={{ breakAfter: "page" }}>
            <SF10Document
              learner={learner}
              history={buildLearnerAcademicHistory(
                { learnerId: learner.id, lrn: learner.lrn },
                classRecords,
                academicRecords,
                getSubjectWeights
              )}
              shsConfig={config?.shs}
            />
          </div>
        ))}

      {mode === "section" && sectionFilter && sectionLearners.length === 0 && (
        <p className="no-print text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          No learners found for {sectionFilter}.
        </p>
      )}
```

- [ ] **Step 5: Add print page-break CSS**

In the existing `<style>{`@media print { ... }`}</style>` block from Task 5, add one rule so each learner's document starts on its own printed page in batch mode:

```css
          .sf10-print-area { break-inside: avoid; }
```

(Add this line inside the existing `@media print { }` block, alongside the existing `.sf10-print-area { position: absolute; ... }` rule — as a sibling rule, not nested inside it.)

- [ ] **Step 6: Verify lint and a manual smoke check**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: builds successfully (catches any JSX/import mistakes across both modes).

- [ ] **Step 7: Commit**

```bash
git add src/SF10Generator.jsx
git commit -m "feat(sf10): add SF10Generator section-batch print mode"
git push origin master
```

---

### Task 7: Wire routing, navigation, and print-safety review

**Files:**
- Modify: `src/App.jsx` (import + routing case)
- Modify: `src/components/Sidebar.jsx` (icon map + nav entry)

**Interfaces:** None new — this task only wires existing exports from Tasks 3-6 into the app shell.

- [ ] **Step 1: Add the import and routing case to `App.jsx`**

Add near the other page imports (after `import SF10Importer from "./pages/SF10Importer";`):

```javascript
import SF10Generator from "./SF10Generator";
```

Add a new `case` in the `switch (currentPage)` block, after the existing `case "reportCard":` block (so it sits next to SF9's routing, matching where it appears in the sidebar nav):

```javascript
      case "sf10Generate":
        pageTitle = "SF10 Generator";
        pageContent = <SF10Generator goBack={() => setCurrentPage("dashboard")} />;
        break;
```

- [ ] **Step 2: Add the sidebar nav entry**

In `src/components/Sidebar.jsx`, add an icon mapping entry (in the `icons` object, near `'Report Card (SF9)': FileText,`):

```javascript
  'SF10 Generator': FileText,
```

Add a nav entry in the `nav` array, right after `{ label: 'Report Card (SF9)', page: 'reportCard' },`:

```javascript
    { label: 'SF10 Generator', page: 'sf10Generate' },
```

- [ ] **Step 3: Verify access gating end-to-end**

Run: `npx vitest run src/__tests__/pageAccess.test.js`
Expected: PASS (already covered in Task 3 — confirms `sf10Generate` routes are gated correctly; `Sidebar.jsx`'s `visibleNav` filtering already calls `canAccessPage` per existing code, no separate test needed since that filtering logic itself isn't new).

- [ ] **Step 4: Run the print-safety-audit skill**

Invoke the `print-safety-audit` skill against `src/SF10Generator.jsx`, per CLAUDE.md's mandate that new printable components get this pass before being considered done. Fix anything it flags (expected to pass cleanly since Task 5/6 already followed the established `.no-print`/`.sf10-print-area` idiom and pure-white inline styles, mirroring `ReportCard.jsx`).

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm run test && npm run build`
Expected: lint clean, all tests pass (existing + the ~13 new ones from Tasks 1-3), build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/Sidebar.jsx
git commit -m "feat(sf10): wire SF10 Generator into routing and sidebar navigation"
git push origin master
```

---

## Self-Review Notes

- **Spec coverage:** Decision 1 (merge) → Task 2. Decision 2 (no archival) → no task writes to Firestore, confirmed by Global Constraints. Decision 3 (unverified layout, flagged) → `SF10Generator.jsx`'s file-header comment in Task 5. Decision 4 (no auto promotion/retention) → `promotionStatus: ""` for live rows in Task 2's `buildLiveRows`. Decision 5 (access) → Task 3. Decision 6 (batch) → Task 6. `subjectRows.js` reuse → Task 1. `academicRecords` read gap → Task 4.
- **Type consistency check:** `buildLearnerAcademicHistory`'s first parameter is `{ learnerId, lrn }` everywhere it's called (Task 2's tests, Task 5/6's `SF10Generator.jsx` call sites) — confirmed consistent. `getSubjectRows(gradeLevel, learner, shsConfig)` parameter order matches between Task 1's extraction and Task 5's `SF10Document` usage.
- **No placeholders:** every step above contains complete, runnable code — none deferred to "handle appropriately."
