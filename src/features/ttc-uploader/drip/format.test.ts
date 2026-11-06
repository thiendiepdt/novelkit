import { describe, it, expect } from 'vitest';
import { dripTotals, formatDuration, formatInterval, planProgress, remainingDrips } from './format';
import type { DripPlan } from './dripEngine';

const plan = (extra: Partial<DripPlan>): DripPlan => ({
  bookId: 1,
  bookTitle: 'A',
  account: 'me',
  initialBatch: 100,
  status: 'running',
  createdAt: 0,
  ...extra,
});

describe('planProgress / remainingDrips', () => {
  it('is unknown before the first look', () => {
    expect(planProgress(plan({}))).toBeNull();
    expect(remainingDrips(plan({}))).toBe(0);
  });

  it('counts what is on TTC against the folder', () => {
    expect(planProgress(plan({ ttcChapters: 150, localChapters: 500 }))).toEqual({ posted: 150, total: 500 });
    // More on TTC than in the folder: never above 100%
    expect(planProgress(plan({ ttcChapters: 520, localChapters: 500 }))).toEqual({ posted: 500, total: 500 });
  });

  it('leaves the initial batch out of the drip count', () => {
    expect(remainingDrips(plan({ ttcChapters: 20, localChapters: 500 }))).toBe(400);
    expect(remainingDrips(plan({ ttcChapters: 300, localChapters: 500 }))).toBe(200);
    expect(remainingDrips(plan({ ttcChapters: 500, localChapters: 500 }))).toBe(0);
  });
});

describe('dripTotals', () => {
  it('adds up the plans and estimates one chapter per interval', () => {
    const totals = dripTotals(
      [
        plan({ bookId: 1, ttcChapters: 300, localChapters: 500 }),
        plan({ bookId: 2, ttcChapters: 100, localChapters: 110, status: 'paused' }),
        plan({ bookId: 3 }),
      ],
      2,
    );
    expect(totals).toEqual({ posted: 400, total: 610, remaining: 200, etaMinutes: 400, unknown: 1 });
  });
});

describe('formatDuration / formatInterval', () => {
  it('reads naturally', () => {
    expect(formatDuration(45)).toBe('45 phút');
    expect(formatDuration(200)).toBe('3 giờ 20 phút');
    expect(formatDuration(120)).toBe('2 giờ');
    expect(formatDuration(3120)).toBe('2 ngày 4 giờ');
    expect(formatInterval(0.5)).toBe('30 giây');
    expect(formatInterval(5)).toBe('5 phút');
    expect(formatInterval(1.5)).toBe('1,5 phút');
  });
});
