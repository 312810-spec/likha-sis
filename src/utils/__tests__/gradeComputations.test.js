import { describe, it, expect } from 'vitest';
import {
  computeComponentPS,
  computeWeightedScore,
  computeExamPS,
  computeInitialGrade,
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
});
