import { describe, it, expect } from 'vitest';
import {
  KEY_STAGE_OPTIONS,
  getGradeLevelsFromStages,
  makeDefaultShsSubjects,
  makeDefaultShsClusters,
} from '../keyStagesConfig';

describe('keyStagesConfig', () => {
  describe('getGradeLevelsFromStages', () => {
    it('returns grade levels only for checked, non-disabled stages', () => {
      expect(getGradeLevelsFromStages({ ks2: true })).toEqual(['Grade 4', 'Grade 5', 'Grade 6']);
      expect(getGradeLevelsFromStages({ ks3: true })).toEqual(['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
      expect(getGradeLevelsFromStages({ ks4: true })).toEqual(['Grade 11', 'Grade 12']);
    });

    it('combines multiple checked stages in KEY_STAGE_OPTIONS order', () => {
      expect(getGradeLevelsFromStages({ ks2: true, ks4: true })).toEqual([
        'Grade 4', 'Grade 5', 'Grade 6', 'Grade 11', 'Grade 12',
      ]);
    });

    it('never includes ks1 even if checked, since it stays disabled', () => {
      expect(getGradeLevelsFromStages({ ks1: true })).toEqual([]);
    });

    it('returns an empty array when nothing is checked', () => {
      expect(getGradeLevelsFromStages({})).toEqual([]);
    });
  });

  describe('KEY_STAGE_OPTIONS', () => {
    it('has ks4 (Senior High) enabled with its grade levels populated', () => {
      const ks4 = KEY_STAGE_OPTIONS.find((s) => s.key === 'ks4');
      expect(ks4.disabled).toBe(false);
      expect(ks4.gradeLevels).toEqual(['Grade 11', 'Grade 12']);
    });

    it('keeps ks1 (K-3) disabled', () => {
      const ks1 = KEY_STAGE_OPTIONS.find((s) => s.key === 'ks1');
      expect(ks1.disabled).toBe(true);
    });
  });

  describe('makeDefaultShsSubjects', () => {
    it('returns 5 placeholder core subjects, all tagged "core"', () => {
      const subjects = makeDefaultShsSubjects();
      expect(subjects).toHaveLength(5);
      subjects.forEach((s) => expect(s.weightProfile).toBe('core'));
    });
  });

  describe('makeDefaultShsClusters', () => {
    it('returns 10 placeholder elective clusters with empty subject lists', () => {
      const clusters = makeDefaultShsClusters();
      expect(clusters).toHaveLength(10);
      clusters.forEach((c) => expect(c.subjects).toEqual([]));
    });
  });
});
