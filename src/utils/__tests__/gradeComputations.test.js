import { describe, it, expect } from 'vitest';
import {
  computeComponentPS,
  computeWeightedScore,
  computeExamPS,
  computeInitialGrade,
  computeInitialGradeFromRecord,
  computeLearnerTermGrade,
} from '../gradeComputations';

describe('gradeComputations', () => {
  describe('computeComponentPS', () => {
    it('computes correct percentage score for normal inputs', () => {
      expect(computeComponentPS([8, 9, 10], [10, 10, 10])).toBe(90);
      expect(computeComponentPS([15], [20])).toBe(75);
    });

    it('returns null if total HPS is 0', () => {
      expect(computeComponentPS([0, 0], [0, 0])).toBe(null);
    });

    it('returns null if arrays are empty', () => {
      expect(computeComponentPS([], [])).toBe(null);
    });

    it('returns null if array lengths are mismatched', () => {
      expect(computeComponentPS([10, 20], [10])).toBe(null);
      expect(computeComponentPS([10], [10, 20])).toBe(null);
    });

    it('returns null for non-array inputs or arrays with invalid numbers', () => {
      expect(computeComponentPS(null, [10])).toBe(null);
      expect(computeComponentPS([10], undefined)).toBe(null);
      expect(computeComponentPS(['10'], [10])).toBe(null);
      expect(computeComponentPS([10], [NaN])).toBe(null);
    });
  });

  describe('computeWeightedScore', () => {
    it('computes correct weighted score', () => {
      expect(computeWeightedScore(90, 0.2)).toBe(18);
      expect(computeWeightedScore(80, 0.5)).toBe(40);
    });

    it('returns null if either input is not a number', () => {
      expect(computeWeightedScore('90', 0.2)).toBe(null);
      expect(computeWeightedScore(90, '0.2')).toBe(null);
      expect(computeWeightedScore(null, 0.2)).toBe(null);
      expect(computeWeightedScore(90, undefined)).toBe(null);
      expect(computeWeightedScore(NaN, 0.2)).toBe(null);
    });
  });

  describe('computeExamPS', () => {
    it('computes percentage score when all components are provided', () => {
      // (10/10)*30 + (20/20)*30 + (40/40)*40 = 30 + 30 + 40 = 100
      expect(computeExamPS(10, 10, 20, 20, 40, 40)).toBe(100);
      // (5/10)*30 + (10/20)*30 + (20/40)*40 = 15 + 15 + 20 = 50
      expect(computeExamPS(5, 10, 10, 20, 20, 40)).toBe(50);
    });

    it('treats missing raw values (null or undefined) as 0 contribution while requiring HPS', () => {
      // null raw for ST1: 0 + (20/20)*30 + (40/40)*40 = 70
      expect(computeExamPS(null, 10, 20, 20, 40, 40)).toBe(70);
      // undefined raw for ST2: (10/10)*30 + 0 + (40/40)*40 = 70
      expect(computeExamPS(10, 10, undefined, 20, 40, 40)).toBe(70);
    });

    it('returns null if any HPS is 0', () => {
      expect(computeExamPS(10, 0, 20, 20, 40, 40)).toBe(null);
      expect(computeExamPS(10, 10, 20, 0, 40, 40)).toBe(null);
      expect(computeExamPS(10, 10, 20, 20, 40, 0)).toBe(null);
    });

    it('returns null if any HPS is invalid or missing', () => {
      expect(computeExamPS(10, null, 20, 20, 40, 40)).toBe(null);
      expect(computeExamPS(10, 10, 20, undefined, 40, 40)).toBe(null);
    });
  });

  describe('computeInitialGrade', () => {
    it('sums the three weighted scores', () => {
      expect(computeInitialGrade(18, 40, 24)).toBe(82);
    });

    it('returns null if any input is not a number', () => {
      expect(computeInitialGrade('18', 40, 24)).toBe(null);
      expect(computeInitialGrade(18, null, 24)).toBe(null);
      expect(computeInitialGrade(18, 40, undefined)).toBe(null);
      expect(computeInitialGrade(18, 40, NaN)).toBe(null);
    });
  });

  describe('computeInitialGradeFromRecord', () => {
    const getWeights = () => ({ ww: 0.2, pt: 0.5, ex: 0.3 });
    const baseRecord = {
      subject: 'MATHEMATICS',
      wwItems: [{ id: 'ww1', hps: 10 }],
      ptItems: [{ id: 'pt1', hps: 20 }],
      exHPS: { st1: 10, st2: 10, te: 20 },
      scores: {
        l1: { ww: { ww1: 9 }, pt: { pt1: 18 }, st1: 9, st2: 9, te: 18 },
      },
    };

    it('recomputes the Initial Grade for a learner present in the record', () => {
      // wwPS=90 -> wwWS=18; ptPS=90 -> ptWS=45; exPS=90 -> exWS=27; IG=90
      const ig = computeInitialGradeFromRecord(baseRecord, 'l1', getWeights);
      expect(ig).toBeCloseTo(90, 5);
    });

    it('returns null when the learner has no scores in the record', () => {
      expect(computeInitialGradeFromRecord(baseRecord, 'unknown-learner', getWeights)).toBe(null);
    });

    it('treats missing raw scores as 0, not as excluded', () => {
      const record = {
        ...baseRecord,
        scores: { l1: { ww: {}, pt: {}, st1: 0, st2: 0, te: 0 } },
      };
      expect(computeInitialGradeFromRecord(record, 'l1', getWeights)).toBe(0);
    });

    it('returns null for missing record, learnerId, or weights function', () => {
      expect(computeInitialGradeFromRecord(null, 'l1', getWeights)).toBe(null);
      expect(computeInitialGradeFromRecord(baseRecord, null, getWeights)).toBe(null);
      expect(computeInitialGradeFromRecord(baseRecord, 'l1', null)).toBe(null);
    });

    it('falls back to the default weights when getSubjectWeightsFn returns null', () => {
      const ig = computeInitialGradeFromRecord(baseRecord, 'l1', () => null);
      expect(ig).toBeCloseTo(90, 5);
    });

    it('computes a real grade from WW+PT only when ex weight is exactly 0 (Tech-Pro profile)', () => {
      // No exam component at all: exHPS all zero, no st1/st2/te scores.
      // wwPS=90 -> wwWS(0.2)=18; ptPS=90 -> ptWS(0.8)=72; exWS short-circuits
      // to 0 instead of nulling the whole grade out. IG = 18+72+0 = 90.
      const techProRecord = {
        subject: 'CULINARY ARTS',
        wwItems: [{ id: 'ww1', hps: 10 }],
        ptItems: [{ id: 'pt1', hps: 20 }],
        exHPS: { st1: 0, st2: 0, te: 0 },
        scores: {
          l1: { ww: { ww1: 9 }, pt: { pt1: 18 } },
        },
      };
      const techProWeights = () => ({ ww: 0.2, pt: 0.8, ex: 0 });
      const ig = computeInitialGradeFromRecord(techProRecord, 'l1', techProWeights);
      expect(ig).toBeCloseTo(90, 5);
    });
  });

  describe('computeLearnerTermGrade', () => {
    const getWeights = () => ({ ww: 0.2, pt: 0.5, ex: 0.3 });
    const baseRecord = {
      subject: 'MATHEMATICS',
      wwItems: [{ id: 'ww1', hps: 10 }],
      ptItems: [{ id: 'pt1', hps: 20 }],
      exHPS: { st1: 10, st2: 10, te: 20 },
      scores: {
        l1: { ww: { ww1: 9 }, pt: { pt1: 18 }, st1: 9, st2: 9, te: 18 },
      },
    };

    it('transmutes the Initial Grade into the Term Grade shown on ConsolidatedGrades and ReportCard', () => {
      // Same inputs as computeInitialGradeFromRecord's IG=90 case; transmuted via the table.
      expect(computeLearnerTermGrade(baseRecord, 'l1', getWeights)).toBe(91);
    });

    it('returns null when the underlying Initial Grade cannot be computed', () => {
      expect(computeLearnerTermGrade(null, 'l1', getWeights)).toBe(null);
      expect(computeLearnerTermGrade(baseRecord, 'unknown-learner', getWeights)).toBe(null);
    });
  });
});
