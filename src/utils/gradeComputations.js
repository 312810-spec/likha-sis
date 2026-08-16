import { transmuteGrade } from './transmutationTable';

export function computeComponentPS(rawScores, highestPossibleScores) {
  if (!Array.isArray(rawScores) || !Array.isArray(highestPossibleScores)) {
    return null;
  }
  if (rawScores.length === 0 || rawScores.length !== highestPossibleScores.length) {
    return null;
  }

  let sumRaw = 0;
  let sumHPS = 0;

  for (let i = 0; i < rawScores.length; i++) {
    const raw = rawScores[i];
    const hps = highestPossibleScores[i];
    if (typeof raw !== 'number' || Number.isNaN(raw) || typeof hps !== 'number' || Number.isNaN(hps)) {
      return null;
    }
    sumRaw += raw;
    sumHPS += hps;
  }

  if (sumHPS === 0) {
    return null;
  }

  return (sumRaw / sumHPS) * 100;
}

export function computeWeightedScore(percentageScore, weight) {
  if (
    typeof percentageScore !== 'number' ||
    Number.isNaN(percentageScore) ||
    typeof weight !== 'number' ||
    Number.isNaN(weight)
  ) {
    return null;
  }
  return percentageScore * weight;
}

function getSubScoreContribution(raw, hps, share) {
  if (typeof hps !== 'number' || Number.isNaN(hps) || hps === 0) {
    return null;
  }
  if (raw === null || raw === undefined) {
    return 0;
  }
  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    return null;
  }
  return (raw / hps) * share;
}

export function computeExamPS(st1Raw, st1HPS, st2Raw, st2HPS, teRaw, teHPS) {
  const c1 = getSubScoreContribution(st1Raw, st1HPS, 30);
  const c2 = getSubScoreContribution(st2Raw, st2HPS, 30);
  const c3 = getSubScoreContribution(teRaw, teHPS, 40);

  if (c1 === null || c2 === null || c3 === null) {
    return null;
  }

  return c1 + c2 + c3;
}

export function computeInitialGrade(wwWS, ptWS, exWS) {
  if (
    typeof wwWS !== 'number' ||
    Number.isNaN(wwWS) ||
    typeof ptWS !== 'number' ||
    Number.isNaN(ptWS) ||
    typeof exWS !== 'number' ||
    Number.isNaN(exWS)
  ) {
    return null;
  }
  return wwWS + ptWS + exWS;
}

// Recomputes one learner's Initial Grade from a raw `classRecords` Firestore
// document, given only its doc data and the learner's id. Mirrors the score
// handling in ClassRecord.jsx's computeLearnerGrade (missing/non-numeric raw
// scores count as 0), but works off the stored doc shape directly so callers
// that only have a doc snapshot (e.g. the LARDO auto-resolve check) don't
// need to duplicate that logic.
export function computeInitialGradeFromRecord(record, learnerId, getSubjectWeightsFn) {
  if (!record || !learnerId || typeof getSubjectWeightsFn !== 'function') return null;
  const learnerScore = record.scores?.[learnerId];
  if (!learnerScore) return null;

  const weights = getSubjectWeightsFn(record.subject) || { ww: 0.2, pt: 0.5, ex: 0.3 };

  const wwItems = Array.isArray(record.wwItems) ? record.wwItems : [];
  const wwRaw = wwItems.map((item) => {
    const val = learnerScore.ww?.[item.id];
    return typeof val === 'number' && !Number.isNaN(val) ? val : 0;
  });
  const wwHPSArr = wwItems.map((item) => Number(item.hps) || 0);
  const wwWS = computeWeightedScore(computeComponentPS(wwRaw, wwHPSArr), weights.ww);

  const ptItems = Array.isArray(record.ptItems) ? record.ptItems : [];
  const ptRaw = ptItems.map((item) => {
    const val = learnerScore.pt?.[item.id];
    return typeof val === 'number' && !Number.isNaN(val) ? val : 0;
  });
  const ptHPSArr = ptItems.map((item) => Number(item.hps) || 0);
  const ptWS = computeWeightedScore(computeComponentPS(ptRaw, ptHPSArr), weights.pt);

  const exHPS = record.exHPS || {};
  const st1Raw = typeof learnerScore.st1 === 'number' && !Number.isNaN(learnerScore.st1) ? learnerScore.st1 : 0;
  const st2Raw = typeof learnerScore.st2 === 'number' && !Number.isNaN(learnerScore.st2) ? learnerScore.st2 : 0;
  const teRaw = typeof learnerScore.te === 'number' && !Number.isNaN(learnerScore.te) ? learnerScore.te : 0;
  const exPS = computeExamPS(
    st1Raw, Number(exHPS.st1) || 0,
    st2Raw, Number(exHPS.st2) || 0,
    teRaw, Number(exHPS.te) || 0
  );
  // A weight of exactly 0 (Tech-Pro subjects, DO 15's 20/80/0 profile) means
  // there is legitimately no exam component -- getExamPS naturally returns
  // null when exHPS is all zero, which would otherwise null out the whole
  // grade. Short-circuit to 0 instead so a WW+PT-only grade still computes.
  const exWS = weights.ex === 0 ? 0 : computeWeightedScore(exPS, weights.ex);

  return computeInitialGrade(wwWS, ptWS, exWS);
}

// Recomputes one learner's Term Grade (transmuted) from a raw `classRecords`
// Firestore document. Shared by ConsolidatedGrades.jsx and ReportCard.jsx so
// their displayed grades can never drift apart.
export function computeLearnerTermGrade(record, learnerId, getSubjectWeightsFn) {
  const initialGrade = computeInitialGradeFromRecord(record, learnerId, getSubjectWeightsFn);
  return transmuteGrade(initialGrade);
}
