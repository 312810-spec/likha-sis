export const SUBJECT_WEIGHTS = Object.freeze({
  FILIPINO: { ww: 0.2, pt: 0.5, ex: 0.3 },
  ENGLISH: { ww: 0.2, pt: 0.5, ex: 0.3 },
  MATHEMATICS: { ww: 0.2, pt: 0.5, ex: 0.3 },
  SCIENCE: { ww: 0.2, pt: 0.5, ex: 0.3 },
  'ARALING PANLIPUNAN': { ww: 0.2, pt: 0.5, ex: 0.3 },
  'GMRC/ESP': { ww: 0.2, pt: 0.5, ex: 0.3 },
  MAKABANSA: { ww: 0.2, pt: 0.5, ex: 0.3 },
  HGP: { ww: 0.2, pt: 0.5, ex: 0.3 },
  'EPP/TLE': { ww: 0.2, pt: 0.6, ex: 0.2 },
  MAPEH: { ww: 0.2, pt: 0.6, ex: 0.2 },
  'MUSIC AND ARTS': { ww: 0.2, pt: 0.6, ex: 0.2 },
  'PE AND HEALTH': { ww: 0.2, pt: 0.6, ex: 0.2 },
});

export function getSubjectWeights(subjectName) {
  if (typeof subjectName !== 'string') {
    return null;
  }
  const key = subjectName.trim().toUpperCase();
  return SUBJECT_WEIGHTS[key] || null;
}
