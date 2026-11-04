import { describe, it, expect, vi, afterEach } from 'vitest';
import { RevenueEngine, type EngineDeps } from './revenueEngine';
import { EMPTY_SYNC, emptyDay, type DayStats, type SyncState } from './ledger';
import type { NotificationEntry } from './parsePurchases';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const NOW = Date.parse('2026-11-03T05:00:00Z'); // 12:00 VN, 3/11
const YESTERDAY = Date.parse('2026-11-02T10:00:00Z');

/** A purchase notification as TTC renders it. */
const item = (ts: number, hoa: number) =>
  `<div class="notify-item filter-item" data-type="purchase" id="notif-${ts}_a"
     onclick="handleNotificationClick(event, '${ts}_a', '/truyen/7')">
     <div class="notify-content">💰 Nhận <b>${hoa} hoa</b> từ lượt mua chương 1 - <b>Truyện 7</b></div></div>`;
const html = (items: string[], lastPage: number) =>
  `<div id="notifList">${items.join('')}</div>${Array.from({ length: lastPage }, (_, i) => `<a class="page-link" href="/thong-bao?page=${i + 1}&type=purchase">${i + 1}</a>`).join('')}`;

const PAGES = [html([item(NOW - 1000, 90), item(NOW - 2000, 90)], 2), html([item(YESTERDAY, 500)], 2)];

function makeDeps(overrides: Partial<EngineDeps> = {}) {
  const commits: { incomes: NotificationEntry[]; state: SyncState }[] = [];
  const deps: Partial<EngineDeps> = {
    fetchPage: async (_account, page) => PAGES[page - 1],
    readSync: async () => ({ ...EMPTY_SYNC }),
    readMonth: async (): Promise<Record<string, DayStats>> => ({}),
    commitIncomes: async (_account, incomes, state) => {
      commits.push({ incomes, state });
      return ['2026-11'];
    },
    now: () => NOW,
    delay: async () => {},
    ...overrides,
  };
  return { deps, commits };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('RevenueEngine', () => {
  let engine: RevenueEngine | null = null;
  afterEach(() => engine?.stop());

  it('syncs on start: today counts only purchases of the Vietnam day, then writes them', async () => {
    const { deps, commits } = makeDeps();
    engine = new RevenueEngine('thiendiepdt', deps);
    const seen: number[] = [];
    engine.subscribe(() => seen.push(engine!.getSnapshot().today.hoa));
    engine.start();
    await vi.waitFor(() => expect(engine!.getSnapshot().lastSyncAt).toBe(NOW));

    const snap = engine.getSnapshot();
    expect(snap.today).toMatchObject({ hoa: 180, count: 2 });
    expect(snap.days['2026-11-02']).toMatchObject({ hoa: 500 });
    expect(snap.syncing).toBe(false);
    expect(commits).toHaveLength(1);
    expect(commits[0].incomes).toHaveLength(3);
    // The total was shown while reading (live), and never went above the final value.
    expect(seen).toContain(180);
    expect(Math.max(...seen)).toBe(180);
  });

  it('writes nothing when stopped mid-sync (account switched)', async () => {
    let release!: () => void;
    const { deps, commits } = makeDeps({
      delay: () => new Promise<void>((r) => (release = r)),
    });
    engine = new RevenueEngine('thiendiepdt', deps);
    engine.start();
    await vi.waitFor(() => expect(engine!.getSnapshot().today.hoa).toBe(180));
    engine.stop();
    release();
    await settle();
    expect(commits).toHaveLength(0);
  });

  it('reports a sync error and keeps the written days', async () => {
    const { deps } = makeDeps({
      fetchPage: async () => {
        throw 'Phiên đăng nhập TTC của thiendiepdt đã hết hạn';
      },
      readMonth: async () => ({ '2026-11-03': { ...emptyDay(), hoa: 42, count: 1 } }),
    });
    engine = new RevenueEngine('thiendiepdt', deps);
    engine.start();
    await vi.waitFor(() => expect(engine!.getSnapshot().error).toMatch(/hết hạn/));
    expect(engine.getSnapshot().today.hoa).toBe(42);
  });
});
