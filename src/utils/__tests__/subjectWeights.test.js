import { describe, it, expect } from 'vitest';
import { SUBJECT_WEIGHTS, getSubjectWeights } from '../subjectWeights';

describe('subjectWeights', () => {
  it('exports SUBJECT_WEIGHTS with expected subjects and weight values', () => {
    expect(SUBJECT_WEIGHTS.FILIPINO).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    expect(SUBJECT_WEIGHTS.ENGLISH).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    expect(SUBJECT_WEIGHTS.MATHEMATICS).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    expect(SUBJECT_WEIGHTS.SCIENCE).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    expect(SUBJECT_WEIGHTS['ARALING PANLIPUNAN']).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    expect(SUBJECT_WEIGHTS['GMRC/VALUES EDUCATION']).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    expect(SUBJECT_WEIGHTS.MAKABANSA).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    expect(SUBJECT_WEIGHTS.HGP).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });

    expect(SUBJECT_WEIGHTS['EPP/TLE']).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
    expect(SUBJECT_WEIGHTS.MAPEH).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
    expect(SUBJECT_WEIGHTS['MUSIC AND ARTS']).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
    expect(SUBJECT_WEIGHTS['PE AND HEALTH']).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
  });

  it('gives EPP (Grades 4-6) and TLE (Grades 7-10) the identical EPP-TLE/MAPEH weight profile -- same subject line, different grade-band name', () => {
    expect(SUBJECT_WEIGHTS.EPP).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
    expect(SUBJECT_WEIGHTS.TLE).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
    expect(SUBJECT_WEIGHTS.EPP).toEqual(SUBJECT_WEIGHTS.TLE);
  });

  it('gives GMRC (Grades 4-6) and Values Education (Grades 7-10) the identical Core weight profile -- same subject line, different grade-band name', () => {
    expect(SUBJECT_WEIGHTS.GMRC).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    expect(SUBJECT_WEIGHTS['VALUES EDUCATION']).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    expect(SUBJECT_WEIGHTS.GMRC).toEqual(SUBJECT_WEIGHTS['VALUES EDUCATION']);
  });

  describe('getSubjectWeights', () => {
    it('returns correct weights case-insensitively', () => {
      expect(getSubjectWeights('filipino')).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
      expect(getSubjectWeights('MAPEH')).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
      expect(getSubjectWeights('epp/tle')).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
    });

    it('resolves the new standalone EPP, TLE, GMRC, and Values Education subject names correctly', () => {
      expect(getSubjectWeights('EPP')).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
      expect(getSubjectWeights('tle')).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
      expect(getSubjectWeights('GMRC')).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
      expect(getSubjectWeights('values education')).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    });

    it('still resolves the legacy combined display labels, for any assignment saved before the subject directory split', () => {
      expect(getSubjectWeights('EPP / TLE')).toEqual({ ww: 0.2, pt: 0.6, ex: 0.2 });
      expect(getSubjectWeights('GMRC / Values Education')).toEqual({ ww: 0.2, pt: 0.5, ex: 0.3 });
    });

    it('returns null if subject name is not found or input is non-string', () => {
      expect(getSubjectWeights('NON_EXISTENT_SUBJECT')).toBe(null);
      expect(getSubjectWeights(null)).toBe(null);
      expect(getSubjectWeights(undefined)).toBe(null);
      expect(getSubjectWeights(123)).toBe(null);
    });
  });
});
