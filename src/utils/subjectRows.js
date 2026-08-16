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
