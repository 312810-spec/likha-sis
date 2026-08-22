// DO 15, s.2026 weight profiles, as flat constants so a shared profile is a
// shared *reference* -- not just an equal-by-value copy a future edit could
// accidentally tune independently.
const CORE_WEIGHTS = Object.freeze({ ww: 0.2, pt: 0.5, ex: 0.3 });
const EPP_TLE_MAPEH_WEIGHTS = Object.freeze({ ww: 0.2, pt: 0.6, ex: 0.2 });

// GMRC (Grades 4-6) and Values Education (Grades 7-10) are the same
// Core-weighted subject line under two different grade-band names, so both
// keys point at CORE_WEIGHTS -- never tuned independently. Same for EPP
// (Grades 4-6) and TLE (Grades 7-10) under EPP_TLE_MAPEH_WEIGHTS.
// 'EPP/TLE' and 'GMRC/VALUES EDUCATION' are kept as legacy keys (matching
// getSubjectWeights' own "/" whitespace-collapsing below) so a subject-
// teacher assignment still saved with the old combined display label --
// "EPP / TLE" / "GMRC / Values Education", from before the subject
// directory split these into separate selectable subjects -- keeps
// resolving to the correct weights too, instead of silently falling back to
// the wrong profile.
export const SUBJECT_WEIGHTS = Object.freeze({
  FILIPINO: CORE_WEIGHTS,
  ENGLISH: CORE_WEIGHTS,
  MATHEMATICS: CORE_WEIGHTS,
  SCIENCE: CORE_WEIGHTS,
  'ARALING PANLIPUNAN': CORE_WEIGHTS,
  GMRC: CORE_WEIGHTS,
  'VALUES EDUCATION': CORE_WEIGHTS,
  'GMRC/VALUES EDUCATION': CORE_WEIGHTS,
  MAKABANSA: CORE_WEIGHTS,
  HGP: CORE_WEIGHTS,
  EPP: EPP_TLE_MAPEH_WEIGHTS,
  TLE: EPP_TLE_MAPEH_WEIGHTS,
  'EPP/TLE': EPP_TLE_MAPEH_WEIGHTS,
  MAPEH: EPP_TLE_MAPEH_WEIGHTS,
  'MUSIC AND ARTS': EPP_TLE_MAPEH_WEIGHTS,
  'PE AND HEALTH': EPP_TLE_MAPEH_WEIGHTS,
});

export function getSubjectWeights(subjectName) {
  if (typeof subjectName !== 'string') {
    return null;
  }
  // Collapses whitespace around a "/" (e.g. "EPP / TLE" -> "EPP/TLE") before
  // matching, so a subject-teacher assignment still saved with the old
  // combined display label (from before the subject directory split GMRC/EPP
  // and Values Education/TLE into separate subjects) keeps resolving to the
  // correct DO 15 weights via the 'EPP/TLE' / 'GMRC/VALUES EDUCATION' legacy
  // keys above, instead of silently falling back to the wrong profile.
  const key = subjectName.trim().toUpperCase().replace(/\s*\/\s*/g, '/');
  return SUBJECT_WEIGHTS[key] || null;
}
