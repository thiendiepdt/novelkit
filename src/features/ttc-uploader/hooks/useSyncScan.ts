import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsContext } from '@/features/settings/context/SettingsContext';
import { useUploadQueueContext } from '@/shared/context/UploadQueueContext';
import type { ChapterFile } from '@/features/chapter-splitter/utils/splitter';
import type { ParsedChapter, TtcStory, UploadOptions } from '../types';
import { applyChapterPrices, parseOptionsFromSettings } from '../utils/localChapters';
import { createChapterParser, type ChapterParser } from '../utils/chapterParser';
import { compareChapters, planSync } from '../utils/syncCompare';
import { fetchAllBooks, fetchAllChapters } from '../utils/ttcLists';
import { useDrip } from '../drip';

/** Every status a story can have in the list: a sync applies to all of them. */
const ALL_STATUSES = 'ongoing,full,paused';

export type SyncRowState =
  | { kind: 'waiting' }
  | { kind: 'checking' }
  | { kind: 'invalid'; reason: string }
  /** Nothing to upload. `remoteExtra`: TTC chapters beyond the end of the folder. */
  | { kind: 'synced'; localCount: number; remoteExtra: number }
  /** Only new chapters: uploading them appends to TTC. */
  | { kind: 'new'; options: UploadOptions; from: number; to: number }
  /**
   * A chapter already on TTC differs from the folder: uploading overwrites from `fromIndex` to
   * the end of the folder. `firstDiff` names the first difference so the user can judge it.
   */
  | {
      kind: 'changed';
      options: UploadOptions;
      fromIndex: number;
      toIndex: number;
      newCount: number;
      firstDiff: { local: string; remote: string };
    };

export interface SyncRow {
  book: TtcStory;
  state: SyncRowState;
}

/** Rust commands reject with a bare string, JS code with an Error: show either. */
function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

/** Label of the queued job, as the upload queue lists it. */
export function syncJobTitle(row: SyncRow): string {
  const { state } = row;
  if (state.kind === 'new') {
    const count = state.options.chapters.length;
    return `${row.book.title} · ${count} chương mới`;
  }
  if (state.kind === 'changed') return `${row.book.title} · ghi đè chương ${state.fromIndex}–${state.toIndex}`;
  return row.book.title;
}

/**
 * "Quét chương mới": for every story with a folder, compares the folder with the chapter list
 * of TTC (the same comparison as the "So sánh & Upload" tab) and queues the uploads that bring
 * TTC up to date, one job per story.
 *
 * @param account - username of the active TTC account: the queued uploads run on it even if
 *   the user switches accounts before they start.
 */
export function useSyncScan(account?: string | null) {
  const { getSettingsForBook, bookSettings } = useSettingsContext();
  const { addJob } = useUploadQueueContext();
  const { snapshot: drip } = useDrip();
  // Stories dripping to stay on the update board: uploading their new chapters at once would end that.
  const dripRef = useRef(drip);
  useEffect(() => {
    dripRef.current = drip;
  }, [drip]);

  const [rows, setRows] = useState<SyncRow[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [checkedCount, setCheckedCount] = useState(0);
  /** Stories skipped because no folder was picked for them. */
  const [noFolderCount, setNoFolderCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** book id → id of the upload job queued from here */
  const [jobIds, setJobIds] = useState<Record<number, string>>({});

  // A new run (or unmount) makes the results of an older run stale.
  const runIdRef = useRef(0);
  const parserRef = useRef<ChapterParser | null>(null);
  useEffect(() => () => {
    runIdRef.current++;
    parserRef.current?.dispose();
    parserRef.current = null;
  }, []);

  // Read through a ref so a running scan does not restart when settings change.
  const settingsRef = useRef({ getSettingsForBook, bookSettings });
  useEffect(() => {
    settingsRef.current = { getSettingsForBook, bookSettings };
  }, [getSettingsForBook, bookSettings]);

  const folderOf = useCallback(
    (bookId: number) => settingsRef.current.bookSettings[bookId]?.ttcUploader?.folderPath || '',
    [],
  );

  const scanBook = useCallback(async (book: TtcStory): Promise<SyncRowState> => {
    if (dripRef.current?.plans.some(p => p.bookId === book.id)) {
      return { kind: 'invalid', reason: 'Đang nổi trên bảng cập nhật: chương mới được đăng nhỏ giọt, không đăng một lượt' };
    }
    const folderPath = folderOf(book.id);
    let files: ChapterFile[];
    try {
      files = await invoke<ChapterFile[]>('ttc_read_folder_files', { folderPath });
    } catch (e) {
      return { kind: 'invalid', reason: `Không đọc được folder: ${errorMessage(e)}` };
    }
    if (files.length === 0) return { kind: 'invalid', reason: 'Folder không có file .txt' };

    const settings = settingsRef.current.getSettingsForBook(book.id);
    parserRef.current ??= createChapterParser();
    let local: ParsedChapter[];
    try {
      local = await parserRef.current.allChapters(files, parseOptionsFromSettings(settings));
    } catch (e) {
      return { kind: 'invalid', reason: `Lỗi tách chương: ${errorMessage(e)}` };
    }
    if (local.length === 0) return { kind: 'invalid', reason: 'Không tách được chương nào từ folder' };

    let remote;
    try {
      remote = await fetchAllChapters(book.id);
    } catch (e) {
      return { kind: 'invalid', reason: `Không tải được danh sách chương trên TTC: ${errorMessage(e)}` };
    }

    const analysis = compareChapters(local, remote);
    const plan = planSync(local, remote, analysis);
    if (plan.kind === 'synced') return { kind: 'synced', localCount: local.length, remoteExtra: plan.remoteExtra };

    const { chapterPrice, vipFromChapter, vipMinWords, uploadDelayMs, unlockTimer } = settings.ttcUploader;
    const options: UploadOptions = {
      book_id: book.id,
      chapters: applyChapterPrices(plan.chapters, { chapterPrice, vipFromChapter, vipMinWords }),
      delay_ms: uploadDelayMs,
      price: chapterPrice,
      unlock_timer: unlockTimer || undefined,
    };

    if (plan.kind === 'new') {
      return { kind: 'new', options, from: plan.chapters[0].index, to: plan.chapters[plan.chapters.length - 1].index };
    }
    const diff = analysis.rows.find(r => r.local.index === plan.fromIndex);
    return {
      kind: 'changed',
      options,
      fromIndex: plan.fromIndex,
      toIndex: plan.toIndex,
      newCount: plan.newCount,
      firstDiff: { local: diff?.local.title ?? '', remote: diff?.remote?.title ?? '' },
    };
  }, [folderOf]);

  const runScan = useCallback(async () => {
    const runId = ++runIdRef.current;
    setError(null);
    setRows([]);
    setCheckedCount(0);
    setNoFolderCount(0);
    setJobIds({});
    setLoadingBooks(true);

    let books: TtcStory[];
    try {
      books = await fetchAllBooks(ALL_STATUSES);
    } catch (e) {
      if (runId === runIdRef.current) {
        setError(`Không tải được danh sách truyện: ${errorMessage(e)}`);
        setLoadingBooks(false);
      }
      return;
    }
    if (runId !== runIdRef.current) return;

    // Only a folder picked for this very book counts: another book's chapters must never go up here.
    const withFolder = books.filter(b => folderOf(b.id));
    setNoFolderCount(books.length - withFolder.length);
    const initial: SyncRow[] = withFolder.map(book => ({ book, state: { kind: 'waiting' } }));
    setRows(initial);
    setLoadingBooks(false);

    // One story at a time: each scan reads a folder and the whole chapter list on TTC.
    const setState = (bookId: number, state: SyncRowState) =>
      setRows(prev => prev.map(r => (r.book.id === bookId ? { ...r, state } : r)));
    for (const row of initial) {
      setState(row.book.id, { kind: 'checking' });
      const state = await scanBook(row.book);
      if (runId !== runIdRef.current) return;
      setState(row.book.id, state);
      setCheckedCount(c => c + 1);
    }
  }, [scanBook, folderOf]);

  /** Queue the upload of each selected story that has something to upload. */
  const enqueue = useCallback((bookIds: number[]) => {
    const queued: Record<number, string> = {};
    for (const row of rows) {
      if (!bookIds.includes(row.book.id)) continue;
      if (row.state.kind !== 'new' && row.state.kind !== 'changed') continue;
      queued[row.book.id] = addJob({ ...row.state.options, account: account || undefined }, syncJobTitle(row));
    }
    setJobIds(prev => ({ ...prev, ...queued }));
    return Object.keys(queued).length;
  }, [rows, addJob, account]);

  const checking = loadingBooks || (rows.length > 0 && checkedCount < rows.length);

  return { rows, loadingBooks, checking, checkedCount, noFolderCount, error, jobIds, runScan, enqueue };
}
