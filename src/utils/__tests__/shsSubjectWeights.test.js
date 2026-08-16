import { describe, it, expect } from 'vitest';
import { WEIGHT_PROFILES, buildShsWeightLookup, makeSubjectWeightsResolver } from '../shsSubjectWeights';

describe('shsSubjectWeights', () => {
  describe('WEIGHT_PROFILES', () => {
    it('matches the DO 15 core / techPro / immersion weight values', () => {
      expect(WEIGHT_PROFILES.core).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
      expect(WEIGHT_PROFILES.techPro).toEqual({ ww: 0.2, pt: 0.8, ex: 0 });
      expect(WEIGHT_PROFILES.immersion).toEqual({ ww: 0.15, pt: 0.65, ex: 0.2 });
    });

    it('each profile sums to exactly 1.0', () => {
      Object.values(WEIGHT_PROFILES).forEach((profile) => {
        expect(profile.ww + profile.pt + profile.ex).toBeCloseTo(1.0, 10);
      });
    });
  });

  describe('buildShsWeightLookup', () => {
    it('builds an uppercase-keyed map from configured subjects', () => {
      const lookup = buildShsWeightLookup([
        { id: 'c1', name: 'Oral Communication', weightProfile: 'core' },
        { id: 'e1', name: 'Culinary Arts', weightProfile: 'techPro' },
        { id: 'e2', name: 'Work Immersion', weightProfile: 'immersion' },
      ]);
      expect(lookup['ORAL COMMUNICATION']).toEqual(WEIGHT_PROFILES.core);
      expect(lookup['CULINARY ARTS']).toEqual(WEIGHT_PROFILES.techPro);
      expect(lookup['WORK IMMERSION']).toEqual(WEIGHT_PROFILES.immersion);
    });

    it('skips entries with an unrecognized or missing weightProfile', () => {
      const lookup = buildShsWeightLookup([
        { id: 'x', name: 'Mystery Subject', weightProfile: 'notARealProfile' },
        { id: 'y', name: 'No Profile Subject' },
      ]);
      expect(lookup).toEqual({});
    });

    it('skips entries with a missing or blank name', () => {
      const lookup = buildShsWeightLookup([
        { id: 'a', weightProfile: 'core' },
        { id: 'b', name: '   ', weightProfile: 'core' },
      ]);
      expect(lookup).toEqual({});
    });

    it('returns an empty map for non-array input', () => {
      expect(buildShsWeightLookup(null)).toEqual({});
      expect(buildShsWeightLookup(undefined)).toEqual({});
    });
  });

  describe('makeSubjectWeightsResolver', () => {
    const shsSubjects = [
      { id: 'c1', name: 'Oral Communication', weightProfile: 'core' },
      { id: 'e1', name: 'Culinary Arts', weightProfile: 'techPro' },
    ];
    const fallback = (name) => (name?.trim().toUpperCase() === 'FILIPINO' ? { ww: 0.2, pt: 0.5, ex: 0.3 } : null);

    it('resolves a configured SHS subject name to its weight profile', () => {
      const resolve = makeSubjectWeightsResolver(shsSubjects, fallback);
      expect(resolve('Oral Communication')).toEqual(WEIGHT_PROFILES.core);
      expect(resolve('culinary arts')).toEqual(WEIGHT_PROFILES.techPro);
    });

    it('falls through to the injected fallback for names it does not recognize', () => {
      const resolve = makeSubjectWeightsResolver(shsSubjects, fallback);
      expect(resolve('Filipino')).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
      expect(resolve('Unknown Subject')).toBe(null);
    });

    it('returns null for non-string input without calling the fallback', () => {
      const resolve = makeSubjectWeightsResolver(shsSubjects, fallback);
      expect(resolve(null)).toBe(null);
      expect(resolve(undefined)).toBe(null);
      expect(resolve(42)).toBe(null);
    });
  });
});
