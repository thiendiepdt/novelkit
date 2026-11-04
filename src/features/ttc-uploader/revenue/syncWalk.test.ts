import { describe, it, expect } from 'vitest';
import { EMPTY_SYNC, LEDGER_VERSION, type SyncState } from './ledger';
import type { NotificationEntry, PurchasePage } from './parsePurchases';
import { OVERLAP_MS, walkPurchases } from './syncWalk';

const MIN = 60_000;
const T0 = Date.parse('2026-11-03T03:00:00Z'); // 10:00 VN

const buy = (minute: number, hoa = 90): NotificationEntry => {
  const ts = T0 + minute * MIN;
  return { id: `${ts}_${minute}`, ts, income: { hoa, storyId: '1', title: 'Truyện', chapter: 1, kind: 'single' } };
};

/** TTC's list, newest first, `size` per page. `list` may change between pages (new purchases). */
function ttc(list: NotificationEntry[], size = 3) {
  const calls: number[] = [];
  return {
    calls,
    list,
    fetchPage: async (page: number): Promise<PurchasePage> => {
      calls.push(page);
      const sorted = [...list].sort((a, b) => b.ts - a.ts);
      const lastPage = Math.max(1, Math.ceil(sorted.length / size));
      return { entries: sorted.slice((page - 1) * size, page * size), lastPage };
    },
  };
}

const walk = (fetchPage: (p: number) => Promise<PurchasePage>, state: SyncState, nowMinute: number, onPage?: () => void) =>
  walkPurchases({
    fetchPage,
    state,
    now: () => T0 + nowMinute * MIN,
    delay: async () => onPage?.(),
  });

describe('walkPurchases', () => {
  it('reads every page on the first run and covers from the oldest entry to now', async () => {
    const site = ttc([buy(0), buy(1), buy(2), buy(3), buy(4)]);
    const r = (await walk(site.fetchPage, EMPTY_SYNC, 10))!;
    expect(site.calls).toEqual([1, 2]);
    expect(r.incomes.map((e) => e.ts)).toEqual([4, 3, 2, 1, 0].map((m) => T0 + m * MIN));
    expect(r.connected).toBe(true);
    expect(r.state.covered).toEqual([{ from: T0, to: T0 + 10 * MIN }]);
    expect(r.state.newest).toBe(T0 + 4 * MIN);
  });

  it('then reads back only to the last sync, without counting the overlap twice', async () => {
    const old = Array.from({ length: 30 }, (_, i) => buy(i * 2)); // 0..58 min
    const site = ttc(old);
    const first = (await walk(site.fetchPage, EMPTY_SYNC, 60))!;

    site.list.push(buy(61), buy(62));
    site.calls.length = 0;
    const second = (await walk(site.fetchPage, first.state, 63))!;
    expect(second.incomes.map((e) => e.id)).toEqual([buy(62).id, buy(61).id]);
    // Back to (newest seen − overlap) only: 4 pages of 3, not the whole list of 11 pages.
    expect(site.calls.length).toBeLessThanOrEqual(Math.ceil((OVERLAP_MS / MIN / 2 + 3) / 3) + 1);
    expect(second.connected).toBe(true);
    expect(second.state.covered).toEqual([{ from: T0, to: T0 + 63 * MIN }]);
  });

  it('counts a purchase listed late inside the overlap', async () => {
    const site = ttc([buy(0), buy(5)]);
    const first = (await walk(site.fetchPage, EMPTY_SYNC, 6))!;
    // Listed after the first sync, although it is timed before its end.
    site.list.push(buy(4.5));
    const second = (await walk(site.fetchPage, first.state, 8))!;
    expect(second.incomes.map((e) => e.id)).toEqual([buy(4.5).id]);
  });

  it('skips entries pushed onto the next page by new purchases while reading', async () => {
    const site = ttc([buy(0), buy(1), buy(2), buy(3), buy(4), buy(5)]);
    let minute = 10;
    const r = (await walk(site.fetchPage, EMPTY_SYNC, 20, () => site.list.push(buy(minute++))))!;
    const ids = r.incomes.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of [0, 1, 2, 3, 4, 5]) expect(ids).toContain(buy(m).id);
  });

  it('keeps a quiet night covered, so the day can be complete', async () => {
    const site = ttc([buy(0)]);
    const first = (await walk(site.fetchPage, EMPTY_SYNC, 1))!;
    const night = (await walk(site.fetchPage, first.state, 600))!;
    expect(night.incomes).toEqual([]);
    expect(night.state.covered).toEqual([{ from: T0, to: T0 + 600 * MIN }]);
  });

  it('leaves a gap when TTC no longer lists the time since the last sync', async () => {
    const state: SyncState = { version: LEDGER_VERSION, covered: [{ from: T0 - 100 * MIN, to: T0 - 50 * MIN }], newest: T0 - 50 * MIN, recentIds: [] };
    const site = ttc([buy(0), buy(1)]); // the oldest notification still listed is newer than the last sync
    const r = (await walk(site.fetchPage, state, 5))!;
    expect(r.connected).toBe(false);
    expect(r.incomes).toHaveLength(2);
    expect(r.state.covered).toEqual([
      { from: T0 - 100 * MIN, to: T0 - 50 * MIN },
      { from: T0, to: T0 + 5 * MIN },
    ]);
  });

  it('gives up without a result when cancelled', async () => {
    const site = ttc([buy(0), buy(1), buy(2), buy(3)]);
    let cancelled = false;
    const r = await walkPurchases({
      fetchPage: site.fetchPage,
      state: EMPTY_SYNC,
      now: () => T0,
      delay: async () => {
        cancelled = true;
      },
      isCancelled: () => cancelled,
    });
    expect(r).toBeNull();
  });
});
