import { describe, it, expect } from 'vitest';
import { buildClassRecordAnalytics } from '../classRecordAnalytics';

const CORE_WEIGHTS = { ww: 0.2, pt: 0.5, ex: 0.3 };

describe('buildClassRecordAnalytics', () => {
  it('computes a full classroom profile for a small class spanning all five proficiency levels', () => {
    // Each learner is built so ww%, pt%, and exam% are all equal to X, and
    // since CORE_WEIGHTS sums to 1, each learner's Initial Grade is exactly
    // X too -- this keeps the expected numbers easy to hand-verify while
    // still exercising the real component pipelines independently.
    const wwItems = [{ id: 'ww1', hps: 10 }];
    const ptItems = [{ id: 'pt1', hps: 20 }];
    const exHPS = { st1: 10, st2: 10, te: 20 };

    const learners = [
      { id: 'adv', firstName: 'Ana', lastName: 'DelaCruz', sex: 'Male' }, // X=100 -> IG100 -> TG100 -> Advancing
      { id: 'ben', firstName: 'Ben', lastName: 'Reyes', sex: 'Female' }, // X=80  -> IG80  -> TG83  -> Benchmarking
      { id: 'con', firstName: 'Carlo', lastName: 'Santos', sex: 'Male' }, // X=75  -> IG75  -> TG79  -> Connecting
      { id: 'dev', firstName: 'Dina', lastName: 'Torres', sex: 'Female' }, // X=65  -> IG65  -> TG73  -> Developing
      { id: 'eme', firstName: 'Eli', lastName: 'Ramos', sex: undefined }, // X=15  -> IG15  -> TG63  -> Emerging, unresolved sex
    ];

    const scores = {
      adv: { ww: { ww1: 10 }, pt: { pt1: 20 }, st1: 10, st2: 10, te: 20 },
      ben: { ww: { ww1: 8 }, pt: { pt1: 16 }, st1: 8, st2: 8, te: 16 },
      con: { ww: { ww1: 7.5 }, pt: { pt1: 15 }, st1: 7.5, st2: 7.5, te: 15 },
      dev: { ww: { ww1: 6.5 }, pt: { pt1: 13 }, st1: 6.5, st2: 6.5, te: 13 },
      eme: { ww: { ww1: 1.5 }, pt: { pt1: 3 }, st1: 1.5, st2: 1.5, te: 3 },
    };

    const result = buildClassRecordAnalytics({
      learners,
      wwItems,
      ptItems,
      exHPS,
      scores,
      subjectWeights: CORE_WEIGHTS,
    });

    expect(result.learnerCount).toBe(5);
    expect(result.maleCount).toBe(2); // adv, con
    expect(result.femaleCount).toBe(2); // ben, dev
    // eme's undefined sex must still count toward learnerCount, just not M/F.

    expect(result.proficiencyProfile).toEqual({
      advancing: 1,
      benchmarking: 1,
      connecting: 1,
      developing: 1,
      emerging: 1,
      ungraded: 0,
    });

    expect(result.componentPerformance.writtenWorks.applicable).toBe(true);
    expect(result.componentPerformance.writtenWorks.sampleSize).toBe(5);
    expect(result.componentPerformance.writtenWorks.mps).toBeCloseTo(67, 5);

    expect(result.componentPerformance.performanceTasks.applicable).toBe(true);
    expect(result.componentPerformance.performanceTasks.sampleSize).toBe(5);
    expect(result.componentPerformance.performanceTasks.mps).toBeCloseTo(67, 5);

    expect(result.componentPerformance.exam.applicable).toBe(true);
    expect(result.componentPerformance.exam.sampleSize).toBe(5);
    expect(result.componentPerformance.exam.mps).toBeCloseTo(67, 5);

    expect(result.termPerformance.sampleSize).toBe(5);
    expect(result.termPerformance.meanInitialGrade).toBeCloseTo(67, 5);
    expect(result.termPerformance.meanTermGrade).toBeCloseTo(79.6, 5);
  });

  it('returns zero counts and null stats for an empty class, without throwing', () => {
    const result = buildClassRecordAnalytics({
      learners: [],
      wwItems: [{ id: 'ww1', hps: 10 }],
      ptItems: [{ id: 'pt1', hps: 20 }],
      exHPS: { st1: 10, st2: 10, te: 20 },
      scores: {},
      subjectWeights: CORE_WEIGHTS,
    });

    expect(result.learnerCount).toBe(0);
    expect(result.maleCount).toBe(0);
    expect(result.femaleCount).toBe(0);
    expect(result.proficiencyProfile).toEqual({
      advancing: 0,
      benchmarking: 0,
      connecting: 0,
      developing: 0,
      emerging: 0,
      ungraded: 0,
    });
    expect(result.componentPerformance.writtenWorks).toEqual({ mps: null, sampleSize: 0, applicable: true });
    expect(result.componentPerformance.performanceTasks).toEqual({ mps: null, sampleSize: 0, applicable: true });
    expect(result.componentPerformance.exam).toEqual({ mps: null, sampleSize: 0, applicable: true });
    expect(result.termPerformance).toEqual({ meanInitialGrade: null, meanTermGrade: null, sampleSize: 0 });
  });

  it('never throws and returns safe defaults when called with no data at all', () => {
    expect(() => buildClassRecordAnalytics({})).not.toThrow();
    const result = buildClassRecordAnalytics({});
    expect(result.learnerCount).toBe(0);
    expect(result.termPerformance.meanInitialGrade).toBe(null);
  });

  it('propagates a zero-HPS Written Work component as null/not-NaN without corrupting other components', () => {
    const result = buildClassRecordAnalytics({
      learners: [{ id: 'l1', sex: 'Male' }],
      wwItems: [{ id: 'ww1', hps: 0 }], // degenerate: no possible score
      ptItems: [{ id: 'pt1', hps: 20 }],
      exHPS: { st1: 10, st2: 10, te: 20 },
      scores: {
        l1: { ww: { ww1: 5 }, pt: { pt1: 18 }, st1: 9, st2: 9, te: 18 },
      },
      subjectWeights: CORE_WEIGHTS,
    });

    expect(result.componentPerformance.writtenWorks).toEqual({ mps: null, sampleSize: 0, applicable: true });
    expect(Number.isNaN(result.componentPerformance.writtenWorks.mps)).toBe(false);
    // PT and Exam are unaffected by WW's degenerate HPS.
    expect(result.componentPerformance.performanceTasks.mps).toBeCloseTo(90, 5);
    expect(result.componentPerformance.exam.mps).toBeCloseTo(90, 5);
    // A null WW weighted score nulls this learner's Initial Grade entirely
    // (matches ClassRecord.jsx/computeInitialGrade's existing all-or-nothing
    // rule), so the learner is "ungraded" rather than silently mis-graded.
    expect(result.proficiencyProfile.ungraded).toBe(1);
    expect(result.termPerformance).toEqual({ meanInitialGrade: null, meanTermGrade: null, sampleSize: 0 });
  });

  it('propagates a zero sub-HPS inside the exam (ST1/ST2/TE) as null without NaN/Infinity', () => {
    const result = buildClassRecordAnalytics({
      learners: [{ id: 'l1', sex: 'Female' }],
      wwItems: [{ id: 'ww1', hps: 10 }],
      ptItems: [{ id: 'pt1', hps: 20 }],
      exHPS: { st1: 0, st2: 10, te: 20 }, // ST1 HPS never configured
      scores: {
        l1: { ww: { ww1: 9 }, pt: { pt1: 18 }, st1: 5, st2: 9, te: 18 },
      },
      subjectWeights: CORE_WEIGHTS,
    });

    expect(result.componentPerformance.exam).toEqual({ mps: null, sampleSize: 0, applicable: true });
    expect(Number.isFinite(result.componentPerformance.exam.mps)).toBe(false);
    expect(result.componentPerformance.writtenWorks.mps).toBeCloseTo(90, 5);
    expect(result.componentPerformance.performanceTasks.mps).toBeCloseTo(90, 5);
    expect(result.proficiencyProfile.ungraded).toBe(1);
  });

  it('reports the exam component as not applicable (null, not 0%) for a Tech-Vocational subject with exam weight 0', () => {
    const techVocWeights = { ww: 0.2, pt: 0.8, ex: 0 };

    const result = buildClassRecordAnalytics({
      learners: [{ id: 'l1', sex: 'Male' }],
      wwItems: [{ id: 'ww1', hps: 10 }],
      ptItems: [{ id: 'pt1', hps: 20 }],
      exHPS: { st1: 0, st2: 0, te: 0 }, // no exam configured at all
      scores: {
        l1: { ww: { ww1: 9 }, pt: { pt1: 18 } },
      },
      subjectWeights: techVocWeights,
    });

    expect(result.componentPerformance.exam).toEqual({ mps: null, sampleSize: 0, applicable: false });
    // WW/PT still compute normally and the learner is still graded -- the
    // exam's weight-0 short-circuit (mirroring ClassRecord.jsx) must not null
    // out the whole Initial Grade the way a genuine zero-HPS gap would.
    expect(result.componentPerformance.writtenWorks.mps).toBeCloseTo(90, 5);
    expect(result.componentPerformance.performanceTasks.mps).toBeCloseTo(90, 5);
    expect(result.termPerformance.sampleSize).toBe(1);
    expect(result.termPerformance.meanInitialGrade).toBeCloseTo(90, 5);
    expect(result.termPerformance.meanTermGrade).toBeCloseTo(91, 5);
    expect(result.proficiencyProfile.advancing).toBe(1);
  });

  it('counts unresolved/missing sex toward learnerCount but not toward male or female', () => {
    const result = buildClassRecordAnalytics({
      learners: [
        { id: 'm1', sex: 'Male' },
        { id: 'f1', sex: 'Female' },
        { id: 'u1', sex: '' },
        { id: 'u2', sex: 'Other' },
        { id: 'u3' }, // sex entirely missing
      ],
      wwItems: [],
      ptItems: [],
      exHPS: {},
      scores: {},
      subjectWeights: CORE_WEIGHTS,
    });

    expect(result.learnerCount).toBe(5);
    expect(result.maleCount).toBe(1);
    expect(result.femaleCount).toBe(1);
    // 3 learners (u1, u2, u3) are neither male nor female but still counted
    // in learnerCount, and -- since no wwItems/ptItems/exHPS are configured
    // -- all five learners land in "ungraded" rather than any proficiency
    // bucket.
    expect(result.proficiencyProfile.ungraded).toBe(5);
  });
});
