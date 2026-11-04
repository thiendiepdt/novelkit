import { LEDGER_VERSION, mergeSpan, type Span, type SyncState } from './ledger';
import type { NotificationEntry, PurchasePage } from './parsePurchases';

/**
 * How far below the edge of the last sync a new sync still reads. Notifications are not
 * always listed in the exact order of their timestamps, and the clock of this computer
 * may differ a little from TTC's: entries in the overlap are counted unless already counted.
 */
export const OVERLAP_MS = 10 * 60_000;

export interface WalkOptions {
  fetchPage: (page: number) => Promise<PurchasePage>;
  state: SyncState;
  now: () => number;
  /** Pause between pages, so TTC is not hit with a burst. */
  delay: () => Promise<void>;
  /** After each page: the income entries found so far in this walk (not counted before). */
  onProgress?: (incomes: NotificationEntry[]) => void;
  isCancelled?: () => boolean;
}

export interface WalkResult {
  /** Income entries to add to the ledger. */
  incomes: NotificationEntry[];
  /** The sync state once they are added. */
  state: SyncState;
  /** False when the list ended before the last sync: the time in between is lost. */
  connected: boolean;
}

/** Creation time embedded in a notification id. */
const idTime = (id: string) => Number(id.split('_')[0]);

/**
 * Read the purchase notifications from the newest back to the last sync (all of them on
 * the first run) and return what is new. Nothing is written: the caller adds the result
 * to the ledger in one step, so a walk cut short (app closed) is simply done again.
 * Resolves with null when cancelled.
 */
export async function walkPurchases({ fetchPage, state, now, delay, onProgress, isCancelled }: WalkOptions): Promise<WalkResult | null> {
  const startedAt = now();
  const last = state.covered[state.covered.length - 1];
  // A quiet night must not move the edge past what TTC has listed (clock differences):
  // the walk always goes back to the newest notification it has seen, minus the overlap.
  const edge = last ? Math.min(last.to, state.newest ?? last.to) : null;
  const stopBelow = edge === null ? null : edge - OVERLAP_MS;
  const known = new Set(state.recentIds);

  const seen = new Set<string>();
  const incomes: NotificationEntry[] = [];
  let oldest = Infinity;
  let newest = state.newest ?? -Infinity;
  let reached = false;

  for (let page = 1; ; page++) {
    if (isCancelled?.()) return null;
    const { entries, lastPage } = await fetchPage(page);
    if (isCancelled?.()) return null;
    let fresh = 0;
    for (const e of entries) {
      // New notifications push the older ones down while we read: the same entry can show up twice.
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      fresh++;
      oldest = Math.min(oldest, e.ts);
      newest = Math.max(newest, e.ts);
      if (stopBelow !== null && e.ts < stopBelow) {
        reached = true;
        continue;
      }
      if (e.income && !known.has(e.id)) incomes.push(e);
    }
    onProgress?.(incomes);
    // A page with nothing new is past the end (a page number beyond the last may repeat it).
    if (reached || fresh === 0 || lastPage === null || page >= lastPage) break;
    await delay();
  }

  const connected = edge === null || reached;
  const from = connected && last ? last.from : Math.min(oldest, startedAt);
  const span: Span = { from, to: Math.max(startedAt, last?.to ?? startedAt) };
  const newestSeen = Number.isFinite(newest) ? newest : null;
  const nextEdge = Math.min(span.to, newestSeen ?? span.to) - OVERLAP_MS;
  const recentIds = [...new Set([...state.recentIds, ...incomes.map((e) => e.id)])].filter((id) => idTime(id) >= nextEdge);

  return {
    incomes,
    state: { version: LEDGER_VERSION, covered: mergeSpan(state.covered, span), newest: newestSeen, recentIds },
    connected,
  };
}
