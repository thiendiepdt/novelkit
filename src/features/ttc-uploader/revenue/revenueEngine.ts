import { invoke } from '@tauri-apps/api/core';
import { addIncomes, emptyDay, type DayStats, type Span, type SyncState } from './ledger';
import { parsePurchasePage, type NotificationEntry } from './parsePurchases';
import { commitIncomes, readMonth, readSync } from './store';
import { walkPurchases } from './syncWalk';
import { addDays, monthOf, vnDayKey, vnDayStart } from './vnTime';

/** How often the open app looks for new purchases. */
export const POLL_MS = 2 * 60_000;
const PAGE_DELAY_MS = 300;

export interface RevenueSnapshot {
  account: string;
  /** The current Vietnam day. */
  todayKey: string;
  /** Today so far, including what the running sync has found but not written yet. */
  today: DayStats;
  /** Days of the loaded months (the current and the previous one), as written. */
  days: Record<string, DayStats>;
  covered: Span[];
  syncing: boolean;
  error: string | null;
  lastSyncAt: number | null;
}

export interface EngineDeps {
  fetchPage: (account: string, page: number) => Promise<string>;
  readSync: typeof readSync;
  readMonth: typeof readMonth;
  commitIncomes: typeof commitIncomes;
  now: () => number;
  delay: (ms: number) => Promise<void>;
}

const defaultDeps: EngineDeps = {
  fetchPage: (account, page) => invoke<string>('ttc_fetch_purchases', { account, page }),
  readSync,
  readMonth,
  commitIncomes,
  now: () => Date.now(),
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const errorMessage = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));

/**
 * The revenue of one account while the app runs: syncs on start, then every `POLL_MS`,
 * and rolls over at midnight (Vietnam time). A plain store for `useSyncExternalStore`;
 * `stop` (account switched, app closed) drops whatever a running sync has not written.
 */
export class RevenueEngine {
  private listeners = new Set<() => void>();
  private snap: RevenueSnapshot;
  private committed: Record<string, DayStats> = {};
  private live: NotificationEntry[] = [];
  private sync: SyncState | null = null;
  private loadedMonths = new Set<string>();
  /** Bumped by start/stop: work of an older generation stops and changes nothing. */
  private generation = 0;
  /** Generation of the sync in progress (a stopped one ends at its next page). */
  private runningGen: number | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly deps: EngineDeps;
  readonly account: string;

  constructor(account: string, deps: Partial<EngineDeps> = {}) {
    this.account = account;
    this.deps = { ...defaultDeps, ...deps };
    this.snap = {
      account,
      todayKey: vnDayKey(this.deps.now()),
      today: emptyDay(),
      days: {},
      covered: [],
      syncing: false,
      error: null,
      lastSyncAt: null,
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snap;

  start(): void {
    const gen = ++this.generation;
    void this.boot(gen);
  }

  stop(): void {
    this.generation++;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  /** Sync now (no-op while one is running). */
  refresh(): Promise<void> {
    return this.syncOnce(this.generation);
  }

  /** A day as written (today: with the purchases found by the running sync). */
  async loadDay(key: string): Promise<DayStats | null> {
    if (key === this.snap.todayKey) return this.snap.today;
    if (this.loadedMonths.has(monthOf(key))) return this.committed[key] ?? null;
    return (await this.deps.readMonth(this.account, monthOf(key)))[key] ?? null;
  }

  private alive = (gen: number) => gen === this.generation;

  private publish(patch: Partial<RevenueSnapshot>) {
    const todayKey = vnDayKey(this.deps.now());
    const days = { [todayKey]: structuredClone(this.committed[todayKey] ?? emptyDay()) };
    addIncomes(days, this.live.filter((e) => vnDayKey(e.ts) === todayKey));
    const today = days[todayKey];
    this.snap = { ...this.snap, ...patch, todayKey, today, days: this.committed };
    this.listeners.forEach((l) => l());
  }

  private async loadMonths(months: string[]) {
    for (const month of months) {
      const days = await this.deps.readMonth(this.account, month);
      this.committed = { ...this.committed, ...days };
      this.loadedMonths.add(month);
    }
  }

  private async boot(gen: number) {
    try {
      this.sync = await this.deps.readSync(this.account);
      const todayKey = vnDayKey(this.deps.now());
      await this.loadMonths([...new Set([monthOf(addDays(todayKey, -1)), monthOf(todayKey)])]);
      if (!this.alive(gen)) return;
      this.publish({ covered: this.sync.covered });
    } catch (e) {
      if (this.alive(gen)) this.publish({ error: errorMessage(e) });
      return;
    }
    await this.syncOnce(gen);
    if (!this.alive(gen)) return;
    this.schedulePoll(gen);
    this.scheduleMidnight(gen);
  }

  private schedulePoll(gen: number) {
    this.timers.push(
      setTimeout(async () => {
        await this.syncOnce(gen);
        if (this.alive(gen)) this.schedulePoll(gen);
      }, POLL_MS),
    );
  }

  /** At 00:00 the new day starts from zero (its month file is created by the first purchase). */
  private scheduleMidnight(gen: number) {
    const now = this.deps.now();
    const next = vnDayStart(addDays(vnDayKey(now), 1));
    this.timers.push(
      setTimeout(async () => {
        if (!this.alive(gen)) return;
        const month = monthOf(vnDayKey(this.deps.now()));
        if (!this.loadedMonths.has(month)) await this.loadMonths([month]);
        if (!this.alive(gen)) return;
        this.publish({});
        this.scheduleMidnight(gen);
      }, next - now + 1000),
    );
  }

  private async syncOnce(gen: number) {
    if (this.runningGen === gen || !this.sync || !this.alive(gen)) return;
    this.runningGen = gen;
    this.publish({ syncing: true });
    try {
      const result = await walkPurchases({
        fetchPage: async (page) => parsePurchasePage(await this.deps.fetchPage(this.account, page)),
        state: this.sync,
        now: this.deps.now,
        delay: () => this.deps.delay(PAGE_DELAY_MS),
        onProgress: (incomes) => {
          if (!this.alive(gen)) return;
          this.live = [...incomes];
          this.publish({});
        },
        isCancelled: () => !this.alive(gen),
      });
      if (!result || !this.alive(gen)) return;
      await this.deps.commitIncomes(this.account, result.incomes, result.state);
      this.sync = result.state;
      // Written: move the live purchases into the loaded days in the same step (no flicker).
      const loaded = result.incomes.filter((e) => this.loadedMonths.has(monthOf(vnDayKey(e.ts))));
      const touched = new Set(loaded.map((e) => vnDayKey(e.ts)));
      const next = { ...this.committed };
      for (const key of touched) next[key] = structuredClone(next[key] ?? emptyDay());
      addIncomes(next, loaded);
      this.committed = next;
      this.live = [];
      if (this.alive(gen)) this.publish({ covered: result.state.covered, lastSyncAt: this.deps.now(), error: null });
    } catch (e) {
      this.live = [];
      if (this.alive(gen)) this.publish({ error: errorMessage(e) });
    } finally {
      if (this.runningGen === gen) this.runningGen = null;
      if (this.alive(gen)) this.publish({ syncing: false });
    }
  }
}
