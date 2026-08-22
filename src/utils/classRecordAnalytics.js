// src/utils/classRecordAnalytics.js
//
// Classroom-level analytics for a single Class Record (one Grade + Section +
// Subject + Term + School Year), aimed at a coordinator/oversight view (e.g.
// a future Academic Hub / SMEA screen) rather than the subject teacher's own
// per-learner grid. Pure, deterministic, no React/Firestore.
//
// Per-learner math is NEVER reimplemented here -- computeLearnerGradeDetail()
// below composes the same building blocks ClassRecord.jsx's own
// computeLearnerGrade() calls (computeComponentPS / computeWeightedScore /
// computeExamPS / computeInitialGrade from gradeComputations.js, then
// transmuteGrade / getGradeDescription from transmutationTable.js), so a
// class-level stat can never drift from what the teacher sees on-screen.

import {
  computeComponentPS,
  computeWeightedScore,
  computeExamPS,
  computeInitialGrade,
} from './gradeComputations';
import { transmuteGrade, getGradeDescription } from './transmutationTable';
import { groupLearnersBySex } from './sexGrouping';

// Exact strings returned by getGradeDescription() (DO 15 s.2026's five
// proficiency descriptions, English + Filipino). Matched by equality so a
// wording change there is a loud test failure here rather than a silent
// mis-tally.
const DESCRIPTION_TO_BUCKET = {
  'Advancing (Namumukod-tangi)': 'advancing',
  'Benchmarking (Napamamalas)': 'benchmarking',
  'Connecting (Natutungo)': 'connecting',
  'Developing (Napauunlad)': 'developing',
  'Emerging (Nagsisimula)': 'emerging',
};

function toRawNumberOrZero(val) {
  // Missing/blank score -> 0, same rule ClassRecord.jsx and
  // computeInitialGradeFromRecord() already use. Do not change this for
  // analytics -- a coordinator's class average must match what the teacher's
  // own grid would compute for the same learner.
  return typeof val === 'number' && !Number.isNaN(val) ? val : 0;
}

// Replicates ClassRecord.jsx's computeLearnerGrade() as a pure function (no
// closures over component state) so it can run for every learner in a class
// without a React component in the loop.
function computeLearnerGradeDetail(learner, { wwItems, ptItems, exHPS, scores, subjectWeights }) {
  const learnerScore = (scores && scores[learner.id]) || {};

  const wwRaw = wwItems.map((item) => toRawNumberOrZero(learnerScore.ww?.[item.id]));
  const wwHPSArr = wwItems.map((item) => Number(item.hps) || 0);
  const wwPS = computeComponentPS(wwRaw, wwHPSArr);
  const wwWS = computeWeightedScore(wwPS, subjectWeights.ww);

  const ptRaw = ptItems.map((item) => toRawNumberOrZero(learnerScore.pt?.[item.id]));
  const ptHPSArr = ptItems.map((item) => Number(item.hps) || 0);
  const ptPS = computeComponentPS(ptRaw, ptHPSArr);
  const ptWS = computeWeightedScore(ptPS, subjectWeights.pt);

  const st1Raw = toRawNumberOrZero(learnerScore.st1);
  const st2Raw = toRawNumberOrZero(learnerScore.st2);
  const teRaw = toRawNumberOrZero(learnerScore.te);
  const st1HPS = Number(exHPS?.st1) || 0;
  const st2HPS = Number(exHPS?.st2) || 0;
  const teHPS = Number(exHPS?.te) || 0;

  const exPS = computeExamPS(st1Raw, st1HPS, st2Raw, st2HPS, teRaw, teHPS);
  // Exam weight of exactly 0 (Tech-Pro's DO 15 20/80/0 profile) means there is
  // legitimately no exam component -- short-circuit to 0 the same way
  // ClassRecord.jsx and computeInitialGradeFromRecord() do, so a WW+PT-only
  // grade still computes instead of an all-zero exHPS nulling out everything.
  const exWS = subjectWeights.ex === 0 ? 0 : computeWeightedScore(exPS, subjectWeights.ex);

  const initialGrade = computeInitialGrade(wwWS, ptWS, exWS);
  const termGrade = transmuteGrade(initialGrade);
  const description = getGradeDescription(termGrade);

  return { wwPS, ptPS, exPS, wwWS, ptWS, exWS, initialGrade, termGrade, description };
}

// Mean of only the numeric (non-null/non-NaN) values in `values`, plus how
// many of them contributed. Never throws, never returns NaN/Infinity --
// an all-null input safely yields { mean: null, sampleSize: 0 }.
function meanOf(values) {
  const valid = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (valid.length === 0) return { mean: null, sampleSize: 0 };
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return { mean: sum / valid.length, sampleSize: valid.length };
}

// One component's classroom stats. `mps` (Mean Percentage Score) is DepEd's
// standard definition: the mean of each test-taker's own percentage score for
// that component -- the same statistic the spec's "meanScore" would have
// been, so this file keeps a single field instead of two names for one
// number. `applicable` is false when the subject's weight for this component
// is exactly 0 (e.g. Tech-Vocational's 20/80/0 profile has no exam) -- in
// that case `mps` stays null rather than reporting a misleading 0%.
function componentStats(values, weight) {
  const applicable = typeof weight === 'number' && !Number.isNaN(weight) && weight !== 0;
  if (!applicable) {
    return { mps: null, sampleSize: 0, applicable: false };
  }
  const { mean, sampleSize } = meanOf(values);
  return { mps: mean, sampleSize, applicable: true };
}

/**
 * Builds classroom-level analytics for one Class Record.
 *
 * @param {Object} params
 * @param {Array} params.learners - roster for this Grade+Section (each with at least `id`, `sex`).
 * @param {Array} params.wwItems - [{ id, hps }] Written Work assessments.
 * @param {Array} params.ptItems - [{ id, hps }] Performance Task assessments.
 * @param {Object} params.exHPS - { st1, st2, te } Highest Possible Scores.
 * @param {Object} params.scores - { [learnerId]: { ww, pt, st1, st2, te } } raw scores.
 * @param {Object} params.subjectWeights - { ww, pt, ex } decimals summing to 1, resolved by the caller.
 * @returns {Object} plain, JSON-serializable analytics object.
 */
export function buildClassRecordAnalytics({ learners, wwItems, ptItems, exHPS, scores, subjectWeights }) {
  const learnerList = Array.isArray(learners) ? learners : [];
  const wwItemList = Array.isArray(wwItems) ? wwItems : [];
  const ptItemList = Array.isArray(ptItems) ? ptItems : [];
  const examHPS = exHPS || {};
  const scoreMap = scores || {};
  const weights = subjectWeights || { ww: 0.2, pt: 0.5, ex: 0.3 };

  const { male, female } = groupLearnersBySex(learnerList);

  const details = learnerList.map((learner) =>
    computeLearnerGradeDetail(learner, {
      wwItems: wwItemList,
      ptItems: ptItemList,
      exHPS: examHPS,
      scores: scoreMap,
      subjectWeights: weights,
    })
  );

  const proficiencyProfile = {
    advancing: 0,
    benchmarking: 0,
    connecting: 0,
    developing: 0,
    emerging: 0,
    // Learners whose Initial Grade could not be computed at all yet (e.g. no
    // WW/PT items entered, or all-zero HPS) -- kept separate so the five DO
    // 15 buckets above never silently under-count the class.
    ungraded: 0,
  };
  details.forEach(({ description }) => {
    const bucket = description ? DESCRIPTION_TO_BUCKET[description] : undefined;
    if (bucket) {
      proficiencyProfile[bucket] += 1;
    } else {
      proficiencyProfile.ungraded += 1;
    }
  });

  const componentPerformance = {
    writtenWorks: componentStats(details.map((d) => d.wwPS), weights.ww),
    performanceTasks: componentStats(details.map((d) => d.ptPS), weights.pt),
    exam: componentStats(details.map((d) => d.exPS), weights.ex),
  };

  const initialGradeStats = meanOf(details.map((d) => d.initialGrade));
  const termGradeStats = meanOf(details.map((d) => d.termGrade));

  return {
    learnerCount: learnerList.length,
    maleCount: male.length,
    femaleCount: female.length,
    proficiencyProfile,
    componentPerformance,
    termPerformance: {
      meanInitialGrade: initialGradeStats.mean,
      meanTermGrade: termGradeStats.mean,
      // initialGrade and termGrade are computed from the same learners in
      // lockstep (transmuteGrade only returns null when its input isn't a
      // valid non-negative number, which never happens once initialGrade
      // itself is valid), so one sampleSize covers both means.
      sampleSize: termGradeStats.sampleSize,
    },
  };
}
