// Which learning areas appear on a printable per-learner document (SF9
// Report Card, SF10 Generator) for a given grade level. Shared so the two
// documents can never drift apart on which subjects appear per grade.

// Subject row definitions for Grade 4-10 — in exact Annex G order.
// Kept exactly as-is; the Grade 4-10 print layout must stay byte-identical.
// `aliases`: alternate names an imported SF10 might use for this subject
// (historical DepEd terminology, not just wording/punctuation variants --
// punctuation/whitespace/case differences are handled by findCanonicalKey's
// own normalization). Used only for matching imported subject names, never
// for display -- the `label` is always what gets printed.
export const LEGACY_SUBJECT_ROWS = [
  { label: "Filipino", key: "FILIPINO", isHeader: false, aliases: [] },
  { label: "English", key: "ENGLISH", isHeader: false, aliases: [] },
  { label: "Mathematics", key: "MATHEMATICS", isHeader: false, aliases: ["Math"] },
  { label: "Science", key: "SCIENCE", isHeader: false, aliases: [] },
  {
    label: "Araling Panlipunan (AP)",
    key: "ARALING PANLIPUNAN",
    isHeader: false,
    aliases: ["AP"],
  },
  {
    label: "GMRC / Values Education",
    key: "GMRC/ESP",
    isHeader: false,
    aliases: [
      "Edukasyon sa Pagpapakatao",
      "Edukasyon sa Pagpapakatao (EsP)",
      "EsP",
      "Good Manners and Right Conduct",
      "GMRC",
      "Values Education",
    ],
  },
  {
    label: "EPP / TLE",
    key: "EPP/TLE",
    isHeader: false,
    aliases: [
      "Edukasyong Pantahanan at Pangkabuhayan",
      "Technology and Livelihood Education",
      "EPP",
      "TLE",
    ],
  },
  { label: "MAPEH", key: null, isHeader: true },
  {
    label: "Music and Arts",
    key: "MUSIC AND ARTS",
    isHeader: false,
    isIndented: true,
    aliases: ["Music & Arts"],
  },
  {
    label: "Physical Education and Health",
    key: "PE AND HEALTH",
    isHeader: false,
    isIndented: true,
    aliases: ["P.E. and Health", "Physical Education & Health"],
  },
];

// Pre-MATATAG MAPEH was graded and reported as 4 separate components rather
// than the 2 combined ones above. Deliberately NOT aliased into "MUSIC AND
// ARTS"/"PE AND HEALTH" -- for a genuinely pre-MATATAG year these are 4
// distinct, individually-earned grades, and merging them would silently
// overwrite one real grade with another. See isMatatagSchoolYear() below.
export const PRE_MATATAG_MAPEH_ROWS = [
  { label: "Music", key: "MUSIC", isHeader: false, isIndented: true, aliases: [] },
  { label: "Arts", key: "ARTS", isHeader: false, isIndented: true, aliases: [] },
  {
    label: "Physical Education",
    key: "PHYSICAL EDUCATION",
    isHeader: false,
    isIndented: true,
    aliases: ["PE", "P.E."],
  },
  { label: "Health", key: "HEALTH", isHeader: false, isIndented: true, aliases: [] },
];

export function isShsGradeLevel(gradeLevel) {
  return gradeLevel === "Grade 11" || gradeLevel === "Grade 12";
}

// MATATAG curriculum rollout: the school year each grade level switches
// from 4-component to 2-component MAPEH. Kindergarten/1/4/7 started
// SY2024-2025; 2/5/8 SY2025-2026; 3/6/9/10 SY2026-2027 (Grade 10
// accelerated to join 3/6/9 rather than lagging to SY2027-2028).
// Keyed by grade number (Kindergarten = 0); grade levels not listed here
// (SHS, or anything unrecognized) have no legacy 4-component MAPEH concept.
const MATATAG_START_YEAR_BY_GRADE_NUM = {
  0: 2024, 1: 2024, 4: 2024, 7: 2024,
  2: 2025, 5: 2025, 8: 2025,
  3: 2026, 6: 2026, 9: 2026, 10: 2026,
};

function extractGradeNumber(gradeLevel) {
  const raw = String(gradeLevel ?? "").trim();
  if (/kinder/i.test(raw)) return 0;
  const match = /(\d+)/.exec(raw);
  return match ? Number(match[1]) : null;
}

/**
 * Whether a school year + grade level falls under MATATAG's combined
 * (2-component) MAPEH structure, vs. the earlier 4-component structure.
 * Defaults to true (combined) when the grade level or school year can't be
 * determined, or the grade level has no legacy 4-component concept (SHS).
 */
export function isMatatagSchoolYear(schoolYear, gradeLevel) {
  const gradeNum = extractGradeNumber(gradeLevel);
  if (gradeNum === null) return true;
  const startYear = MATATAG_START_YEAR_BY_GRADE_NUM[gradeNum];
  if (startYear === undefined) return true;
  const yearMatch = /^(\d{4})/.exec(String(schoolYear ?? "").trim());
  if (!yearMatch) return true;
  return Number(yearMatch[1]) >= startYear;
}

function normalizeForMatch(text) {
  return String(text ?? "")
    .toUpperCase()
    .replace(/[().]/g, "")
    .replace(/\s*[/&]\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Finds the canonical subject key for a free-text imported subject name
 * (e.g. from a parsed SF10 spreadsheet), checking each candidate row's key,
 * label, and aliases after normalizing punctuation/whitespace/case. Returns
 * null when nothing matches -- callers should keep the name as its own row
 * rather than guessing.
 */
export function findCanonicalKey(importedName, rows) {
  const target = normalizeForMatch(importedName);
  if (!target) return null;
  for (const row of rows || []) {
    if (row.isHeader || !row.key) continue;
    const candidates = [row.key, row.label, ...(row.aliases || [])];
    if (candidates.some((c) => normalizeForMatch(c) === target)) {
      return row.key;
    }
  }
  return null;
}

/**
 * Which rows to match an imported SF10 subject name against for a given
 * historical school year + grade level: the MATATAG-era combined MAPEH
 * rows, or the pre-MATATAG 4-component rows, per isMatatagSchoolYear().
 */
export function getImportMatchRows(schoolYear, gradeLevel) {
  if (isMatatagSchoolYear(schoolYear, gradeLevel)) {
    return LEGACY_SUBJECT_ROWS;
  }
  return LEGACY_SUBJECT_ROWS.filter(
    (r) => r.key !== "MUSIC AND ARTS" && r.key !== "PE AND HEALTH"
  ).concat(PRE_MATATAG_MAPEH_ROWS);
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
