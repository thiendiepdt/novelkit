import type { NotificationEntry } from './parsePurchases';
import { DAY_MS, vnDayKey, vnDayStart, vnHour } from './vnTime';

/**
 * The revenue ledger: daily totals (never the single purchases) and the spans of time
 * whose purchases are all counted. A day is complete when one span covers all of it.
 */

/**
 * Files of another version are ignored and rebuilt from TTC.
 * 2: bulk sales and gifts are counted (version 1 only knew single-chapter sales).
 * 3: days keep the totals of bulk sales and gifts apart.
 */
export const LEDGER_VERSION = 3;

export interface Tally {
  count: number;
  hoa: number;
}

export interface StoryStats {
  title: string;
  hoa: number;
  count: number;
}

export interface DayStats {
  /** Everything received: sales and gifts. */
  hoa: number;
  /** Sales (single and bulk); a gift is not a sale. */
  count: number;
  /** Part of the above: bulk sales ("combo"). */
  bulk: Tally;
  /** Part of `hoa`: gifts. */
  gifts: Tally;
  /** Hoa per hour of the day (Vietnam time), 24 entries. */
  hours: number[];
  /** By story id. */
  stories: Record<string, StoryStats>;
}

/** [from, to] in epoch ms: every purchase made in between is counted. */
export interface Span {
  from: number;
  to: number;
}

export interface SyncState {
  version: typeof LEDGER_VERSION;
  /** Sorted, non-overlapping. */
  covered: Span[];
  /** Creation time of the newest notification ever seen. */
  newest: number | null;
  /** Ids counted near the edge of the last span, so the overlap of the next sync is not counted twice. */
  recentIds: string[];
}

export const EMPTY_SYNC: SyncState = { version: LEDGER_VERSION, covered: [], newest: null, recentIds: [] };

export const emptyDay = (): DayStats => ({
  hoa: 0,
  count: 0,
  bulk: { count: 0, hoa: 0 },
  gifts: { count: 0, hoa: 0 },
  hours: Array(24).fill(0),
  stories: {},
});

/** Add the income entries to their days (in place), creating the days as needed. */
export function addIncomes(days: Record<string, DayStats>, entries: NotificationEntry[]): void {
  for (const e of entries) {
    if (!e.income) continue;
    const day = (days[vnDayKey(e.ts)] ??= emptyDay());
    const { kind, hoa } = e.income;
    const purchases = kind === 'gift' ? 0 : 1;
    day.hoa += hoa;
    day.count += purchases;
    const tally = kind === 'bulk' ? day.bulk : kind === 'gift' ? day.gifts : null;
    if (tally) {
      tally.count += 1;
      tally.hoa += hoa;
    }
    day.hours[vnHour(e.ts)] += e.income.hoa;
    const story = (day.stories[e.income.storyId] ??= { title: e.income.title, hoa: 0, count: 0 });
    story.title = e.income.title || story.title;
    story.hoa += e.income.hoa;
    story.count += purchases;
  }
}

/** `covered` with `span` added, overlapping or touching spans merged. */
export function mergeSpan(covered: Span[], span: Span): Span[] {
  const all = [...covered, span].sort((a, b) => a.from - b.from);
  const out: Span[] = [];
  for (const s of all) {
    const last = out[out.length - 1];
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else out.push({ ...s });
  }
  return out;
}

/** Parts of [from, to] that no span covers. */
export function missingSpans(covered: Span[], from: number, to: number): Span[] {
  const out: Span[] = [];
  let cursor = from;
  for (const s of covered) {
    if (s.to <= cursor) continue;
    if (s.from >= to) break;
    if (s.from > cursor) out.push({ from: cursor, to: s.from });
    cursor = Math.max(cursor, s.to);
    if (cursor >= to) break;
  }
  if (cursor < to) out.push({ from: cursor, to });
  return out;
}

export interface DayCoverage {
  /** Uncounted parts of the day, up to its end (the current day: up to the last sync). */
  missing: Span[];
  /** Nothing of the day is counted. */
  nothing: boolean;
}

/**
 * How much of the day `key` is counted. `current`: the day is still running, so only the
 * part up to the last sync is checked; a past day is checked to its end.
 */
export function dayCoverage(covered: Span[], key: string, current = false): DayCoverage {
  const start = vnDayStart(key);
  const lastSync = covered.length ? covered[covered.length - 1].to : start;
  const end = current ? Math.min(start + DAY_MS, lastSync) : start + DAY_MS;
  if (end <= start) return { missing: [{ from: start, to: start + DAY_MS }], nothing: true };
  const missing = missingSpans(covered, start, end);
  const missingMs = missing.reduce((sum, s) => sum + s.to - s.from, 0);
  return { missing, nothing: missingMs >= end - start };
}
