# Class Program & Teacher's Load Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single scheduling dataset that renders both the per-section Class Program and the per-teacher Teacher's Load, so the two DepEd documents cannot drift apart.

**Architecture:** Section grids are the only stored timetable. A teacher's grid is *derived* on read by scanning every section for that teacher, merging the shift row templates they touch, and filling the gaps with a deterministic duty rotation. Pure logic lives in `src/utils/`; React components stay thin and are wired into the existing `currentPage` string-state router.

**Tech Stack:** React 18 + Vite, Tailwind CSS v3, Firebase Firestore, `lucide-react`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-17-class-program-teacher-load-design.md`

## Global Constraints

- **Routing:** single-page `currentPage` string state in `App.jsx`. Do NOT use React Router.
- **Terms:** 3-Term system (`Term 1`, `Term 2`, `Term 3`). Legacy Q1–Q4 references are obsolete.
- **Print safety:** printable components MUST hold `background: #ffffff !important` under `@media print` with no dark/brand theme leakage.
- **Data-Safety Loop:** any new Firestore collection gets a matching `firestore.rules` block before the change is done.
- **Test command:** `npm run test` (vitest run). Single file: `npx vitest run src/utils/__tests__/<file>`.
- **Lint command:** `npm run lint`.
- **Test style:** explicit `import { describe, it, expect } from "vitest";` — globals are NOT enabled.
- **Test location:** `src/utils/__tests__/<module>.test.js`, importing `../<module>`.
- **Weekday keys:** always `"mon" | "tue" | "wed" | "thu" | "fri"`, in that order.
- **Time strings:** 12-hour with no meridiem, matching the DepEd source documents — `"6:10"`, `"12:20"`, `"1:20"`.

---

### Task 1: Schedule model — period row generation

**Files:**
- Create: `src/utils/scheduleModel.js`
- Test: `src/utils/__tests__/scheduleModel.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DAYS: string[]` — `["mon","tue","wed","thu","fri"]`
  - `parseTime(hhmm: string) => number` — minutes since midnight, 12-hour input resolved to the school day (6:00 → 360, 1:20 → 800)
  - `formatTime(minutes: number) => string`
  - `formatRange(startMin, endMin) => string` — `"6:10 – 6:50"` (en dash)
  - `generatePeriodRows(shift) => Row[]`
  - `mergeRowSets(rowSets: Row[][]) => Segment[]`
  - `Row = { id, startMin, endMin, kind: "teaching"|"fixed", periodNumber?, label?, labelByDay? }`
  - `Segment = { id, startMin, endMin }`
  - `Shift = { id, label, startTime, periodDuration, periodsPerDay, fixedBlocks[] }`
  - `FixedBlock = { afterPeriod, label, labelByDay?, duration }`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/scheduleModel.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  DAYS,
  parseTime,
  formatTime,
  formatRange,
  generatePeriodRows,
  mergeRowSets,
} from "../scheduleModel";

// The morning shift exactly as it appears in
// public/Tingub-NHS-Class-Program-SY-26-27.docx
const AM_SHIFT = {
  id: "AM",
  label: "Morning",
  startTime: "6:00",
  periodDuration: 40,
  periodsPerDay: 8,
  fixedBlocks: [
    {
      afterPeriod: 0,
      label: "Flag Ceremony",
      labelByDay: {
        tue: "Environmental Sanitation",
        wed: "Environmental Sanitation",
        thu: "Environmental Sanitation",
        fri: "Environmental Sanitation",
      },
      duration: 10,
    },
    { afterPeriod: 4, label: "Health Break", duration: 10 },
    {
      afterPeriod: 8,
      label: "Aral Program",
      labelByDay: { fri: "HGP" },
      duration: 40,
    },
    { afterPeriod: 8, label: "Environmental Sanitation", duration: 10 },
  ],
};

describe("DAYS", () => {
  it("is the five weekdays in order", () => {
    expect(DAYS).toEqual(["mon", "tue", "wed", "thu", "fri"]);
  });
});

describe("parseTime", () => {
  it("resolves morning times directly", () => {
    expect(parseTime("6:00")).toBe(360);
    expect(parseTime("11:40")).toBe(700);
  });

  it("keeps 12:xx as noon rather than midnight", () => {
    expect(parseTime("12:20")).toBe(740);
  });

  it("resolves 1:00-5:59 as afternoon, since the school day never starts then", () => {
    expect(parseTime("1:20")).toBe(800);
    expect(parseTime("3:00")).toBe(900);
  });
});

describe("formatTime", () => {
  it("renders 12-hour time with no meridiem", () => {
    expect(formatTime(360)).toBe("6:00");
    expect(formatTime(740)).toBe("12:20");
    expect(formatTime(800)).toBe("1:20");
  });

  it("pads minutes to two digits", () => {
    expect(formatTime(370)).toBe("6:10");
  });
});

describe("formatRange", () => {
  it("joins with an en dash", () => {
    expect(formatRange(370, 410)).toBe("6:10 – 6:50");
  });
});

describe("generatePeriodRows", () => {
  it("reproduces the morning grid from the reference document", () => {
    const rows = generatePeriodRows(AM_SHIFT);
    const rendered = rows.map((r) => `${formatRange(r.startMin, r.endMin)} ${r.kind}`);

    expect(rendered).toEqual([
      "6:00 – 6:10 fixed",
      "6:10 – 6:50 teaching",
      "6:50 – 7:30 teaching",
      "7:30 – 8:10 teaching",
      "8:10 – 8:50 teaching",
      "8:50 – 9:00 fixed",
      "9:00 – 9:40 teaching",
      "9:40 – 10:20 teaching",
      "10:20 – 11:00 teaching",
      "11:00 – 11:40 teaching",
      "11:40 – 12:20 fixed",
      "12:20 – 12:30 fixed",
    ]);
  });

  it("numbers teaching periods from 1 and gives every row a stable id", () => {
    const rows = generatePeriodRows(AM_SHIFT);
    const teaching = rows.filter((r) => r.kind === "teaching");

    expect(teaching.map((r) => r.periodNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(teaching.map((r) => r.id)).toEqual([
      "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8",
    ]);
    expect(rows.filter((r) => r.kind === "fixed").map((r) => r.id)).toEqual([
      "F0", "F1", "F2", "F3",
    ]);
  });

  it("emits multiple fixed blocks sharing an afterPeriod in array order", () => {
    const rows = generatePeriodRows(AM_SHIFT);
    const tail = rows.slice(-2);

    expect(tail[0].label).toBe("Aral Program");
    expect(tail[1].label).toBe("Environmental Sanitation");
  });

  it("carries per-weekday label overrides through untouched", () => {
    const rows = generatePeriodRows(AM_SHIFT);
    const aral = rows.find((r) => r.label === "Aral Program");

    expect(aral.labelByDay).toEqual({ fri: "HGP" });
  });

  it("re-flows the whole grid when the subject duration changes", () => {
    const rows = generatePeriodRows({ ...AM_SHIFT, periodDuration: 45 });
    const first = rows.find((r) => r.kind === "teaching");

    expect(formatRange(first.startMin, first.endMin)).toBe("6:10 – 6:55");
  });

  it("re-flows the whole grid when the start time changes", () => {
    const rows = generatePeriodRows({ ...AM_SHIFT, startTime: "6:30" });

    expect(formatTime(rows[0].startMin)).toBe("6:30");
  });
});

describe("mergeRowSets", () => {
  it("returns a single set unchanged", () => {
    const rows = [{ id: "P1", startMin: 360, endMin: 400 }];
    expect(mergeRowSets([rows]).map((s) => [s.startMin, s.endMin])).toEqual([[360, 400]]);
  });

  it("splits overlapping rows at every boundary, which is what produces the irregular teacher rows", () => {
    const am = [{ id: "P1", startMin: 660, endMin: 700 }]; // 11:00 – 11:40
    const pm = [{ id: "P1", startMin: 690, endMin: 750 }]; // 11:30 – 12:30

    const merged = mergeRowSets([am, pm]).map((s) => [s.startMin, s.endMin]);

    expect(merged).toEqual([[660, 690], [690, 700], [700, 750]]);
  });

  it("does not duplicate identical boundaries", () => {
    const a = [{ id: "P1", startMin: 360, endMin: 400 }];
    const b = [{ id: "P1", startMin: 360, endMin: 400 }];

    expect(mergeRowSets([a, b])).toHaveLength(1);
  });

  it("ignores empty sets", () => {
    const rows = [{ id: "P1", startMin: 360, endMin: 400 }];
    expect(mergeRowSets([rows, []])).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/scheduleModel.test.js`
Expected: FAIL — `Failed to resolve import "../scheduleModel"`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/scheduleModel.js`:

```js
// src/utils/scheduleModel.js
// Pure schedule geometry: turns a shift definition into the period rows that
// every Class Program and Teacher's Load grid is drawn on. No React, no
// Firestore -- this module is the single source of truth for *when* a slot is.

export const DAYS = ["mon", "tue", "wed", "thu", "fri"];

// The school day runs 6:00 AM to 6:00 PM, so a bare "1:20" is unambiguous:
// it can only mean afternoon. Hours 6-11 are morning, 12 is noon, 1-5 are PM.
export function parseTime(hhmm) {
  if (typeof hhmm !== "string") return NaN;
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;

  const rawHour = Number(match[1]);
  const minutes = Number(match[2]);
  if (rawHour > 12 || minutes > 59) return NaN;

  let hour = rawHour;
  if (rawHour >= 1 && rawHour <= 5) hour = rawHour + 12;

  return hour * 60 + minutes;
}

export function formatTime(totalMinutes) {
  const hour24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")}`;
}

export function formatRange(startMin, endMin) {
  return `${formatTime(startMin)} – ${formatTime(endMin)}`;
}

// Walks the shift sequence, emitting fixed blocks at their declared position and
// teaching periods in between. afterPeriod: 0 places a block before period 1;
// afterPeriod equal to periodsPerDay places it after the last period.
export function generatePeriodRows(shift) {
  const rows = [];
  const blocks = Array.isArray(shift.fixedBlocks) ? shift.fixedBlocks : [];
  let cursor = parseTime(shift.startTime);

  for (let placed = 0; placed <= shift.periodsPerDay; placed += 1) {
    blocks.forEach((block, blockIndex) => {
      if (block.afterPeriod !== placed) return;
      rows.push({
        id: `F${blockIndex}`,
        startMin: cursor,
        endMin: cursor + block.duration,
        kind: "fixed",
        label: block.label,
        labelByDay: block.labelByDay,
      });
      cursor += block.duration;
    });

    if (placed < shift.periodsPerDay) {
      rows.push({
        id: `P${placed + 1}`,
        startMin: cursor,
        endMin: cursor + shift.periodDuration,
        kind: "teaching",
        periodNumber: placed + 1,
      });
      cursor += shift.periodDuration;
    }
  }

  return rows;
}

// A teacher who works across both shifts sits on the union of two row sets whose
// boundaries do not line up. Splitting at every boundary is what reproduces the
// irregular rows (11:30-12:30, 3:30-4:15) seen in the reference document.
export function mergeRowSets(rowSets) {
  const boundaries = new Set();
  rowSets.forEach((rows) => {
    rows.forEach((row) => {
      boundaries.add(row.startMin);
      boundaries.add(row.endMin);
    });
  });

  const sorted = [...boundaries].sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    segments.push({
      id: `S${sorted[i]}`,
      startMin: sorted[i],
      endMin: sorted[i + 1],
    });
  }

  return segments;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/scheduleModel.test.js`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add src/utils/scheduleModel.js src/utils/__tests__/scheduleModel.test.js
git commit -m "feat(schedule): add period row generation from shift definitions"
```

---

### Task 2: Conflict detection

**Files:**
- Create: `src/utils/scheduleConflicts.js`
- Test: `src/utils/__tests__/scheduleConflicts.test.js`

**Interfaces:**
- Consumes: `DAYS` from `scheduleModel`.
- Produces:
  - `findConflicts({ sections, teachersById }) => Conflict[]`
  - `Conflict = { type, message, sectionId?, teacherId?, periodId?, day?, subject? }`
  - `type` is one of `"teacherDoubleBooked" | "unstaffed" | "sessionCountMismatch" | "outOfQualification"`
  - `Section = { id, gradeLevel, name, shiftId, subjects: SectionSubject[], cells }`
  - `SectionSubject = { subject, teacherId, sessionsPerWeek, expectedMinutesPerWeek? }`
  - `cells = { [periodId]: { mon: Cell|null, tue: ..., } }`
  - `Cell = { subject, teacherId }` — `teacherId` may be `""` for an unstaffed slot
  - `Teacher = { id, displayName, handles: string[] }`

Note: the spec lists "section double-booked" as a rule, but the `cells` shape holds
exactly one `Cell` per `(periodId, day)`, so that state is unrepresentable and needs
no runtime check. This is called out here so a reviewer does not read it as a gap.

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/scheduleConflicts.test.js`:

```js
import { describe, it, expect } from "vitest";
import { findConflicts } from "../scheduleConflicts";

const TEACHERS = {
  camposo: { id: "camposo", displayName: "Mrs. Camposo", handles: ["Math 7"] },
  hermoso: { id: "hermoso", displayName: "Mr. Hermoso", handles: ["TLE 7"] },
};

// Minimal section: one subject meeting once a week, on Monday only.
function sectionWith(cells, overrides = {}) {
  return {
    id: "s7love",
    gradeLevel: "7",
    name: "LOVE",
    shiftId: "AM",
    subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 1 }],
    cells,
    ...overrides,
  };
}

describe("findConflicts", () => {
  it("returns nothing for a clean single-section schedule", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "camposo" } } }),
    ];

    expect(findConflicts({ sections, teachersById: TEACHERS })).toEqual([]);
  });

  it("flags a teacher booked in two sections at the same period and day", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "camposo" } } }),
      sectionWith(
        { P1: { mon: { subject: "Math 7", teacherId: "camposo" } } },
        { id: "s7hope", name: "HOPE" }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    const doubled = conflicts.filter((c) => c.type === "teacherDoubleBooked");

    expect(doubled).toHaveLength(1);
    expect(doubled[0].teacherId).toBe("camposo");
    expect(doubled[0].periodId).toBe("P1");
    expect(doubled[0].day).toBe("mon");
    expect(doubled[0].message).toContain("Mrs. Camposo");
  });

  it("does not flag the same teacher in two sections on different days", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "camposo" } } }),
      sectionWith(
        { P1: { tue: { subject: "Math 7", teacherId: "camposo" } } },
        { id: "s7hope", name: "HOPE" }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    expect(conflicts.filter((c) => c.type === "teacherDoubleBooked")).toEqual([]);
  });

  it("flags a placed subject with no teacher", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "" } } }),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    const unstaffed = conflicts.filter((c) => c.type === "unstaffed");

    expect(unstaffed).toHaveLength(1);
    expect(unstaffed[0].subject).toBe("Math 7");
  });

  it("flags a subject placed fewer times than its sessionsPerWeek", () => {
    const sections = [
      sectionWith(
        { P1: { mon: { subject: "Math 7", teacherId: "camposo" } } },
        { subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 }] }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    const mismatch = conflicts.find((c) => c.type === "sessionCountMismatch");

    expect(mismatch.subject).toBe("Math 7");
    expect(mismatch.message).toContain("1");
    expect(mismatch.message).toContain("5");
  });

  it("flags a subject placed more times than its sessionsPerWeek", () => {
    const sections = [
      sectionWith(
        {
          P1: {
            mon: { subject: "Math 7", teacherId: "camposo" },
            tue: { subject: "Math 7", teacherId: "camposo" },
          },
        },
        { subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 1 }] }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    expect(conflicts.some((c) => c.type === "sessionCountMismatch")).toBe(true);
  });

  it("warns when a teacher is assigned outside their handles list", () => {
    const sections = [
      sectionWith(
        { P1: { mon: { subject: "TLE 7", teacherId: "camposo" } } },
        { subjects: [{ subject: "TLE 7", teacherId: "camposo", sessionsPerWeek: 1 }] }
      ),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    const outOfQual = conflicts.filter((c) => c.type === "outOfQualification");

    expect(outOfQual).toHaveLength(1);
    expect(outOfQual[0].teacherId).toBe("camposo");
    expect(outOfQual[0].subject).toBe("TLE 7");
  });

  it("does not warn for an unknown teacher id, which unstaffed already covers", () => {
    const sections = [
      sectionWith({ P1: { mon: { subject: "Math 7", teacherId: "" } } }),
    ];

    const conflicts = findConflicts({ sections, teachersById: TEACHERS });
    expect(conflicts.some((c) => c.type === "outOfQualification")).toBe(false);
  });

  it("tolerates missing cells and missing subjects arrays", () => {
    const sections = [{ id: "empty", gradeLevel: "7", name: "PEACE", shiftId: "AM" }];
    expect(findConflicts({ sections, teachersById: TEACHERS })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/scheduleConflicts.test.js`
Expected: FAIL — `Failed to resolve import "../scheduleConflicts"`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/scheduleConflicts.js`:

```js
// src/utils/scheduleConflicts.js
// Timetable validation. Conflicts never block saving -- a half-built schedule is
// a legitimate intermediate state -- but they are surfaced in the builder and
// before printing.

import { DAYS } from "./scheduleModel";

function eachCell(sections, visit) {
  sections.forEach((section) => {
    const cells = section.cells || {};
    Object.keys(cells).forEach((periodId) => {
      DAYS.forEach((day) => {
        const cell = cells[periodId] ? cells[periodId][day] : null;
        if (cell && cell.subject) visit({ section, periodId, day, cell });
      });
    });
  });
}

export function findConflicts({ sections = [], teachersById = {} }) {
  const conflicts = [];

  // A teacher standing in two rooms at once.
  const occupancy = new Map();
  eachCell(sections, ({ section, periodId, day, cell }) => {
    if (!cell.teacherId) return;
    const key = `${cell.teacherId}|${periodId}|${day}`;
    if (!occupancy.has(key)) occupancy.set(key, []);
    occupancy.get(key).push(section);
  });

  occupancy.forEach((occupiedSections, key) => {
    if (occupiedSections.length < 2) return;
    const [teacherId, periodId, day] = key.split("|");
    const teacher = teachersById[teacherId];
    const name = teacher ? teacher.displayName : teacherId;
    const where = occupiedSections
      .map((s) => `${s.gradeLevel} - ${s.name}`)
      .join(" and ");

    conflicts.push({
      type: "teacherDoubleBooked",
      teacherId,
      periodId,
      day,
      message: `${name} is booked in ${where} at the same time.`,
    });
  });

  // A subject on the grid with nobody to teach it.
  eachCell(sections, ({ section, periodId, day, cell }) => {
    if (cell.teacherId) return;
    conflicts.push({
      type: "unstaffed",
      sectionId: section.id,
      periodId,
      day,
      subject: cell.subject,
      message: `${cell.subject} in ${section.gradeLevel} - ${section.name} has no teacher assigned.`,
    });
  });

  // Placed sessions vs the declared sessions per week.
  sections.forEach((section) => {
    const declared = Array.isArray(section.subjects) ? section.subjects : [];
    const placedCounts = new Map();

    eachCell([section], ({ cell }) => {
      placedCounts.set(cell.subject, (placedCounts.get(cell.subject) || 0) + 1);
    });

    declared.forEach((entry) => {
      const placed = placedCounts.get(entry.subject) || 0;
      if (placed === entry.sessionsPerWeek) return;

      conflicts.push({
        type: "sessionCountMismatch",
        sectionId: section.id,
        subject: entry.subject,
        message:
          `${entry.subject} in ${section.gradeLevel} - ${section.name} is placed ` +
          `${placed} time(s) but expects ${entry.sessionsPerWeek} per week.`,
      });
    });
  });

  // Assigned outside the teacher's qualified subjects. A warning, not a block --
  // real timetables occasionally require it.
  const seenOutOfQual = new Set();
  eachCell(sections, ({ section, periodId, day, cell }) => {
    const teacher = teachersById[cell.teacherId];
    if (!teacher) return;
    if (!Array.isArray(teacher.handles) || teacher.handles.length === 0) return;
    if (teacher.handles.includes(cell.subject)) return;

    const key = `${cell.teacherId}|${cell.subject}|${section.id}`;
    if (seenOutOfQual.has(key)) return;
    seenOutOfQual.add(key);

    conflicts.push({
      type: "outOfQualification",
      teacherId: cell.teacherId,
      sectionId: section.id,
      periodId,
      day,
      subject: cell.subject,
      message: `${teacher.displayName} is not listed as handling ${cell.subject}.`,
    });
  });

  return conflicts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/scheduleConflicts.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/scheduleConflicts.js src/utils/__tests__/scheduleConflicts.test.js
git commit -m "feat(schedule): add timetable conflict detection"
```

---

### Task 3: Teacher's Load derivation

**Files:**
- Create: `src/utils/teacherLoadDerivation.js`
- Test: `src/utils/__tests__/teacherLoadDerivation.test.js`

**Interfaces:**
- Consumes: `DAYS`, `generatePeriodRows`, `formatRange` from `scheduleModel`.
  Deliberately NOT `mergeRowSets`: Tingub's two shifts are adjacent (AM ends
  12:30, PM starts 12:30), never overlapping, so concatenating both row sets and
  sorting by start time is correct and simpler. `mergeRowSets` is built and tested
  in Task 1 and becomes necessary only if a school configures genuinely
  overlapping shifts — see the deferred list at the end of this plan.
- Produces:
  - `DUTY_ROTATION: string[]` — `["IMs Preparation", "Checking & Monitoring of Outputs", "Lesson Planning"]`
  - `deriveTeacherLoad({ teacher, sections, shiftsById }) => TeacherLoad`
  - `TeacherLoad = { rows, totals }`
  - `rows: LoadRow[]`, `LoadRow = { id, startMin, endMin, timeLabel, byDay: { mon: LoadCell, ... } }`
  - `LoadCell = { kind: "teaching"|"fixed"|"duty", text, subject?, sectionLabel? }`
  - `totals = { preparations, countedMinutesPerWeek, countedLabel, breakdown }`
  - `breakdown: { label, minutesPerWeek }[]`

**The duty rotation is not arbitrary.** It was reverse-engineered from Mrs. Camposo's
sheet in the reference document: the rotation index is
`(gapRowOrdinal + dayIndex) % 3`, where `gapRowOrdinal` counts gap rows top to
bottom. This reproduces her sheet exactly and the test below asserts it.

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/teacherLoadDerivation.test.js`:

```js
import { describe, it, expect } from "vitest";
import { DUTY_ROTATION, deriveTeacherLoad } from "../teacherLoadDerivation";

const AM_SHIFT = {
  id: "AM",
  label: "Morning",
  startTime: "6:00",
  periodDuration: 40,
  periodsPerDay: 4,
  fixedBlocks: [{ afterPeriod: 0, label: "Flag Ceremony", duration: 10 }],
};

const PM_SHIFT = {
  id: "PM",
  label: "Afternoon",
  startTime: "12:30",
  periodDuration: 40,
  periodsPerDay: 2,
  fixedBlocks: [],
};

const SHIFTS = { AM: AM_SHIFT, PM: PM_SHIFT };

const CAMPOSO = {
  id: "camposo",
  displayName: "Mrs. Camposo",
  handles: ["Math 7"],
  designations: ["Grade 7 Adviser"],
  dutySlots: {},
};

// Camposo teaches Math 7 to LOVE at P1 and to HOPE at P3, every day.
function amSections() {
  const daily = (subject, teacherId) => ({
    mon: { subject, teacherId },
    tue: { subject, teacherId },
    wed: { subject, teacherId },
    thu: { subject, teacherId },
    fri: { subject, teacherId },
  });

  return [
    {
      id: "love",
      gradeLevel: "7",
      name: "LOVE",
      shiftId: "AM",
      subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 }],
      cells: { P1: daily("Math 7", "camposo") },
    },
    {
      id: "hope",
      gradeLevel: "7",
      name: "HOPE",
      shiftId: "AM",
      subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 }],
      cells: { P3: daily("Math 7", "camposo") },
    },
  ];
}

describe("DUTY_ROTATION", () => {
  it("is the three-way cycle from the reference document, in order", () => {
    expect(DUTY_ROTATION).toEqual([
      "IMs Preparation",
      "Checking & Monitoring of Outputs",
      "Lesson Planning",
    ]);
  });
});

describe("deriveTeacherLoad", () => {
  it("places each taught section as SUBJECT / SECTION", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    const p1 = load.rows.find((r) => r.timeLabel === "6:10 – 6:50");
    expect(p1.byDay.mon.kind).toBe("teaching");
    expect(p1.byDay.mon.text).toBe("Math 7\nLOVE");
  });

  it("carries fixed blocks straight through", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    const flag = load.rows[0];
    expect(flag.byDay.mon.kind).toBe("fixed");
    expect(flag.byDay.mon.text).toBe("Flag Ceremony");
  });

  it("fills gap rows with the rotation from the reference document", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    // P2 is the first gap row, P4 the second.
    const gap1 = load.rows.find((r) => r.timeLabel === "6:50 – 7:30");
    const gap2 = load.rows.find((r) => r.timeLabel === "8:10 – 8:50");

    expect([
      gap1.byDay.mon.text,
      gap1.byDay.tue.text,
      gap1.byDay.wed.text,
      gap1.byDay.thu.text,
      gap1.byDay.fri.text,
    ]).toEqual([
      "IMs Preparation",
      "Checking & Monitoring of Outputs",
      "Lesson Planning",
      "IMs Preparation",
      "Checking & Monitoring of Outputs",
    ]);

    // Second gap row starts one step further into the cycle.
    expect([
      gap2.byDay.mon.text,
      gap2.byDay.tue.text,
      gap2.byDay.wed.text,
    ]).toEqual([
      "Checking & Monitoring of Outputs",
      "Lesson Planning",
      "IMs Preparation",
    ]);
  });

  it("is deterministic - the same input renders the same sheet", () => {
    const args = { teacher: CAMPOSO, sections: amSections(), shiftsById: SHIFTS };
    expect(deriveTeacherLoad(args)).toEqual(deriveTeacherLoad(args));
  });

  it("lets a dutySlots override win over the rotation", () => {
    const teacher = {
      ...CAMPOSO,
      dutySlots: { "6:50 – 7:30": { mon: "Advisory Functions" } },
    };

    const load = deriveTeacherLoad({
      teacher,
      sections: amSections(),
      shiftsById: SHIFTS,
    });
    const gap = load.rows.find((r) => r.timeLabel === "6:50 – 7:30");

    expect(gap.byDay.mon.kind).toBe("duty");
    expect(gap.byDay.mon.text).toBe("Advisory Functions");
    expect(gap.byDay.tue.text).toBe("Checking & Monitoring of Outputs");
  });

  it("counts distinct subject and grade pairs as preparations", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    // Math 7 to two sections is still one preparation.
    expect(load.totals.preparations).toBe(1);
  });

  it("counts a second grade level as a second preparation", () => {
    const sections = amSections();
    sections.push({
      id: "obedience",
      gradeLevel: "10",
      name: "OBEDIENCE",
      shiftId: "AM",
      subjects: [{ subject: "Math 10", teacherId: "camposo", sessionsPerWeek: 5 }],
      cells: { P2: { mon: { subject: "Math 10", teacherId: "camposo" } } },
    });

    const load = deriveTeacherLoad({ teacher: CAMPOSO, sections, shiftsById: SHIFTS });
    expect(load.totals.preparations).toBe(2);
  });

  it("reports counted minutes per week with a verifiable breakdown", () => {
    const load = deriveTeacherLoad({
      teacher: CAMPOSO,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    // 2 teaching slots x 40 min x 5 days = 400 minutes.
    expect(load.totals.countedMinutesPerWeek).toBe(400);
    expect(load.totals.countedLabel).toBe("6h 40m");

    const teaching = load.totals.breakdown.find((b) => b.label === "Teaching load");
    expect(teaching.minutesPerWeek).toBe(400);
  });

  it("counts tagged duties but never breaks or rotation filler", () => {
    const teacher = {
      ...CAMPOSO,
      dutySlots: { "6:50 – 7:30": { mon: "Advisory Functions" } },
    };

    const load = deriveTeacherLoad({
      teacher,
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    // 400 teaching + one 40-minute tagged duty.
    expect(load.totals.countedMinutesPerWeek).toBe(440);
    const duties = load.totals.breakdown.find((b) => b.label === "Ancillary duties");
    expect(duties.minutesPerWeek).toBe(40);
  });

  it("builds an irregular row set for a teacher straddling both shifts", () => {
    const sections = amSections();
    sections.push({
      id: "justice",
      gradeLevel: "9",
      name: "JUSTICE",
      shiftId: "PM",
      subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 1 }],
      cells: { P1: { mon: { subject: "Math 7", teacherId: "camposo" } } },
    });

    const load = deriveTeacherLoad({ teacher: CAMPOSO, sections, shiftsById: SHIFTS });
    const labels = load.rows.map((r) => r.timeLabel);

    // Morning rows still present, and the afternoon shift is appended.
    expect(labels).toContain("6:10 – 6:50");
    expect(labels).toContain("12:30 – 1:10");
  });

  it("returns an empty grid for a teacher with no assignments", () => {
    const load = deriveTeacherLoad({
      teacher: { id: "ghost", displayName: "Teacher A", handles: [], dutySlots: {} },
      sections: amSections(),
      shiftsById: SHIFTS,
    });

    expect(load.rows).toEqual([]);
    expect(load.totals.preparations).toBe(0);
    expect(load.totals.countedMinutesPerWeek).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/teacherLoadDerivation.test.js`
Expected: FAIL — `Failed to resolve import "../teacherLoadDerivation"`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/teacherLoadDerivation.js`:

```js
// src/utils/teacherLoadDerivation.js
// The Teacher's Load grid is DERIVED, never stored. It is rebuilt from the
// section grids every time, which is what structurally prevents the Class
// Program and the Teacher's Load from disagreeing.

import { DAYS, generatePeriodRows, formatRange } from "./scheduleModel";

export const DUTY_ROTATION = [
  "IMs Preparation",
  "Checking & Monitoring of Outputs",
  "Lesson Planning",
];

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function deriveTeacherLoad({ teacher, sections = [], shiftsById = {} }) {
  const dutySlots = teacher.dutySlots || {};

  // 1. Which shifts does this teacher actually appear in?
  const touchedShiftIds = [];
  const teaching = new Map(); // `${shiftId}|${periodId}|${day}` -> cell info
  const preparations = new Set();

  sections.forEach((section) => {
    const cells = section.cells || {};
    Object.keys(cells).forEach((periodId) => {
      DAYS.forEach((day) => {
        const cell = cells[periodId] ? cells[periodId][day] : null;
        if (!cell || cell.teacherId !== teacher.id) return;

        if (!touchedShiftIds.includes(section.shiftId)) {
          touchedShiftIds.push(section.shiftId);
        }
        teaching.set(`${section.shiftId}|${periodId}|${day}`, {
          subject: cell.subject,
          sectionLabel: section.name,
        });
        preparations.add(`${cell.subject}|${section.gradeLevel}`);
      });
    });
  });

  if (touchedShiftIds.length === 0) {
    return {
      rows: [],
      totals: {
        preparations: 0,
        countedMinutesPerWeek: 0,
        countedLabel: "0h 0m",
        breakdown: [],
      },
    };
  }

  // 2. Build the row set from every shift the teacher touches, ordered by clock
  //    time. Overlapping shifts produce the irregular boundaries in the source
  //    document.
  const rows = [];
  touchedShiftIds
    .filter((shiftId) => shiftsById[shiftId])
    .forEach((shiftId) => {
      generatePeriodRows(shiftsById[shiftId]).forEach((row) => {
        rows.push({ ...row, shiftId });
      });
    });
  rows.sort((a, b) => a.startMin - b.startMin);

  // 3. Fill each row, tracking gap rows so the rotation advances per gap row.
  let gapOrdinal = 0;
  let teachingMinutes = 0;
  let dutyMinutes = 0;

  const loadRows = rows.map((row) => {
    const timeLabel = formatRange(row.startMin, row.endMin);
    const duration = row.endMin - row.startMin;
    const overrides = dutySlots[timeLabel] || {};
    const byDay = {};

    const isGapRow =
      row.kind === "teaching" &&
      !DAYS.some((day) => teaching.has(`${row.shiftId}|${row.id}|${day}`));

    DAYS.forEach((day, dayIndex) => {
      if (row.kind === "fixed") {
        const label =
          (row.labelByDay && row.labelByDay[day]) || row.label || "";
        byDay[day] = { kind: "fixed", text: label };
        return;
      }

      const taught = teaching.get(`${row.shiftId}|${row.id}|${day}`);
      if (taught) {
        teachingMinutes += duration;
        byDay[day] = {
          kind: "teaching",
          text: `${taught.subject}\n${taught.sectionLabel}`,
          subject: taught.subject,
          sectionLabel: taught.sectionLabel,
        };
        return;
      }

      if (overrides[day]) {
        dutyMinutes += duration;
        byDay[day] = { kind: "duty", text: overrides[day] };
        return;
      }

      const index = (gapOrdinal + dayIndex) % DUTY_ROTATION.length;
      byDay[day] = { kind: "duty", text: DUTY_ROTATION[index] };
    });

    if (isGapRow) gapOrdinal += 1;

    return { id: row.id, startMin: row.startMin, endMin: row.endMin, timeLabel, byDay };
  });

  // 4. Totals. See spec section 14.1 -- the counted-slot rule is explicit and the
  //    breakdown is rendered so the figure can be checked before printing.
  const breakdown = [];
  if (teachingMinutes > 0) {
    breakdown.push({ label: "Teaching load", minutesPerWeek: teachingMinutes });
  }
  if (dutyMinutes > 0) {
    breakdown.push({ label: "Ancillary duties", minutesPerWeek: dutyMinutes });
  }

  const counted = teachingMinutes + dutyMinutes;

  return {
    rows: loadRows,
    totals: {
      preparations: preparations.size,
      countedMinutesPerWeek: counted,
      countedLabel: formatDuration(counted),
      breakdown,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/teacherLoadDerivation.test.js`
Expected: PASS

- [ ] **Step 5: Run the whole suite and lint**

Run: `npm run test && npm run lint`
Expected: all suites pass, no lint errors

- [ ] **Step 6: Commit**

```bash
git add src/utils/teacherLoadDerivation.js src/utils/__tests__/teacherLoadDerivation.test.js
git commit -m "feat(schedule): derive teacher load grids from section timetables"
```

---

### Task 4: Firestore rules and page access

**Files:**
- Modify: `firestore.rules` — insert before the `match /users/{userId}` block
- Modify: `src/pageAccess.js:22` — add the `classProgram` key after `sf10Generate`
- Test: `src/utils/__tests__/scheduleAccess.test.js`

**Interfaces:**
- Consumes: `canAccessPage` from `src/pageAccess.js`.
- Produces: page key `"classProgram"`; `SCHEDULE_EDIT_ROLES` exported from `src/pageAccess.js`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/scheduleAccess.test.js`:

```js
import { describe, it, expect } from "vitest";
import { canAccessPage, SCHEDULE_EDIT_ROLES } from "../../pageAccess";

describe("classProgram page access", () => {
  it("admits the roles that read or print schedules", () => {
    expect(canAccessPage("classProgram", ["ictCoordinator"])).toBe(true);
    expect(canAccessPage("classProgram", ["principal"])).toBe(true);
    expect(canAccessPage("classProgram", ["adviser"])).toBe(true);
    expect(canAccessPage("classProgram", ["masterTeacher"])).toBe(true);
  });

  it("blocks roles with no scheduling business", () => {
    expect(canAccessPage("classProgram", ["stakeholder"])).toBe(false);
    expect(canAccessPage("classProgram", ["guidance"])).toBe(false);
    expect(canAccessPage("classProgram", [])).toBe(false);
  });

  it("restricts editing to the roles that can write the collection", () => {
    expect(SCHEDULE_EDIT_ROLES).toEqual(["ictCoordinator", "principal"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/scheduleAccess.test.js`
Expected: FAIL — `canAccessPage("classProgram", ["ictCoordinator"])` returns `false`, and `SCHEDULE_EDIT_ROLES` is `undefined`

- [ ] **Step 3: Add the page access key**

In `src/pageAccess.js`, add this line immediately after the `sf10Generate` entry:

```js
  classProgram: ["ictCoordinator", "principal", "adviser", "masterTeacher"],
```

And add this export immediately after `VIEW_LEARNERS_EDIT_ROLES`:

```js
// Schedules carry no learner PII, so reading is broad -- advisers and master
// teachers print their own sheets. Writing matches the firestore.rules block.
export const SCHEDULE_EDIT_ROLES = ["ictCoordinator", "principal"];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/scheduleAccess.test.js`
Expected: PASS

- [ ] **Step 5: Add the Firestore rules block**

In `firestore.rules`, insert immediately before the `match /users/{userId} {` block:

```
    // Class Program / Teacher's Load scheduling data. No learner PII lives here,
    // so reads are open to all scheduling-relevant staff while writes stay with
    // the roles that own the timetable.
    match /schedules/{schoolYear} {
      allow read: if hasAnyRole(["ictCoordinator", "principal", "adviser", "masterTeacher", "subjectTeacher"]);
      allow write: if hasAnyRole(["ictCoordinator", "principal"]);

      match /sections/{sectionId} {
        allow read: if hasAnyRole(["ictCoordinator", "principal", "adviser", "masterTeacher", "subjectTeacher"]);
        allow write: if hasAnyRole(["ictCoordinator", "principal"]);
      }

      match /teachers/{teacherId} {
        allow read: if hasAnyRole(["ictCoordinator", "principal", "adviser", "masterTeacher", "subjectTeacher"]);
        allow write: if hasAnyRole(["ictCoordinator", "principal"]);
      }
    }
```

- [ ] **Step 6: Deploy the rules**

Run: `firebase deploy --only firestore:rules`
Expected: `Deploy complete!`

- [ ] **Step 7: Commit**

```bash
git add firestore.rules src/pageAccess.js src/utils/__tests__/scheduleAccess.test.js
git commit -m "feat(schedule): add schedules collection rules and page access"
```

---

### Task 5: Subject palette with bidirectional filtering

**Files:**
- Create: `src/components/schedule/SubjectPalette.jsx`
- Create: `src/utils/schedulePalette.js`
- Test: `src/utils/__tests__/schedulePalette.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `buildTeacherRoster({ users, adhocTeachers }) => Teacher[]` — merges account-backed and ad-hoc teachers
  - `subjectsForTeacher(teacher) => string[]`
  - `teachersForSubject(teachers, subject) => Teacher[]`
  - `SubjectPalette` React component, props:
    `{ subjects, teachers, armed, onArm, editable }`
    where `armed` is `{ subject, teacherId } | null`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/schedulePalette.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  buildTeacherRoster,
  subjectsForTeacher,
  teachersForSubject,
} from "../schedulePalette";

const USERS = [
  {
    id: "u1",
    fullName: "Ann A. Camposo",
    roles: ["adviser", "subjectTeacher"],
    assignments: [
      { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "LOVE" },
      { role: "subjectTeacher", subject: "Math 7", gradeLevel: "7", section: "HOPE" },
      { role: "adviser", gradeLevel: "7", section: "LOVE" },
    ],
  },
  {
    id: "u2",
    fullName: "Karen Mae P. Cabahug",
    roles: ["subjectTeacher"],
    assignments: [
      { role: "subjectTeacher", subject: "AP 7", gradeLevel: "7", section: "FAITH" },
    ],
  },
];

describe("buildTeacherRoster", () => {
  it("seeds handles from distinct subjects in the user's assignments", () => {
    const roster = buildTeacherRoster({ users: USERS, adhocTeachers: [] });
    const camposo = roster.find((t) => t.displayName === "Ann A. Camposo");

    expect(camposo.handles).toEqual(["Math 7"]);
    expect(camposo.source).toBe("user");
    expect(camposo.userId).toBe("u1");
  });

  it("ignores adviser assignments, which carry no subject", () => {
    const roster = buildTeacherRoster({ users: USERS, adhocTeachers: [] });
    const camposo = roster.find((t) => t.displayName === "Ann A. Camposo");

    expect(camposo.handles).not.toContain(undefined);
    expect(camposo.handles).toHaveLength(1);
  });

  it("includes ad-hoc teachers for staff with no account", () => {
    const roster = buildTeacherRoster({
      users: USERS,
      adhocTeachers: [
        { id: "a1", displayName: "Teacher A", handles: ["ESP 7"] },
      ],
    });
    const adhoc = roster.find((t) => t.displayName === "Teacher A");

    expect(adhoc.source).toBe("adhoc");
    expect(adhoc.handles).toEqual(["ESP 7"]);
  });

  it("lets a stored handles override win over the seeded assignments", () => {
    const roster = buildTeacherRoster({
      users: USERS,
      adhocTeachers: [],
      storedHandles: { u1: ["Math 7", "Math 8"] },
    });
    const camposo = roster.find((t) => t.userId === "u1");

    expect(camposo.handles).toEqual(["Math 7", "Math 8"]);
  });

  it("tolerates users with no assignments array", () => {
    const roster = buildTeacherRoster({
      users: [{ id: "u9", fullName: "New Teacher", roles: ["subjectTeacher"] }],
      adhocTeachers: [],
    });

    expect(roster[0].handles).toEqual([]);
  });
});

describe("subjectsForTeacher", () => {
  it("returns the handles list", () => {
    expect(subjectsForTeacher({ handles: ["Math 7", "Math 8"] })).toEqual([
      "Math 7",
      "Math 8",
    ]);
  });

  it("returns an empty list when handles is missing", () => {
    expect(subjectsForTeacher({})).toEqual([]);
  });
});

describe("teachersForSubject", () => {
  it("narrows to teachers who handle the subject", () => {
    const teachers = [
      { id: "a", displayName: "A", handles: ["Math 7"] },
      { id: "b", displayName: "B", handles: ["AP 7"] },
    ];

    expect(teachersForSubject(teachers, "Math 7").map((t) => t.id)).toEqual(["a"]);
  });

  it("returns every teacher when no subject is selected", () => {
    const teachers = [{ id: "a", handles: ["Math 7"] }];
    expect(teachersForSubject(teachers, "")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/schedulePalette.test.js`
Expected: FAIL — `Failed to resolve import "../schedulePalette"`

- [ ] **Step 3: Write the roster helper**

Create `src/utils/schedulePalette.js`:

```js
// src/utils/schedulePalette.js
// Builds the teacher roster the palette filters on. Account-backed teachers are
// seeded from users[].assignments -- the app already knows who teaches what --
// and ad-hoc entries cover staff without a LIKHA-SIS account, including the
// "Teacher A" placeholders in the source document.

export function buildTeacherRoster({ users = [], adhocTeachers = [], storedHandles = {} }) {
  const fromUsers = users.map((user) => {
    const assignments = Array.isArray(user.assignments) ? user.assignments : [];
    const seeded = [
      ...new Set(
        assignments
          .filter((a) => a.role === "subjectTeacher" && a.subject)
          .map((a) => a.subject)
      ),
    ];

    return {
      id: user.id,
      source: "user",
      userId: user.id,
      displayName: user.fullName || user.email || user.id,
      handles: storedHandles[user.id] || seeded,
    };
  });

  const fromAdhoc = adhocTeachers.map((teacher) => ({
    id: teacher.id,
    source: "adhoc",
    userId: null,
    displayName: teacher.displayName,
    handles: Array.isArray(teacher.handles) ? teacher.handles : [],
  }));

  return [...fromUsers, ...fromAdhoc];
}

export function subjectsForTeacher(teacher) {
  return Array.isArray(teacher && teacher.handles) ? teacher.handles : [];
}

export function teachersForSubject(teachers, subject) {
  if (!subject) return teachers;
  return teachers.filter(
    (t) => Array.isArray(t.handles) && t.handles.includes(subject)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/schedulePalette.test.js`
Expected: PASS

- [ ] **Step 5: Write the palette component**

Create `src/components/schedule/SubjectPalette.jsx`:

```jsx
// src/components/schedule/SubjectPalette.jsx
// The armed-subject palette. Tapping a chip arms it; the grid then paints that
// subject into any cell you click. Dragging a chip is the secondary gesture.

import { teachersForSubject } from "../../utils/schedulePalette";

export default function SubjectPalette({
  subjects = [],
  teachers = [],
  armed,
  onArm,
  editable = true,
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        Subjects
      </div>

      {subjects.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Add subjects to this section to start building its program.
        </p>
      )}

      <div className="space-y-2">
        {subjects.map((entry) => {
          const isArmed = armed && armed.subject === entry.subject;
          const qualified = teachersForSubject(teachers, entry.subject);
          const assigned = teachers.find((t) => t.id === entry.teacherId);

          return (
            <button
              key={entry.subject}
              type="button"
              disabled={!editable}
              draggable={editable}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/x-likha-subject",
                  JSON.stringify({ subject: entry.subject, teacherId: entry.teacherId })
                );
              }}
              onClick={() =>
                onArm(isArmed ? null : { subject: entry.subject, teacherId: entry.teacherId })
              }
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                isArmed
                  ? "bg-primary text-white border-primary"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:border-primary"
              } ${editable ? "" : "opacity-60 cursor-not-allowed"}`}
            >
              <div className="text-sm font-semibold">{entry.subject}</div>
              <div className={`text-xs ${isArmed ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
                {assigned ? assigned.displayName : "No teacher assigned"}
                {" · "}
                {entry.sessionsPerWeek}×/week
              </div>
              {qualified.length === 0 && (
                <div className={`text-xs mt-1 ${isArmed ? "text-white/80" : "text-amber-600 dark:text-amber-400"}`}>
                  No teacher lists this subject
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify it builds and lints**

Run: `npm run lint && npm run build`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/utils/schedulePalette.js src/utils/__tests__/schedulePalette.test.js src/components/schedule/SubjectPalette.jsx
git commit -m "feat(schedule): add teacher roster and filtered subject palette"
```

---

### Task 6: Editable schedule grid

**Files:**
- Create: `src/components/schedule/ScheduleGrid.jsx`
- Create: `src/utils/scheduleSeeding.js`
- Test: `src/utils/__tests__/scheduleSeeding.test.js`

**Interfaces:**
- Consumes: `DAYS`, `formatRange` from `scheduleModel`.
- Produces:
  - `spreadPattern(sessionsPerWeek) => string[]` — which weekdays a subject lands on
  - `seedSectionCells({ section, rows }) => cells` — the "C" seed step
  - `ScheduleGrid` React component, props:
    `{ rows, cells, conflicts, armed, onPaint, editable }`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/scheduleSeeding.test.js`:

```js
import { describe, it, expect } from "vitest";
import { spreadPattern, seedSectionCells } from "../scheduleSeeding";

const ROWS = [
  { id: "F0", kind: "fixed" },
  { id: "P1", kind: "teaching" },
  { id: "P2", kind: "teaching" },
  { id: "P3", kind: "teaching" },
];

describe("spreadPattern", () => {
  it("spreads five sessions across every weekday", () => {
    expect(spreadPattern(5)).toEqual(["mon", "tue", "wed", "thu", "fri"]);
  });

  it("spreads four sessions leaving Wednesday free", () => {
    expect(spreadPattern(4)).toEqual(["mon", "tue", "thu", "fri"]);
  });

  it("spreads three sessions as Monday, Wednesday, Friday", () => {
    expect(spreadPattern(3)).toEqual(["mon", "wed", "fri"]);
  });

  it("spreads two sessions as Tuesday and Thursday", () => {
    expect(spreadPattern(2)).toEqual(["tue", "thu"]);
  });

  it("places a single session on Monday", () => {
    expect(spreadPattern(1)).toEqual(["mon"]);
  });

  it("returns nothing for zero or negative counts", () => {
    expect(spreadPattern(0)).toEqual([]);
    expect(spreadPattern(-1)).toEqual([]);
  });

  it("caps at five, since the week has five teaching days", () => {
    expect(spreadPattern(9)).toEqual(["mon", "tue", "wed", "thu", "fri"]);
  });
});

describe("seedSectionCells", () => {
  it("gives each subject its own period row, spread by sessions per week", () => {
    const section = {
      subjects: [
        { subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 },
        { subject: "MAPEH 7", teacherId: "eredera", sessionsPerWeek: 3 },
      ],
    };

    const cells = seedSectionCells({ section, rows: ROWS });

    expect(Object.keys(cells.P1)).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(cells.P1.mon).toEqual({ subject: "Math 7", teacherId: "camposo" });
    expect(Object.keys(cells.P2)).toEqual(["mon", "wed", "fri"]);
    expect(cells.P2.wed).toEqual({ subject: "MAPEH 7", teacherId: "eredera" });
  });

  it("never seeds into a fixed row", () => {
    const section = {
      subjects: [{ subject: "Math 7", teacherId: "camposo", sessionsPerWeek: 5 }],
    };

    expect(seedSectionCells({ section, rows: ROWS }).F0).toBeUndefined();
  });

  it("stops when it runs out of teaching rows", () => {
    const section = {
      subjects: [
        { subject: "A", teacherId: "t", sessionsPerWeek: 1 },
        { subject: "B", teacherId: "t", sessionsPerWeek: 1 },
        { subject: "C", teacherId: "t", sessionsPerWeek: 1 },
        { subject: "D", teacherId: "t", sessionsPerWeek: 1 },
      ],
    };

    const cells = seedSectionCells({ section, rows: ROWS });
    expect(Object.keys(cells)).toEqual(["P1", "P2", "P3"]);
  });

  it("returns an empty object for a section with no subjects", () => {
    expect(seedSectionCells({ section: {}, rows: ROWS })).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/scheduleSeeding.test.js`
Expected: FAIL — `Failed to resolve import "../scheduleSeeding"`

- [ ] **Step 3: Write the seeding helper**

Create `src/utils/scheduleSeeding.js`:

```js
// src/utils/scheduleSeeding.js
// The "seed" gesture: turn a section's subject list plus sessions-per-week into a
// first-pass grid, so a fresh school year is mostly filled in one action. Every
// seeded cell is then editable by painting or dragging.

const SPREADS = {
  1: ["mon"],
  2: ["tue", "thu"],
  3: ["mon", "wed", "fri"],
  4: ["mon", "tue", "thu", "fri"],
  5: ["mon", "tue", "wed", "thu", "fri"],
};

export function spreadPattern(sessionsPerWeek) {
  if (!Number.isFinite(sessionsPerWeek) || sessionsPerWeek <= 0) return [];
  return SPREADS[Math.min(sessionsPerWeek, 5)];
}

export function seedSectionCells({ section, rows }) {
  const subjects = Array.isArray(section && section.subjects) ? section.subjects : [];
  const teachingRows = rows.filter((r) => r.kind === "teaching");
  const cells = {};

  subjects.forEach((entry, index) => {
    const row = teachingRows[index];
    if (!row) return;

    const days = spreadPattern(entry.sessionsPerWeek);
    if (days.length === 0) return;

    cells[row.id] = {};
    days.forEach((day) => {
      cells[row.id][day] = { subject: entry.subject, teacherId: entry.teacherId };
    });
  });

  return cells;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/scheduleSeeding.test.js`
Expected: PASS

- [ ] **Step 5: Write the grid component**

Create `src/components/schedule/ScheduleGrid.jsx`:

```jsx
// src/components/schedule/ScheduleGrid.jsx
// One grid, two gestures. Paint is primary: arm a subject in the palette, then
// click or drag across cells to fill them. Drop is secondary, for precise
// one-off placement. Conflicting cells go red as you work.

import { DAYS, formatRange } from "../../utils/scheduleModel";

const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

export default function ScheduleGrid({
  rows = [],
  cells = {},
  conflicts = [],
  armed,
  onPaint,
  editable = true,
}) {
  const conflicted = new Set(
    conflicts
      .filter((c) => c.periodId && c.day)
      .map((c) => `${c.periodId}|${c.day}`)
  );

  function paint(periodId, day) {
    if (!editable || !armed) return;
    onPaint(periodId, day, armed);
  }

  function clear(periodId, day) {
    if (!editable) return;
    onPaint(periodId, day, null);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-32">
              TIME
            </th>
            {DAYS.map((day) => (
              <th
                key={day}
                className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.kind === "fixed") {
              return (
                <tr key={row.id}>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatRange(row.startMin, row.endMin)}
                  </td>
                  {DAYS.map((day) => (
                    <td
                      key={day}
                      className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                    >
                      {(row.labelByDay && row.labelByDay[day]) || row.label}
                    </td>
                  ))}
                </tr>
              );
            }

            return (
              <tr key={row.id}>
                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatRange(row.startMin, row.endMin)}
                </td>
                {DAYS.map((day) => {
                  const cell = cells[row.id] ? cells[row.id][day] : null;
                  const isConflicted = conflicted.has(`${row.id}|${day}`);

                  return (
                    <td
                      key={day}
                      onMouseDown={() => paint(row.id, day)}
                      onMouseEnter={(e) => {
                        if (e.buttons === 1) paint(row.id, day);
                      }}
                      onDoubleClick={() => clear(row.id, day)}
                      onDragOver={(e) => editable && e.preventDefault()}
                      onDrop={(e) => {
                        if (!editable) return;
                        e.preventDefault();
                        const raw = e.dataTransfer.getData("application/x-likha-subject");
                        if (raw) onPaint(row.id, day, JSON.parse(raw));
                      }}
                      className={`border px-2 py-2 text-center align-middle select-none ${
                        editable ? "cursor-pointer" : ""
                      } ${
                        isConflicted
                          ? "border-red-500 bg-red-50 dark:bg-red-900/30"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {cell ? (
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {cell.subject}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {editable && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Arm a subject in the palette, then click or drag across cells to fill them.
          Double-click a cell to clear it.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify it builds and lints**

Run: `npm run lint && npm run build`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/utils/scheduleSeeding.js src/utils/__tests__/scheduleSeeding.test.js src/components/schedule/ScheduleGrid.jsx
git commit -m "feat(schedule): add seeding helper and paintable schedule grid"
```

---

### Task 7: Printable Class Program sheet

**Files:**
- Create: `src/components/schedule/ClassProgramSheet.jsx`

**Interfaces:**
- Consumes: `DAYS`, `formatRange` from `scheduleModel`; `Teacher` shape from Task 5.
- Produces: `ClassProgramSheet` component, props
  `{ section, rows, teachersById, schoolYear, signatories }`
  where `signatories = { preparedByName, preparedByTitle, recommendingName, recommendingTitle, approvingName, approvingTitle }`.

This task has no unit test — it is presentational. Verification is the print
preview check in Step 2, which is what the print-safety mandate actually requires.

- [ ] **Step 1: Write the component**

Create `src/components/schedule/ClassProgramSheet.jsx`:

```jsx
// src/components/schedule/ClassProgramSheet.jsx
// Printable per-section Class Program, matching the layout of
// public/Tingub-NHS-Class-Program-SY-26-27.docx. Print styling lives in the
// parent page so a batch print can isolate each sheet.

import { DAYS, formatRange } from "../../utils/scheduleModel";

const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

export default function ClassProgramSheet({
  section,
  rows = [],
  teachersById = {},
  schoolYear,
  signatories = {},
}) {
  return (
    <div className="class-program-doc bg-white text-black p-6">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold tracking-wide">CLASS PROGRAM</h2>
        <p className="text-sm">S.Y. {schoolYear}</p>
        <p className="text-sm font-semibold mt-1">
          SECTION: {section.gradeLevel} - {section.name}
        </p>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 w-28">TIME</th>
            {DAYS.map((day) => (
              <th key={day} className="border border-black px-2 py-1">
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.kind === "fixed") {
              const uniform = DAYS.every(
                (day) =>
                  ((row.labelByDay && row.labelByDay[day]) || row.label) ===
                  ((row.labelByDay && row.labelByDay.mon) || row.label)
              );

              return (
                <tr key={row.id}>
                  <td className="border border-black px-2 py-1 whitespace-nowrap">
                    {formatRange(row.startMin, row.endMin)}
                  </td>
                  {uniform ? (
                    <td className="border border-black px-2 py-1 text-center font-medium" colSpan={DAYS.length}>
                      {row.label}
                    </td>
                  ) : (
                    DAYS.map((day) => (
                      <td key={day} className="border border-black px-2 py-1 text-center">
                        {(row.labelByDay && row.labelByDay[day]) || row.label}
                      </td>
                    ))
                  )}
                </tr>
              );
            }

            return (
              <tr key={row.id}>
                <td className="border border-black px-2 py-1 whitespace-nowrap">
                  {formatRange(row.startMin, row.endMin)}
                </td>
                {DAYS.map((day) => {
                  const cell = section.cells && section.cells[row.id]
                    ? section.cells[row.id][day]
                    : null;
                  const teacher = cell ? teachersById[cell.teacherId] : null;

                  return (
                    <td key={day} className="border border-black px-2 py-1 text-center">
                      {cell
                        ? `${cell.subject}${teacher ? ` – ${teacher.displayName}` : ""}`
                        : ""}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="grid grid-cols-3 gap-4 mt-8 text-xs text-center">
        <div>
          <p className="text-left mb-6">Prepared by:</p>
          <p className="font-bold uppercase">{signatories.preparedByName}</p>
          <p>{signatories.preparedByTitle || "Adviser"}</p>
        </div>
        <div>
          <p className="text-left mb-6">Recommending Approval:</p>
          <p className="font-bold uppercase">{signatories.recommendingName}</p>
          <p>{signatories.recommendingTitle || "School Principal"}</p>
        </div>
        <div>
          <p className="text-left mb-6">Approved by:</p>
          <p className="font-bold uppercase">{signatories.approvingName}</p>
          <p>{signatories.approvingTitle || "PSDS"}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and lint**

Run: `npm run lint && npm run build`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule/ClassProgramSheet.jsx
git commit -m "feat(schedule): add printable class program sheet"
```

---

### Task 8: Printable Teacher's Load sheet

**Files:**
- Create: `src/components/schedule/TeacherLoadSheet.jsx`

**Interfaces:**
- Consumes: `DAYS` from `scheduleModel`; `deriveTeacherLoad` output shape from Task 3.
- Produces: `TeacherLoadSheet` component, props
  `{ teacher, load, schoolYear, advisoryLabel, signatories }`.

- [ ] **Step 1: Write the component**

Create `src/components/schedule/TeacherLoadSheet.jsx`:

```jsx
// src/components/schedule/TeacherLoadSheet.jsx
// Printable per-teacher load, matching the layout of
// public/Tingub-NHS-Teachers-Load-S.Y.26-27.docx -- grid, workload totals,
// credentials, designations, signatories.

import { DAYS } from "../../utils/scheduleModel";

const DAY_LABELS = {
  mon: "MONDAY",
  tue: "TUESDAY",
  wed: "WEDNESDAY",
  thu: "THURSDAY",
  fri: "FRIDAY",
};

export default function TeacherLoadSheet({
  teacher,
  load,
  schoolYear,
  advisoryLabel,
  signatories = {},
}) {
  const bio = teacher.bio || {};

  return (
    <div className="teacher-load-doc bg-white text-black p-6">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold tracking-wide">TEACHER&rsquo;S LOAD</h2>
        <p className="text-sm">S.Y. {schoolYear}</p>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 w-24">TIME</th>
            {DAYS.map((day) => (
              <th key={day} className="border border-black px-2 py-1">
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {load.rows.map((row) => (
            <tr key={row.id + row.timeLabel}>
              <td className="border border-black px-2 py-1 whitespace-nowrap">
                {row.timeLabel}
              </td>
              {DAYS.map((day) => (
                <td
                  key={day}
                  className="border border-black px-2 py-1 text-center whitespace-pre-line"
                >
                  {row.byDay[day] ? row.byDay[day].text : ""}
                </td>
              ))}
            </tr>
          ))}

          <tr>
            <td className="border border-black px-2 py-1 font-semibold" colSpan={DAYS.length}>
              TOTAL NUMBER OF HOURS PER WEEK
            </td>
            <td className="border border-black px-2 py-1 text-center font-semibold">
              {load.totals.countedLabel}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-semibold" colSpan={DAYS.length}>
              TOTAL NUMBER OF PREPARATIONS
            </td>
            <td className="border border-black px-2 py-1 text-center font-semibold">
              {load.totals.preparations}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-semibold" colSpan={DAYS.length}>
              ADVISORY
            </td>
            <td className="border border-black px-2 py-1 text-center font-semibold">
              {advisoryLabel || "—"}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-3 gap-4 mt-6 text-xs text-center">
        <div>
          <p className="text-left mb-6">Respectfully submitted:</p>
          <p className="font-bold uppercase">{teacher.displayName}</p>
          <p>{bio.position || "Teacher"}</p>
        </div>
        <div>
          <p className="text-left mb-6">Recommending Approval:</p>
          <p className="font-bold uppercase">{signatories.recommendingName}</p>
          <p>{signatories.recommendingTitle || "School Principal"}</p>
        </div>
        <div>
          <p className="text-left mb-6">Approved:</p>
          <p className="font-bold uppercase">{signatories.approvingName}</p>
          <p>{signatories.approvingTitle || "Public Schools District Supervisor"}</p>
        </div>
      </div>

      <div className="mt-6 text-xs grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <p><span className="font-semibold">Course:</span> {bio.course || ""}</p>
          <p><span className="font-semibold">M.A.:</span> {bio.ma || ""}</p>
          <p><span className="font-semibold">Eligibility:</span> {bio.eligibility || ""}</p>
          <p><span className="font-semibold">First day of service:</span> {bio.firstDayOfService || ""}</p>
          <p><span className="font-semibold">No. of years in DepEd:</span> {bio.yearsInDepEd || ""}</p>
        </div>
        <div>
          <p className="font-semibold">Ancillary / Designation:</p>
          <ul className="list-none">
            {(teacher.designations || []).map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and lint**

Run: `npm run lint && npm run build`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule/TeacherLoadSheet.jsx
git commit -m "feat(schedule): add printable teacher load sheet"
```

---

### Task 9: Generator page shell

**Files:**
- Create: `src/ClassProgramGenerator.jsx`

**Interfaces:**
- Consumes: everything from Tasks 1, 2, 3, 5, 6, 7, 8; `SCHEDULE_EDIT_ROLES` from Task 4.
- Produces: default-exported `ClassProgramGenerator` component, props `{ goBack, userRoles }`.

- [ ] **Step 1: Write the page**

Create `src/ClassProgramGenerator.jsx`:

```jsx
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
        const loadedSections = sectionSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
```

- [ ] **Step 2: Verify build and lint**

Run: `npm run lint && npm run build`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ClassProgramGenerator.jsx
git commit -m "feat(schedule): add class program generator page"
```

---

### Task 10: Wire into routing and navigation

**Files:**
- Modify: `src/App.jsx:28` (import) and `src/App.jsx:163` (switch case)
- Modify: `src/components/Sidebar.jsx:89` (nav item)

**Interfaces:**
- Consumes: `ClassProgramGenerator` from Task 9; page key `classProgram` from Task 4.
- Produces: nothing downstream — this is the final wiring task.

- [ ] **Step 1: Add the import to App.jsx**

In `src/App.jsx`, immediately after the `SF10Generator` import on line 28:

```jsx
import ClassProgramGenerator from "./ClassProgramGenerator";
```

- [ ] **Step 2: Add the route case to App.jsx**

In `src/App.jsx`, immediately after the `case "sf10Generate":` block:

```jsx
      case "classProgram":
        pageContent = (
          <ClassProgramGenerator
            goBack={() => setCurrentPage("dashboard")}
            userRoles={userRoles}
          />
        );
        break;
```

`userRoles` is defined at `src/App.jsx:107` as `profile?.roles`, so it can be
`undefined` on first render. `ClassProgramGenerator` defaults the prop to `[]`,
which keeps the `SCHEDULE_EDIT_ROLES.some(...)` call safe.

- [ ] **Step 3: Add the sidebar entry**

In `src/components/Sidebar.jsx`, immediately after the `SF10 Generator` entry on line 89:

```jsx
    { label: 'Class Program & Load', page: 'classProgram' },
```

- [ ] **Step 4: Verify the full gate**

Run: `npm run lint && npm run test && npm run build`
Expected: no lint errors, all suites pass, build succeeds

- [ ] **Step 5: Manually verify in the running app**

Run: `npm run dev`

Check:
1. Sign in as an ICT Coordinator — "Class Program & Load" appears in the sidebar.
2. Open it. With no config saved it shows the setup-needed message, not a crash.
3. Sign in as a `guidance` user — the sidebar entry is absent.

- [ ] **Step 6: Commit and push**

```bash
git add src/App.jsx src/components/Sidebar.jsx
git commit -m "feat(schedule): wire class program generator into routing and sidebar"
git push -u origin worktree-class-program-generator
```

---

## Deferred to a follow-up plan

These are in the spec but deliberately not in this plan, because this plan must
produce working, testable software and these depend on it existing first:

- **Setup tab UI** for editing shifts, fixed blocks, and signatories. Until it
  exists, the `schedules/{schoolYear}` config document is seeded by hand in the
  Firebase console. Task 9 handles its absence with an explicit message.
- **Section and ad-hoc teacher management UI** (create a section, add subjects,
  set `sessionsPerWeek`, edit `handles[]`, bio and designations).
- **`expectedMinutesPerWeek` warning** (spec §6).
- **Total hours per week formula** (spec §14.1) — still open. The counted-slot
  rule and its breakdown ship in Task 3; the DepEd rule behind Mrs. Camposo's
  21h 40m is unconfirmed.
- **Overlapping-shift boundary splitting.** `mergeRowSets` (Task 1) exists and is
  tested for this, but Task 3 does not call it because Tingub's shifts are
  adjacent rather than overlapping. Wire it in if a school configures shifts that
  genuinely overlap.
