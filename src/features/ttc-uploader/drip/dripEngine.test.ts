import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS } from '@/features/settings/types';
import type { UploadJobOutcome } from '@/shared/context/uploadQueueDefs';
import type { ParsedChapter, TtcChapter, UploadOptions } from '../types';
import { DripEngine, MAX_FAILURES, type DripDeps } from './dripEngine';

const MIN = 60_000;

const chapter = (index: number, title = `Chương ${index}`): ParsedChapter => ({
  index,
  title,
  content: '',
  word_count: 2000,
  file_name: '',
});

/** A fake TTC + folder + upload queue: uploads land on `ttc` when the job "finishes". */
function makeWorld() {
  let now = 1_000_000;
  const folders: Record<number, ParsedChapter[]> = {};
  const ttc: Record<number, TtcChapter[]> = {};
  const jobs: { id: string; options: UploadOptions; title: string }[] = [];
  let saved: string | null = null;
  let jobOutcome: (job: { options: UploadOptions }) => UploadJobOutcome = () => ({ status: 'done' });
  let busy = false;
  let fetchError: string | null = null;
  const scheduled: number[] = [];

  const apply = (options: UploadOptions) => {
    const list = [...(ttc[options.book_id] ?? [])];
    for (const c of options.chapters) {
      const row: TtcChapter = {
        chapterNumber: c.index,
        title: c.title,
        wordCount: c.word_count,
        views: 0,
        status: null,
        chapter_price: c.price ?? 0,
        last_chap_updated: null,
      };
      const at = list.findIndex(r => r.chapterNumber === c.index);
      if (at >= 0) list[at] = row;
      else list.push(row);
    }
    ttc[options.book_id] = list.sort((a, b) => a.chapterNumber - b.chapterNumber);
  };

  const deps: DripDeps = {
    now: () => now,
    load: () => saved,
    save: (json) => {
      saved = json;
    },
    folderOf: (bookId) => (folders[bookId] ? `/books/${bookId}` : ''),
    settingsFor: () => DEFAULT_SETTINGS,
    readFolder: async (path) => [{ name: '1.txt', text: path }],
    parseChapters: async (files) => folders[Number(files[0].text.split('/').pop())] ?? [],
    fetchRemote: async (bookId) => {
      if (fetchError) throw new Error(fetchError);
      return [...(ttc[bookId] ?? [])];
    },
    queueBusy: () => busy,
    enqueue: (options, title) => {
      const id = `job-${jobs.length + 1}`;
      jobs.push({ id, options, title });
      return id;
    },
    waitForJob: async (id) => {
      const job = jobs.find(j => j.id === id)!;
      const outcome = jobOutcome(job);
      if (outcome.status === 'done') apply(job.options);
      return outcome;
    },
    finishJob: vi.fn(),
    cancelJob: vi.fn(),
    notify: vi.fn(),
    schedule: (_fn, ms) => {
      scheduled.push(ms);
      return () => {};
    },
  };

  return {
    deps,
    scheduled,
    folders,
    ttc,
    jobs,
    advance: (ms: number) => {
      now += ms;
    },
    get saved() {
      return saved;
    },
    setOutcome: (fn: typeof jobOutcome) => {
      jobOutcome = fn;
    },
    setBusy: (v: boolean) => {
      busy = v;
    },
    setFetchError: (v: string | null) => {
      fetchError = v;
    },
  };
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => chapter(from + i));
const posted = (world: ReturnType<typeof makeWorld>) => world.jobs.map(j => [j.options.book_id, j.options.chapters[0].index, j.options.chapters.length]);

describe('DripEngine', () => {
  let world: ReturnType<typeof makeWorld>;
  let engine: DripEngine;

  beforeEach(() => {
    world = makeWorld();
    engine = new DripEngine(world.deps);
    engine.start();
  });

  it('uploads the initial batch at once, then one chapter per interval', async () => {
    world.folders[1] = range(1, 300);
    engine.setIntervalMinutes(5);
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 100 });

    await engine.tick();
    expect(posted(world)).toEqual([[1, 1, 100]]);
    expect(world.jobs[0].options.account).toBe('me');
    expect(world.jobs[0].title).toBe('A · đợt đầu chương 1–100');

    // Next step is a drip: it waits for the interval after the batch.
    await engine.tick();
    expect(world.jobs).toHaveLength(1);
    expect(engine.plan(1)?.priority).toBeUndefined();

    world.advance(5 * MIN);
    await engine.tick();
    expect(posted(world).at(-1)).toEqual([1, 101, 1]);

    world.advance(4 * MIN);
    await engine.tick();
    expect(world.jobs).toHaveLength(2);
    world.advance(1 * MIN);
    await engine.tick();
    expect(posted(world).at(-1)).toEqual([1, 102, 1]);
  });

  it('rotates between stories, the one posted longest ago first', async () => {
    world.folders[1] = range(1, 50);
    world.folders[2] = range(1, 50);
    world.folders[3] = range(1, 50);
    world.ttc[1] = range(1, 10).map(c => ({ chapterNumber: c.index, title: c.title, wordCount: 2000, views: 0, status: null, chapter_price: 0, last_chap_updated: null }));
    world.ttc[2] = [...world.ttc[1]];
    world.ttc[3] = [...world.ttc[1]];
    for (const id of [1, 2, 3]) {
      engine.startPlan({ bookId: id, bookTitle: `T${id}`, account: 'me', initialBatch: 0 });
    }
    await engine.tick(); // all three in drip phase: one posts, the others wait for their turn
    for (let i = 0; i < 5; i++) {
      world.advance(5 * MIN);
      await engine.tick();
    }
    expect(world.jobs.map(j => j.options.book_id)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(world.jobs.map(j => j.options.chapters[0].index)).toEqual([11, 11, 11, 12, 12, 12]);
  });

  it('does not spend a turn on a story whose folder has nothing new', async () => {
    world.folders[1] = range(1, 10);
    world.folders[2] = range(1, 20);
    world.ttc[1] = range(1, 10).map(c => ({ chapterNumber: c.index, title: c.title, wordCount: 2000, views: 0, status: null, chapter_price: 0, last_chap_updated: null }));
    world.ttc[2] = [...world.ttc[1]];
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 0 });
    engine.startPlan({ bookId: 2, bookTitle: 'B', account: 'me', initialBatch: 0 });

    await engine.tick();
    expect(posted(world)).toEqual([[2, 11, 1]]);
    expect(engine.plan(1)).toMatchObject({ caughtUp: true, status: 'running' });

    // New chapter in the folder: picked up once the re-check time has passed.
    world.folders[1] = range(1, 11);
    world.advance(31 * MIN);
    await engine.tick();
    expect(posted(world).at(-1)).toEqual([1, 11, 1]);
  });

  it('resyncs an edited chapter up to the last one on TTC before dripping on', async () => {
    world.folders[1] = range(1, 300);
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 200 });
    await engine.tick();
    expect(posted(world)).toEqual([[1, 1, 200]]);

    world.folders[1] = range(1, 300).map(c => (c.index === 101 ? chapter(101, 'Chương 101: sửa') : c));
    world.advance(5 * MIN);
    await engine.tick();
    expect(posted(world).at(-1)).toEqual([1, 101, 100]);

    // Bulk step done → right after, the drip continues from 201 on the next turn.
    world.advance(5 * MIN);
    await engine.tick();
    expect(posted(world).at(-1)).toEqual([1, 201, 1]);
  });

  it('continues after a restart from what TTC has, keeping the interval', async () => {
    world.folders[1] = range(1, 300);
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 100 });
    await engine.tick();
    engine.stop();

    const restarted = new DripEngine(world.deps);
    restarted.start();
    expect(restarted.plan(1)).toMatchObject({ status: 'running', initialBatch: 100 });
    world.advance(2 * MIN);
    await restarted.tick();
    expect(world.jobs).toHaveLength(1); // interval not over yet
    world.advance(3 * MIN);
    await restarted.tick();
    expect(posted(world).at(-1)).toEqual([1, 101, 1]);
  });

  it('waits while another upload is in the queue', async () => {
    world.folders[1] = range(1, 10);
    world.setBusy(true);
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 5 });
    await engine.tick();
    expect(world.jobs).toHaveLength(0);
    world.setBusy(false);
    await engine.tick();
    expect(world.jobs).toHaveLength(1);
  });

  it('pausing during an upload cancels it without counting a failure', async () => {
    world.folders[1] = range(1, 10);
    world.setOutcome(() => {
      engine.pause(1);
      return { status: 'error', error: 'Bị hủy bởi người dùng' };
    });
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 5 });
    await engine.tick();
    expect(world.deps.cancelJob).toHaveBeenCalledWith('job-1');
    expect(engine.plan(1)).toMatchObject({ status: 'paused' });
    expect(engine.plan(1)?.failures).toBeUndefined();

    world.setOutcome(() => ({ status: 'done' }));
    world.advance(10 * MIN);
    await engine.tick();
    expect(world.jobs).toHaveLength(1); // paused: nothing
    engine.resume(1);
    await engine.tick();
    expect(posted(world).at(-1)).toEqual([1, 1, 5]);
  });

  it(`stops a plan after ${MAX_FAILURES} failed uploads in a row and tells the user`, async () => {
    world.folders[1] = range(1, 10);
    world.setOutcome(() => ({ status: 'error', error: 'HTTP 500' }));
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 5 });
    for (let i = 0; i < MAX_FAILURES; i++) {
      await engine.tick();
      world.advance(6 * MIN);
    }
    expect(world.jobs).toHaveLength(MAX_FAILURES);
    expect(engine.plan(1)).toMatchObject({ status: 'error', lastError: 'HTTP 500' });
    expect(world.deps.notify).toHaveBeenCalledTimes(1);
  });

  it('retries later when TTC cannot be reached', async () => {
    world.folders[1] = range(1, 10);
    world.setFetchError('Request failed');
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 5 });
    await engine.tick();
    expect(engine.plan(1)).toMatchObject({ status: 'running', failures: 1 });
    expect(engine.plan(1)?.lastError).toContain('Request failed');

    world.setFetchError(null);
    await engine.tick();
    expect(world.jobs).toHaveLength(0); // waiting for the retry time
    world.advance(5 * MIN);
    await engine.tick();
    expect(world.jobs).toHaveLength(1);
    expect(engine.plan(1)?.lastError).toBeUndefined();
  });

  it('stops right away without a folder', async () => {
    engine.startPlan({ bookId: 9, bookTitle: 'X', account: 'me', initialBatch: 5 });
    await engine.tick();
    expect(engine.plan(9)).toMatchObject({ status: 'error', lastError: 'Chưa chọn folder cho truyện này' });
    expect(world.jobs).toHaveLength(0);
  });

  it('saves the plans and the interval', () => {
    engine.setIntervalMinutes(0.2);
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 150 });
    const saved = JSON.parse(world.saved!);
    expect(saved.intervalMinutes).toBe(0.5); // clamped to the minimum, 30 seconds
    expect(saved.plans[0]).toMatchObject({ bookId: 1, account: 'me', initialBatch: 150, status: 'running' });
  });
  it('keeps a history of uploads and the folder size', async () => {
    world.folders[1] = range(1, 300);
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 100 });
    await engine.tick();
    world.setOutcome(() => ({ status: 'error', error: 'HTTP 500' }));
    world.advance(5 * MIN);
    await engine.tick();

    const snap = engine.getSnapshot();
    expect(snap.history.map(h => [h.action, h.error])).toEqual([
      ['nhỏ giọt chương 101', 'HTTP 500'],
      ['đợt đầu chương 1–100', undefined],
    ]);
    expect(engine.plan(1)).toMatchObject({ localChapters: 300, ttcChapters: 100 });
    expect(JSON.parse(world.saved!).history).toHaveLength(2);
  });

  it('applies a new interval at once', async () => {
    world.folders[1] = range(1, 300);
    engine.setIntervalMinutes(10);
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 100 });
    await engine.tick();
    await engine.tick(); // drip step waits for the interval
    world.advance(2 * MIN);
    await engine.tick();
    expect(world.jobs).toHaveLength(1);

    world.scheduled.length = 0;
    engine.setIntervalMinutes(2);
    expect(world.scheduled).toEqual([0]); // looks again right away
    await engine.tick();
    expect(posted(world).at(-1)).toEqual([1, 101, 1]);
  });

  it('wakes up when the next turn is due instead of waiting a whole tick', async () => {
    world.folders[1] = range(1, 300);
    engine.setIntervalMinutes(0.5);
    engine.startPlan({ bookId: 1, bookTitle: 'A', account: 'me', initialBatch: 100 });
    await engine.tick(); // initial batch
    await engine.tick(); // drip waits
    world.advance(20_000);
    world.scheduled.length = 0;
    await engine.tick();
    expect(world.scheduled).toEqual([10_000]);
  });
});
