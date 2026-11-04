import { invoke } from '@tauri-apps/api/core';
import { addIncomes, EMPTY_SYNC, LEDGER_VERSION, type DayStats, type SyncState } from './ledger';
import type { NotificationEntry } from './parsePurchases';
import { monthOf, vnDayKey } from './vnTime';

/**
 * The ledger files of an account (Rust `ttc::revenue`): `sync` and one file per month.
 * Kept out of `user_data.json`, which is read whole at startup and rewritten on every
 * settings change.
 */

interface MonthFile {
  version: typeof LEDGER_VERSION;
  days: Record<string, DayStats>;
  /** Ids of the last commits added to this month (see `commitIncomes`). */
  applied?: string[];
}

/** Commits remembered per month: only the last one can ever be pending. */
const APPLIED_KEPT = 10;

async function readJson<T>(account: string, file: string): Promise<T | null> {
  const text = await invoke<string | null>('revenue_read', { account, file });
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    // A damaged file counts as empty: the days still on TTC are read again.
    return null;
  }
}

/** `sync.json`: the sync state, plus a commit whose incomes may not be in the month files yet. */
interface SyncFile extends SyncState {
  pending?: { id: string; incomes: NotificationEntry[] } | null;
}

const writeJson = (account: string, file: string, value: unknown) =>
  invoke<void>('revenue_write', { account, file, contents: JSON.stringify(value) });

async function readMonthFile(account: string, month: string): Promise<MonthFile> {
  const file = await readJson<MonthFile>(account, month);
  return file?.version === LEDGER_VERSION ? file : { version: LEDGER_VERSION, days: {} };
}

export async function readMonth(account: string, month: string): Promise<Record<string, DayStats>> {
  return (await readMonthFile(account, month)).days;
}

/** Add a commit to the month files it touches, skipping the months that already have it. */
async function applyCommit(account: string, id: string, incomes: NotificationEntry[]): Promise<string[]> {
  const byMonth = new Map<string, NotificationEntry[]>();
  for (const e of incomes) {
    const month = monthOf(vnDayKey(e.ts));
    byMonth.set(month, [...(byMonth.get(month) ?? []), e]);
  }
  for (const [month, entries] of byMonth) {
    const file = await readMonthFile(account, month);
    if (file.applied?.includes(id)) continue;
    addIncomes(file.days, entries);
    file.applied = [...(file.applied ?? []), id].slice(-APPLIED_KEPT);
    await writeJson(account, month, file);
  }
  return [...byMonth.keys()];
}

/**
 * The sync state of the account. A commit left half done (app closed while writing) is
 * finished first, so its incomes are counted exactly once.
 */
export async function readSync(account: string): Promise<SyncState> {
  const file = await readJson<SyncFile>(account, 'sync');
  if (file?.version !== LEDGER_VERSION) return { ...EMPTY_SYNC };
  const { pending, ...state } = file;
  if (pending) {
    await applyCommit(account, pending.id, pending.incomes);
    await writeJson(account, 'sync', state);
  }
  return state;
}

/**
 * Add the incomes of a walk and move the sync state on, exactly once even if the app
 * stops half way: the new state goes to `sync.json` together with the incomes first
 * (a journal), then into the month files, which remember the commit; then the journal
 * is cleared. Resolves with the months that changed.
 */
export async function commitIncomes(account: string, incomes: NotificationEntry[], state: SyncState): Promise<string[]> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await writeJson(account, 'sync', { ...state, pending: { id, incomes } } satisfies SyncFile);
  const months = await applyCommit(account, id, incomes);
  await writeJson(account, 'sync', state);
  return months;
}
