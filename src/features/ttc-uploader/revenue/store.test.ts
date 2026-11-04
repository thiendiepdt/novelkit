import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commitIncomes, readMonth, readSync } from './store';
import type { NotificationEntry } from './parsePurchases';
import { LEDGER_VERSION, type SyncState } from './ledger';

/** The ledger files of the Rust side, in memory; `failOnWrite` simulates the app stopping. */
const files = new Map<string, string>();
let writes = 0;
let failOnWrite: number | null = null;
const invokeMock = vi.fn(async (cmd: string, args: { account: string; file: string; contents?: string }) => {
  const key = `${args.account}/${args.file}`;
  if (cmd === 'revenue_read') return files.get(key) ?? null;
  if (cmd === 'revenue_write') {
    writes++;
    if (failOnWrite !== null && writes === failOnWrite) throw new Error('app closed');
    files.set(key, args.contents!);
    return null;
  }
  throw new Error(`unexpected invoke ${cmd}`);
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: (cmd: string, args: never) => invokeMock(cmd, args) }));

const ts = Date.parse('2026-11-03T05:00:00Z'); // 12:00 VN
const buy = (n: number): NotificationEntry => ({
  id: `${ts + n}_${n}`,
  ts: ts + n,
  income: { hoa: 90, storyId: '1', title: 'Truyện', chapter: n, kind: 'single' },
});
const state: SyncState = { version: LEDGER_VERSION, covered: [{ from: ts - 1000, to: ts + 1000 }], newest: ts + 2, recentIds: [] };

describe('commitIncomes', () => {
  beforeEach(() => {
    files.clear();
    writes = 0;
    failOnWrite = null;
  });

  it('adds the incomes to their month and stores the new sync state', async () => {
    await commitIncomes('u', [buy(1), buy(2)], state);
    expect((await readMonth('u', '2026-11'))['2026-11-03']).toMatchObject({ hoa: 180, count: 2 });
    expect(await readSync('u')).toEqual(state);
  });

  it('starts over from files of an older version (rebuilt from TTC)', async () => {
    files.set('u/sync', JSON.stringify({ version: 1, covered: [{ from: 1, to: 2 }], newest: 2, recentIds: [] }));
    files.set('u/2026-11', JSON.stringify({ version: 1, days: { '2026-11-03': { hoa: 999 } } }));
    expect((await readSync('u')).covered).toEqual([]);
    expect(await readMonth('u', '2026-11')).toEqual({});

    await commitIncomes('u', [buy(1)], state);
    expect((await readMonth('u', '2026-11'))['2026-11-03'].hoa).toBe(90);
  });

  it('finishes a commit cut short after the journal, counting it once', async () => {
    failOnWrite = 2; // the month file write fails: only the journal is on disk
    await expect(commitIncomes('u', [buy(1)], state)).rejects.toThrow('app closed');
    failOnWrite = null;

    expect(await readSync('u')).toEqual(state);
    expect((await readMonth('u', '2026-11'))['2026-11-03'].hoa).toBe(90);
    // Reading again does not add it a second time.
    await readSync('u');
    expect((await readMonth('u', '2026-11'))['2026-11-03'].hoa).toBe(90);
  });

  it('does not add twice a commit that reached the month file but not the final sync write', async () => {
    failOnWrite = 3; // journal and month written, clearing the journal fails
    await expect(commitIncomes('u', [buy(1)], state)).rejects.toThrow('app closed');
    failOnWrite = null;

    expect(await readSync('u')).toEqual(state);
    expect((await readMonth('u', '2026-11'))['2026-11-03'].hoa).toBe(90);
  });
});
