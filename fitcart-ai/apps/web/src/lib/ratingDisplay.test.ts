import { describe, expect, it } from 'vitest';
import { ratingFromFitScore } from './ratingDisplay';

describe('ratingFromFitScore', () => {
  it('maps the 0-100 fitScore range onto a 1-5 star display rating', () => {
    expect(ratingFromFitScore(0)).toBe(1);
    expect(ratingFromFitScore(100)).toBe(5);
    expect(ratingFromFitScore(50)).toBe(3);
  });

  it('rounds to one decimal place', () => {
    expect(ratingFromFitScore(87)).toBe(4.5);
  });

  it('clamps out-of-range scores instead of returning an out-of-range rating', () => {
    expect(ratingFromFitScore(-10)).toBe(1);
    expect(ratingFromFitScore(150)).toBe(5);
  });
});
