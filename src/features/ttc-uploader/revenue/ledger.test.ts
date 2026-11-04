import { describe, it, expect } from 'vitest';
import { addIncomes, dayCoverage, mergeSpan, missingSpans, type DayStats } from './ledger';
import type { NotificationEntry } from './parsePurchases';
import { vnDayStart } from './vnTime';

const H = 3600_000;
const at = (key: string, hours: number) => vnDayStart(key) + hours * H;
const buy = (ts: number, hoa = 90, storyId = '1', title = 'Truyện 1'): NotificationEntry => ({
  id: `${ts}_x`,
  ts,
  income: { hoa, storyId, title, chapter: 1, kind: 'single' },
});

describe('addIncomes', () => {
  it('adds each purchase to its Vietnam day, hour and story', () => {
    const days: Record<string, DayStats> = {};
    addIncomes(days, [
      buy(at('2026-11-03', 23.5)),
      buy(at('2026-11-04', 0.25), 120, '2', 'Truyện 2'),
      buy(at('2026-11-04', 0.75)),
      { id: 'spend', ts: at('2026-11-04', 1), income: null },
    ]);
    expect(days['2026-11-03']).toMatchObject({ hoa: 90, count: 1 });
    expect(days['2026-11-03'].hours[23]).toBe(90);
    expect(days['2026-11-04']).toMatchObject({ hoa: 210, count: 2 });
    expect(days['2026-11-04'].hours[0]).toBe(210);
    expect(days['2026-11-04'].stories).toEqual({
      '1': { title: 'Truyện 1', hoa: 90, count: 1 },
      '2': { title: 'Truyện 2', hoa: 120, count: 1 },
    });
  });
});

describe('addIncomes with bulk sales and gifts', () => {
  it('adds them to the total and keeps their own tallies; a gift is not a sale', () => {
    const days: Record<string, DayStats> = {};
    const bulk = buy(at('2026-11-03', 10), 900);
    const gift = buy(at('2026-11-03', 11), 180000);
    addIncomes(days, [
      buy(at('2026-11-03', 9)),
      { ...bulk, income: { ...bulk.income!, kind: 'bulk' } },
      { ...gift, income: { ...gift.income!, kind: 'gift' } },
    ]);
    expect(days['2026-11-03']).toMatchObject({
      hoa: 180990,
      count: 2,
      bulk: { count: 1, hoa: 900 },
      gifts: { count: 1, hoa: 180000 },
    });
    expect(days['2026-11-03'].stories['1']).toMatchObject({ hoa: 180990, count: 2 });
  });
});

describe('mergeSpan / missingSpans', () => {
  it('merges overlapping and touching spans, keeps gaps', () => {
    let spans = mergeSpan([], { from: 10, to: 20 });
    spans = mergeSpan(spans, { from: 40, to: 50 });
    spans = mergeSpan(spans, { from: 20, to: 25 });
    expect(spans).toEqual([
      { from: 10, to: 25 },
      { from: 40, to: 50 },
    ]);
    expect(missingSpans(spans, 0, 60)).toEqual([
      { from: 0, to: 10 },
      { from: 25, to: 40 },
      { from: 50, to: 60 },
    ]);
    expect(missingSpans(spans, 12, 24)).toEqual([]);
  });
});

describe('dayCoverage', () => {
  const day = '2026-11-03';

  it('is complete when one span covers the whole day', () => {
    expect(dayCoverage([{ from: at(day, -5), to: at(day, 30) }], day)).toEqual({ missing: [], nothing: false });
  });

  it('checks the current day only up to the last sync, a past day to its end', () => {
    const covered = [{ from: at(day, -5), to: at(day, 10) }];
    expect(dayCoverage(covered, day, true)).toEqual({ missing: [], nothing: false });
    // Not synced since 10:00 (e.g. just after midnight, before the first sync of the day).
    expect(dayCoverage(covered, day)).toEqual({ missing: [{ from: at(day, 10), to: at(day, 24) }], nothing: false });
  });

  it('names the hours lost before the oldest notification still on TTC', () => {
    const covered = [{ from: at(day, 16), to: at(day, 30) }];
    expect(dayCoverage(covered, day)).toEqual({ missing: [{ from: at(day, 0), to: at(day, 16) }], nothing: false });
  });

  it('reports a day with no data at all', () => {
    expect(dayCoverage([{ from: at(day, 30), to: at(day, 40) }], day).nothing).toBe(true);
    expect(dayCoverage([], day).nothing).toBe(true);
  });
});
