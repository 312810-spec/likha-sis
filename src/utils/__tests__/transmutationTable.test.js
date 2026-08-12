import { describe, it, expect } from 'vitest';
import { transmuteGrade, getGradeDescription } from '../transmutationTable';

describe('transmutationTable', () => {
  describe('transmuteGrade', () => {
    it('transmutes known lookup values accurately', () => {
      expect(transmuteGrade(70)).toBe(75);
      expect(transmuteGrade(99.5)).toBe(100);
      expect(transmuteGrade(46.67)).toBe(70);
    });

    it('handles lower bound and intermediate values correctly', () => {
      expect(transmuteGrade(0)).toBe(0);
      expect(transmuteGrade(2.5)).toBe(60);
      expect(transmuteGrade(4.68)).toBe(61);
      expect(transmuteGrade(5.0)).toBe(61);
      expect(transmuteGrade(9.35)).toBe(62);
      expect(transmuteGrade(100)).toBe(100);
    });

    it('returns null for negative numbers and non-numeric inputs', () => {
      expect(transmuteGrade(-1)).toBe(null);
      expect(transmuteGrade(-0.01)).toBe(null);
      expect(transmuteGrade('70')).toBe(null);
      expect(transmuteGrade(null)).toBe(null);
      expect(transmuteGrade(undefined)).toBe(null);
      expect(transmuteGrade(NaN)).toBe(null);
    });
  });

  describe('getGradeDescription', () => {
    it('returns correct grade descriptions for valid term grades', () => {
      expect(getGradeDescription(95)).toBe('Advancing (Namumukod-tangi)');
      expect(getGradeDescription(90)).toBe('Advancing (Namumukod-tangi)');
      expect(getGradeDescription(100)).toBe('Advancing (Namumukod-tangi)');
      expect(getGradeDescription(85)).toBe('Benchmarking (Napamamalas)');
      expect(getGradeDescription(80)).toBe('Benchmarking (Napamamalas)');
      expect(getGradeDescription(77)).toBe('Connecting (Natutungo)');
      expect(getGradeDescription(75)).toBe('Connecting (Natutungo)');
      expect(getGradeDescription(70)).toBe('Developing (Napauunlad)');
      expect(getGradeDescription(65)).toBe('Developing (Napauunlad)');
      expect(getGradeDescription(60)).toBe('Emerging (Nagsisimula)');
      expect(getGradeDescription(0)).toBe('Emerging (Nagsisimula)');
    });

    it('returns null for invalid or non-numeric inputs', () => {
      expect(getGradeDescription('90')).toBe(null);
      expect(getGradeDescription(null)).toBe(null);
      expect(getGradeDescription(undefined)).toBe(null);
      expect(getGradeDescription(NaN)).toBe(null);
    });
  });
});
