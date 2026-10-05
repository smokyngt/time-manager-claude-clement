import { describe, expect, it } from 'bun:test';

import { Kpi } from '@/utils/kpi.js';

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe('kpi.average', () => {
  it('divides and rounds', () => {
    expect(Kpi.average(10, 4)).toBe(3);
    expect(Kpi.average(9, 3)).toBe(3);
  });

  it('returns 0 when there is no count', () => {
    expect(Kpi.average(100, 0)).toBe(0);
    expect(Kpi.average(100, -1)).toBe(0);
  });
});

describe('kpi.overtime', () => {
  it('is positive over the target and negative under it', () => {
    expect(Kpi.overtime(40 * HOUR, 35 * HOUR)).toBe(5 * HOUR);
    expect(Kpi.overtime(10 * HOUR, 35 * HOUR)).toBe(-25 * HOUR);
    expect(Kpi.overtime(0, 0)).toBe(0);
  });
});

describe('kpi.rate', () => {
  it('returns a ratio between 0 and 1', () => {
    expect(Kpi.rate(1, 4)).toBe(0.25);
    expect(Kpi.rate(1, 3)).toBe(0.3333);
    expect(Kpi.rate(4, 4)).toBe(1);
  });

  it('is 0 without a denominator or numerator', () => {
    expect(Kpi.rate(3, 0)).toBe(0);
    expect(Kpi.rate(0, 5)).toBe(0);
    expect(Kpi.rate(-1, 5)).toBe(0);
  });

  it('never exceeds 1', () => {
    expect(Kpi.rate(7, 5)).toBe(1);
  });
});

describe('kpi.target', () => {
  it('prorates the weekly target over five working days', () => {
    expect(Kpi.target(35, 5)).toBe(35 * HOUR);
    expect(Kpi.target(35, 1)).toBe(7 * HOUR);
    expect(Kpi.target(35, 10)).toBe(70 * HOUR);
    expect(Kpi.target(40, 3)).toBe(24 * HOUR);
  });

  it('is 0 without working days or hours', () => {
    expect(Kpi.target(35, 0)).toBe(0);
    expect(Kpi.target(0, 5)).toBe(0);
    expect(Kpi.target(-5, 5)).toBe(0);
    expect(Kpi.target(35, -1)).toBe(0);
  });
});

describe('kpi.valid', () => {
  it('accepts a positive range of at most 366 days', () => {
    expect(Kpi.valid(0, 1)).toBe(true);
    expect(Kpi.valid(0, 366 * DAY)).toBe(true);
  });

  it('rejects an empty or reversed range', () => {
    expect(Kpi.valid(10, 10)).toBe(false);
    expect(Kpi.valid(10, 5)).toBe(false);
  });

  it('rejects a range longer than 366 days', () => {
    expect(Kpi.valid(0, 366 * DAY + 1)).toBe(false);
  });

  it('rejects non finite bounds', () => {
    expect(Kpi.valid(Number.NaN, 10)).toBe(false);
    expect(Kpi.valid(0, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('kpi constants', () => {
  it('exposes the documented defaults', () => {
    expect(Kpi.defaultStart).toBe('09:00');
    expect(Kpi.defaultWeeklyHours).toBe(35);
    expect(Kpi.graceMinutes).toBe(5);
    expect(Kpi.maxDays).toBe(366);
  });
});
