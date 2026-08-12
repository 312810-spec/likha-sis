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
