// src/utils/shsSubjectWeights.js
// DO 017, s.2026 Strengthened SHS grading weights (Grades 11-12).
//
// subjectWeights.js's flat name->weight map stays untouched -- it can't
// contain school-configured SHS subject names it doesn't know about ahead
// of time. This module resolves weights for those school-configured names
// via a small profile tag instead, and composes with the existing static
// map as a fallback so a single resolver works for every grade level.

// The three DO 15-mandated weight profiles. The numbers are fixed by the
// mandate; subject NAMES are school-configured (never hardcoded here) --
// see SetupWizard.jsx's SHS Configuration step.
//   core:      Grade 11 mandatory core subjects.
//   techPro:   regular Tech-Pro Track specialization/cluster subjects --
//              no written exam component (ex: 0).
//   immersion: the Work Immersion subject specifically.
export const WEIGHT_PROFILES = Object.freeze({
  core: { ww: 0.2, pt: 0.5, ex: 0.3 },
  techPro: { ww: 0.2, pt: 0.8, ex: 0 },
  immersion: { ww: 0.15, pt: 0.65, ex: 0.2 },
});

// Builds an uppercase-keyed { [subjectName]: weights } map from a school's
// configured SHS subject list. Entries with an unrecognized weightProfile
// are skipped rather than guessed.
export function buildShsWeightLookup(shsSubjects) {
  const lookup = {};
  if (!Array.isArray(shsSubjects)) return lookup;
  shsSubjects.forEach((subject) => {
    const name = subject?.name;
    const profile = WEIGHT_PROFILES[subject?.weightProfile];
    if (typeof name !== 'string' || !name.trim() || !profile) return;
    lookup[name.trim().toUpperCase()] = profile;
  });
  return lookup;
}

// Returns a getSubjectWeights-compatible resolver: (subjectName) => weights|null.
// Checks the school's configured SHS subjects first, then falls through to
// fallbackGetSubjectWeights (the existing static Grade 4-10 map) -- so it's
// safe to use this resolver unconditionally regardless of grade level.
export function makeSubjectWeightsResolver(shsSubjects, fallbackGetSubjectWeights) {
  const lookup = buildShsWeightLookup(shsSubjects);
  return function resolveSubjectWeights(subjectName) {
    if (typeof subjectName !== 'string') return null;
    const key = subjectName.trim().toUpperCase();
    return lookup[key] || fallbackGetSubjectWeights(subjectName);
  };
}

export default makeSubjectWeightsResolver;
