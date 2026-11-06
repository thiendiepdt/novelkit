import type { ChapterFile } from '@/features/chapter-splitter/utils/splitter';
import type { AppSettings } from '@/features/settings/types';
import type { UploadJobOutcome } from '@/shared/context/uploadQueueDefs';
import type { ParsedChapter, TtcChapter, UploadOptions } from '../types';
import { applyChapterPrices, parseOptionsFromSettings, type LocalParseOptions } from '../utils/localChapters';
import { decideDripStep, stepLabel, type DripStep } from './steps';

export const DRIP_STORE_KEY = 'nk_ttc_drip';
export const DEFAULT_INTERVAL_MINUTES = 5;
/** 30 seconds; the interval is kept to tenths of a minute. */
export const MIN_INTERVAL_MINUTES = 0.5;
export const MAX_INTERVAL_MINUTES = 24 * 60;
export const DEFAULT_INITIAL_BATCH = 100;
/** Longest wait between two looks; the scheduler wakes earlier when a turn is due sooner. */
export const TICK_MS = 15_000;
/** Shortest wait between two looks. */
const MIN_TICK_MS = 1_000;
/** Entries kept in the upload history. */
export const HISTORY_LIMIT = 100;
/** A story whose folder has nothing new is looked at again after this. */
export const CAUGHT_UP_RECHECK_MS = 30 * 60_000;
/** After a failed turn (network, TTC refused) the story waits this long. */
export const RETRY_MS = 5 * 60_000;
/** Failed turns in a row after which a plan stops and waits for the user. */
export const MAX_FAILURES = 3;

const MINUTE_MS = 60_000;

export type DripStatus = 'running' | 'paused' | 'error';

/** "Nổi trên bảng cập nhật" for one story: what the user chose and where it stands. */
export interface DripPlan {
  bookId: number;
  bookTitle: string;
  /** The TTC account the story belongs to; its uploads always run on it. */
  account: string;
  /** Chapters uploaded at once before dripping (TTC numbering); 0 = drip from the start. */
  initialBatch: number;
  status: DripStatus;
  createdAt: number;
  /**
   * Started, resumed or in the middle of bulk steps (resync, initial batch): looked at
   * right away instead of waiting for its turn in the rotation.
   */
  priority?: boolean;
  /** When an upload of this plan last went through: the rotation serves the oldest first. */
  lastPostAt?: number;
  /** What that upload was, e.g. "nhỏ giọt chương 205". */
  lastAction?: string;
  lastError?: string;
  /** Failed turns in a row. */
  failures?: number;
  /** Not looked at before this time (nothing new in the folder, or after a failure). */
  idleUntil?: number;
  /** The folder had nothing TTC lacks at the last look. */
  caughtUp?: boolean;
  /** Last chapter number seen on TTC. */
  ttcChapters?: number;
  /** Last chapter number of the folder (TTC numbering), at the last look. */
  localChapters?: number;
}

/** One upload of a plan, for the history list. */
export interface DripHistoryEntry {
  at: number;
  bookId: number;
  bookTitle: string;
  /** e.g. "nhỏ giọt chương 205" */
  action: string;
  /** Present when the upload failed. */
  error?: string;
}

export interface DripState {
  intervalMinutes: number;
  /** End of the last upload turn of any plan: the next rotation turn waits an interval after it. */
  lastTurnAt: number;
  plans: DripPlan[];
  /** Latest first, at most HISTORY_LIMIT. */
  history: DripHistoryEntry[];
}

export interface DripActivity {
  bookId: number;
  text: string;
}

export interface DripSnapshot extends DripState {
  /** When the rotation may post again. */
  nextPostAt: number;
  /** What the scheduler is doing right now, for the UI. */
  activity: DripActivity | null;
}

export interface DripDeps {
  now: () => number;
  load: () => string | null;
  save: (json: string) => void;
  /** Folder picked for this very story; '' when none. */
  folderOf: (bookId: number) => string;
  settingsFor: (bookId: number) => AppSettings;
  readFolder: (folderPath: string) => Promise<ChapterFile[]>;
  parseChapters: (files: ChapterFile[], opts: LocalParseOptions) => Promise<ParsedChapter[]>;
  fetchRemote: (bookId: number, account: string) => Promise<TtcChapter[]>;
  /** Another upload is queued or running: the scheduler waits for it. */
  queueBusy: () => boolean;
  /** Queue an upload (silently) and return its job id. */
  enqueue: (options: UploadOptions, title: string) => string;
  waitForJob: (jobId: string) => Promise<UploadJobOutcome>;
  /** Drop a finished job from the queue list (one every few minutes would pile up). */
  finishJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  notify: (title: string, body: string) => void;
  /** setTimeout that returns its own cancel. */
  schedule: (fn: () => void, ms: number) => () => void;
}

export function clampInterval(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_INTERVAL_MINUTES;
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(minutes * 10) / 10));
}

export function clampInitialBatch(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_INITIAL_BATCH;
  return Math.max(0, Math.round(count));
}

const errorMessage = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));

function isPlan(value: unknown): value is DripPlan {
  const p = value as DripPlan;
  return !!p && typeof p.bookId === 'number' && typeof p.account === 'string' && typeof p.bookTitle === 'string';
}

export function loadDripState(raw: string | null): DripState {
  const empty: DripState = { intervalMinutes: DEFAULT_INTERVAL_MINUTES, lastTurnAt: 0, plans: [], history: [] };
  if (!raw) return empty;
  try {
    const value = JSON.parse(raw) as Partial<DripState>;
    return {
      intervalMinutes: clampInterval(Number(value.intervalMinutes ?? DEFAULT_INTERVAL_MINUTES)),
      lastTurnAt: Number(value.lastTurnAt) || 0,
      plans: Array.isArray(value.plans) ? value.plans.filter(isPlan) : [],
      history: Array.isArray(value.history) ? value.history.slice(0, HISTORY_LIMIT) : [],
    };
  } catch {
    return empty;
  }
}

type Evaluation =
  | { fatal: string }
  | { transient: string }
  | { step: DripStep; settings: AppSettings; localLast: number };

/**
 * The drip scheduler: at most every `TICK_MS` it looks whether a plan is due and uploads at most one
 * step, through the upload queue so it never runs next to another upload. Started plans and
 * bulk steps go first; then, once an interval has passed since the last upload, the running
 * plan posted longest ago drips its next chapter (plans with nothing new are skipped without
 * using the turn). Every step is decided from the folder and TTC at that moment (`steps.ts`).
 *
 * A plain store for `useSyncExternalStore`; the plans are saved on every change.
 */
export class DripEngine {
  private state: DripState;
  private activity: DripActivity | null = null;
  private snap: DripSnapshot;
  private listeners = new Set<() => void>();
  private started = false;
  private busy = false;
  /** A plan was started or resumed during a turn: look again right after it. */
  private kickPending = false;
  private cancelTimer: (() => void) | null = null;
  /** Upload of the turn in progress, so pausing or removing its plan can cancel it. */
  private currentJob: { bookId: number; jobId: string } | null = null;

  private deps: DripDeps;

  constructor(deps: DripDeps) {
    this.deps = deps;
    this.state = loadDripState(deps.load());
    this.snap = this.makeSnapshot();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snap;

  plan(bookId: number): DripPlan | undefined {
    return this.state.plans.find(p => p.bookId === bookId);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTick(0);
  }

  stop() {
    this.started = false;
    this.cancelTimer?.();
    this.cancelTimer = null;
  }

  // ─── Plan commands ───────────────────────────────────────

  startPlan(input: { bookId: number; bookTitle: string; account: string; initialBatch: number }) {
    const existing = this.plan(input.bookId);
    const plan: DripPlan = {
      bookId: input.bookId,
      bookTitle: input.bookTitle,
      account: input.account,
      initialBatch: clampInitialBatch(input.initialBatch),
      status: 'running',
      priority: true,
      createdAt: this.deps.now(),
      lastPostAt: existing?.lastPostAt,
    };
    this.state = {
      ...this.state,
      plans: existing ? this.state.plans.map(p => (p.bookId === plan.bookId ? plan : p)) : [...this.state.plans, plan],
    };
    this.emit();
    this.kick();
  }

  setInitialBatch(bookId: number, initialBatch: number) {
    const plan = this.plan(bookId);
    if (!plan) return;
    this.update(bookId, { initialBatch: clampInitialBatch(initialBatch), priority: plan.status === 'running' || undefined });
    this.emit();
    this.kick();
  }

  pause(bookId: number) {
    if (!this.plan(bookId)) return;
    this.update(bookId, { status: 'paused', priority: undefined });
    this.emit();
    this.cancelCurrent(bookId);
  }

  resume(bookId: number) {
    if (!this.plan(bookId)) return;
    this.update(bookId, this.resumePatch());
    this.emit();
    this.kick();
  }

  remove(bookId: number) {
    if (!this.plan(bookId)) return;
    this.state = { ...this.state, plans: this.state.plans.filter(p => p.bookId !== bookId) };
    this.emit();
    this.cancelCurrent(bookId);
  }

  pauseAll() {
    this.state = {
      ...this.state,
      plans: this.state.plans.map(p => (p.status === 'running' ? { ...p, status: 'paused' as const, priority: undefined } : p)),
    };
    this.emit();
    if (this.currentJob) this.cancelCurrent(this.currentJob.bookId);
  }

  resumeAll() {
    this.state = {
      ...this.state,
      plans: this.state.plans.map(p => (p.status === 'running' ? p : { ...p, ...this.resumePatch() })),
    };
    this.emit();
    this.kick();
  }

  /** Applies at once: the next turn is recomputed from the last upload with the new interval. */
  setIntervalMinutes(minutes: number) {
    this.state = { ...this.state, intervalMinutes: clampInterval(minutes) };
    this.emit();
    this.kick();
  }

  // ─── Scheduler ───────────────────────────────────────────

  /** One look at the plans; public for tests (the app runs it from the timer). */
  async tick(): Promise<void> {
    if (!this.started) return;
    if (this.busy) {
      this.kickPending = true;
      return;
    }
    this.busy = true;
    this.kickPending = false;
    try {
      await this.turn();
    } catch (e) {
      console.error('Drip turn failed:', e);
    } finally {
      this.busy = false;
      this.setActivity(null);
      if (this.started) this.scheduleTick(this.kickPending ? 0 : this.nextLookIn());
    }
  }

  private async turn() {
    // One upload at a time, whoever queued it: TTC rate-limits bursts.
    if (this.deps.queueBusy()) return;
    const now = this.deps.now();
    const due = now >= this.nextPostAt();
    const ready = this.state.plans.filter(p => p.status === 'running' && !(p.idleUntil && p.idleUntil > now));
    const urgent = ready.filter(p => p.priority).sort((a, b) => a.createdAt - b.createdAt);
    const rotation = due
      ? ready
          .filter(p => !p.priority)
          .sort((a, b) => (a.lastPostAt ?? 0) - (b.lastPostAt ?? 0) || a.createdAt - b.createdAt)
      : [];

    for (const plan of [...urgent, ...rotation]) {
      const uploaded = await this.runPlan(plan.bookId, due);
      if (uploaded || !this.started || this.deps.queueBusy()) return;
    }
  }

  /** Look at one plan and upload its next step if it has one; true when an upload was attempted. */
  private async runPlan(bookId: number, due: boolean): Promise<boolean> {
    const plan = this.plan(bookId);
    if (!plan || plan.status !== 'running') return false;

    this.setActivity({ bookId, text: `Đang kiểm tra “${plan.bookTitle}”` });
    const evaluation = await this.evaluate(plan);
    // Paused or removed while the folder and TTC were read.
    if (this.plan(bookId)?.status !== 'running') return false;
    const now = this.deps.now();

    if ('fatal' in evaluation) {
      this.update(bookId, { status: 'error', priority: undefined, lastError: evaluation.fatal });
      this.emit();
      this.deps.notify('Nổi bảng đã dừng', `“${plan.bookTitle}”: ${evaluation.fatal}`);
      return false;
    }
    if ('transient' in evaluation) {
      this.fail(bookId, evaluation.transient);
      return false;
    }

    const { step, settings, localLast } = evaluation;
    this.update(bookId, { localChapters: localLast });
    if (step.kind === 'caught-up') {
      this.update(bookId, {
        caughtUp: true,
        priority: undefined,
        idleUntil: now + CAUGHT_UP_RECHECK_MS,
        failures: 0,
        lastError: undefined,
        ttcChapters: step.lastOnTtc,
      });
      this.emit();
      return false;
    }
    if (step.kind === 'drip' && !due) {
      // Bulk steps are done: from now on it waits for its turn in the rotation.
      this.update(bookId, { priority: undefined, caughtUp: false, ttcChapters: step.from - 1 });
      this.emit();
      return false;
    }

    const label = stepLabel(step);
    const { chapterPrice, vipFromChapter, vipMinWords, uploadDelayMs, unlockTimer } = settings.ttcUploader;
    const options: UploadOptions = {
      account: plan.account,
      book_id: bookId,
      chapters: applyChapterPrices(step.chapters, { chapterPrice, vipFromChapter, vipMinWords }),
      delay_ms: uploadDelayMs,
      price: chapterPrice,
      unlock_timer: unlockTimer || undefined,
    };
    const jobId = this.deps.enqueue(options, `${plan.bookTitle} · ${label}`);
    this.currentJob = { bookId, jobId };
    this.setActivity({ bookId, text: `Đang đăng ${label} · “${plan.bookTitle}”` });
    const outcome = await this.deps.waitForJob(jobId);
    this.currentJob = null;

    const finishedAt = this.deps.now();
    this.state = { ...this.state, lastTurnAt: finishedAt };
    const after = this.plan(bookId);
    if (outcome.status === 'done') {
      this.deps.finishJob(jobId);
      this.record({ at: finishedAt, bookId, bookTitle: plan.bookTitle, action: label });
      if (after) {
        this.update(bookId, {
          lastPostAt: finishedAt,
          lastAction: label,
          failures: 0,
          lastError: undefined,
          caughtUp: false,
          idleUntil: undefined,
          // After a bulk step, look again right away: more bulk, or the drip turn order.
          priority: after.status === 'running' && step.kind !== 'drip' ? true : undefined,
          ttcChapters: Math.max(after.ttcChapters ?? 0, step.to),
        });
      }
      this.emit();
      return true;
    }
    if (after?.status === 'running') {
      this.record({ at: finishedAt, bookId, bookTitle: plan.bookTitle, action: label, error: outcome.error });
      this.fail(bookId, outcome.error);
    } else {
      // Cancelled because the plan was paused or removed: not a failure.
      this.emit();
    }
    return true;
  }

  private async evaluate(plan: DripPlan): Promise<Evaluation> {
    const folderPath = this.deps.folderOf(plan.bookId);
    if (!folderPath) return { fatal: 'Chưa chọn folder cho truyện này' };

    let files: ChapterFile[];
    try {
      files = await this.deps.readFolder(folderPath);
    } catch (e) {
      return { fatal: `Không đọc được folder: ${errorMessage(e)}` };
    }
    if (files.length === 0) return { fatal: 'Folder không có file .txt' };

    const settings = this.deps.settingsFor(plan.bookId);
    let local: ParsedChapter[];
    try {
      local = await this.deps.parseChapters(files, parseOptionsFromSettings(settings));
    } catch (e) {
      return { fatal: `Lỗi tách chương: ${errorMessage(e)}` };
    }
    if (local.length === 0) return { fatal: 'Không tách được chương nào từ folder' };

    let remote: TtcChapter[];
    try {
      remote = await this.deps.fetchRemote(plan.bookId, plan.account);
    } catch (e) {
      return { transient: `Không tải được danh sách chương trên TTC: ${errorMessage(e)}` };
    }

    return { step: decideDripStep(local, remote, plan.initialBatch), settings, localLast: local[local.length - 1].index };
  }

  private fail(bookId: number, message: string) {
    const plan = this.plan(bookId);
    if (!plan) return;
    const failures = (plan.failures ?? 0) + 1;
    if (failures >= MAX_FAILURES) {
      this.update(bookId, { status: 'error', priority: undefined, failures, lastError: message });
      this.deps.notify('Nổi bảng đã dừng', `“${plan.bookTitle}” lỗi ${failures} lần liên tiếp: ${message}`);
    } else {
      this.update(bookId, { failures, lastError: message, idleUntil: this.deps.now() + RETRY_MS });
    }
    this.emit();
  }

  // ─── Helpers ─────────────────────────────────────────────

  private nextPostAt() {
    return this.state.lastTurnAt + this.state.intervalMinutes * MINUTE_MS;
  }

  /** Wait until the next look: when the rotation or a waiting plan is due, at most TICK_MS. */
  private nextLookIn() {
    const now = this.deps.now();
    let wake = now + TICK_MS;
    const running = this.state.plans.filter(p => p.status === 'running');
    if (running.some(p => !p.priority)) wake = Math.min(wake, this.nextPostAt());
    for (const p of running) if (p.idleUntil) wake = Math.min(wake, p.idleUntil);
    return Math.min(TICK_MS, Math.max(MIN_TICK_MS, wake - now));
  }

  private record(entry: DripHistoryEntry) {
    this.state = { ...this.state, history: [entry, ...this.state.history].slice(0, HISTORY_LIMIT) };
  }

  private resumePatch(): Partial<DripPlan> {
    return { status: 'running', priority: true, failures: 0, lastError: undefined, idleUntil: undefined };
  }

  private cancelCurrent(bookId: number) {
    if (this.currentJob?.bookId === bookId) this.deps.cancelJob(this.currentJob.jobId);
  }

  private update(bookId: number, patch: Partial<DripPlan>) {
    this.state = {
      ...this.state,
      plans: this.state.plans.map(p => (p.bookId === bookId ? { ...p, ...patch } : p)),
    };
  }

  private kick() {
    if (!this.started) return;
    if (this.busy) this.kickPending = true;
    else this.scheduleTick(0);
  }

  private scheduleTick(ms: number) {
    this.cancelTimer?.();
    this.cancelTimer = this.deps.schedule(() => {
      this.cancelTimer = null;
      void this.tick();
    }, ms);
  }

  private setActivity(activity: DripActivity | null) {
    if (this.activity === activity) return;
    this.activity = activity;
    this.snap = this.makeSnapshot();
    this.listeners.forEach(l => l());
  }

  private emit() {
    this.deps.save(JSON.stringify(this.state));
    this.snap = this.makeSnapshot();
    this.listeners.forEach(l => l());
  }

  private makeSnapshot(): DripSnapshot {
    return { ...this.state, nextPostAt: this.nextPostAt(), activity: this.activity };
  }
}
