import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsContext } from '@/features/settings/context/SettingsContext';
import { useUploadQueueContext } from '@/shared/context/UploadQueueContext';
import type { ChapterFile } from '@/features/chapter-splitter/utils/splitter';
import { isPendingApproval } from '../types';
import type { TtcStory, TtcChaptersResponse, ParsedChapter, UploadOptions } from '../types';
import { parseOptionsFromSettings, applyChapterPrices } from '../utils/localChapters';
import { createChapterParser, type ChapterParser } from '../utils/chapterParser';
import { daysSinceUpdate, sameChapterTitle } from '../utils/abandon';
import { fetchAllBooks } from '../utils/ttcLists';

export type AbandonRowState =
  | { kind: 'waiting' }
  | { kind: 'checking' }
  | { kind: 'invalid'; reason: string }
  /** `warning`: chapter 1 of the folder may not be chapter 1 on TTC; not selected by default. */
  | { kind: 'ready'; options: UploadOptions; chapter: ParsedChapter; warning?: string };

export interface AbandonRow {
  book: TtcStory;
  /** Days since the last chapter update; null when TTC sent no date. */
  days: number | null;
  state: AbandonRowState;
}

/** Rust commands reject with a bare string, JS code with an Error: show either. */
function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

/**
 * "Check vô hố": lists every ongoing story with the days since its last chapter, checks
 * which ones can be kept alive by re-uploading chapter 1 from their local folder, and
 * queues those re-uploads in the upload queue (one job per story, run one after another).
 */
/**
 * @param account - username of the active TTC account: the queued re-uploads run on it even
 *   if the user switches accounts before they start.
 */
export function useAbandonCheck(account?: string | null) {
  const { getSettingsForBook, bookSettings } = useSettingsContext();
  const { addJob } = useUploadQueueContext();

  const [rows, setRows] = useState<AbandonRow[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [checkedCount, setCheckedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** book id → id of the reup job queued from here */
  const [jobIds, setJobIds] = useState<Record<number, string>>({});

  // A new run (or unmount) makes the results of an older run stale.
  const runIdRef = useRef(0);
  const parserRef = useRef<ChapterParser | null>(null);
  useEffect(() => () => {
    runIdRef.current++;
    parserRef.current?.dispose();
    parserRef.current = null;
  }, []);

  // Read through a ref so a running check does not restart when settings change.
  const settingsRef = useRef({ getSettingsForBook, bookSettings });
  useEffect(() => {
    settingsRef.current = { getSettingsForBook, bookSettings };
  }, [getSettingsForBook, bookSettings]);

  const checkBook = useCallback(async (book: TtcStory): Promise<AbandonRowState> => {
    if (isPendingApproval(book)) return { kind: 'invalid', reason: 'Truyện đang chờ duyệt' };
    if (book.total_chapters <= 0) return { kind: 'invalid', reason: 'Chưa có chương nào trên TTC' };

    const { getSettingsForBook: getSettings, bookSettings: perBook } = settingsRef.current;
    // Only a folder picked for this very book counts: chapter 1 of another book must never go up here.
    const folderPath = perBook[book.id]?.ttcUploader?.folderPath;
    if (!folderPath) return { kind: 'invalid', reason: 'Chưa chọn folder (mở Đồng bộ để chọn)' };

    let files: ChapterFile[];
    try {
      files = await invoke<ChapterFile[]>('ttc_read_folder_files', { folderPath });
    } catch (e) {
      return { kind: 'invalid', reason: `Không đọc được folder: ${errorMessage(e)}` };
    }
    if (files.length === 0) return { kind: 'invalid', reason: 'Folder không có file .txt' };

    const settings = getSettings(book.id);
    parserRef.current ??= createChapterParser();
    let first: ParsedChapter | null;
    try {
      first = await parserRef.current.firstChapter(files, parseOptionsFromSettings(settings));
    } catch (e) {
      return { kind: 'invalid', reason: `Lỗi tách chương: ${errorMessage(e)}` };
    }
    if (!first) {
      const skip = settings.ttcUploader.skipChapters;
      return {
        kind: 'invalid',
        reason: skip > 0 ? `Folder bắt đầu từ chương ${skip + 1} (bỏ qua ${skip} chương)` : 'Không tách được chương 1 từ folder',
      };
    }

    const { chapterPrice, vipFromChapter, vipMinWords, uploadDelayMs, unlockTimer } = settings.ttcUploader;
    const [priced] = applyChapterPrices([first], { chapterPrice, vipFromChapter, vipMinWords });
    const options: UploadOptions = {
      book_id: book.id,
      chapters: [priced],
      delay_ms: uploadDelayMs,
      price: chapterPrice,
      unlock_timer: unlockTimer || undefined,
    };

    // Compare with chapter 1 on the web: a folder parsed differently would overwrite it with other text.
    let warning: string | undefined;
    try {
      const resp = await invoke<TtcChaptersResponse>('ttc_fetch_chapters', { bookId: book.id, page: 1, limit: 1 });
      const remote = resp.chapters[0];
      if (remote?.chapterNumber === 1 && !sameChapterTitle(remote.title, first.title)) {
        warning = `Chương 1 trên web là “${remote.title}”, trong folder là “${first.title}”`;
      }
    } catch (e) {
      warning = `Không đối chiếu được chương 1 trên web: ${errorMessage(e)}`;
    }

    return { kind: 'ready', options, chapter: priced, warning };
  }, []);

  const runCheck = useCallback(async () => {
    const runId = ++runIdRef.current;
    setError(null);
    setRows([]);
    setCheckedCount(0);
    setJobIds({});
    setLoadingBooks(true);

    let books: TtcStory[];
    try {
      books = await fetchAllBooks('ongoing');
    } catch (e) {
      if (runId === runIdRef.current) {
        setError(`Không tải được danh sách truyện: ${errorMessage(e)}`);
        setLoadingBooks(false);
      }
      return;
    }
    if (runId !== runIdRef.current) return;

    const now = Date.now();
    const initial: AbandonRow[] = books
      .map(book => ({ book, days: daysSinceUpdate(book.last_chap_updated, now), state: { kind: 'waiting' } as const }))
      // Closest to the deadline first; stories without a date last.
      .sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
    setRows(initial);
    setLoadingBooks(false);

    // One story at a time: each check reads a folder and asks TTC for chapter 1.
    const setState = (bookId: number, state: AbandonRowState) =>
      setRows(prev => prev.map(r => (r.book.id === bookId ? { ...r, state } : r)));
    for (const row of initial) {
      setState(row.book.id, { kind: 'checking' });
      const state = await checkBook(row.book);
      if (runId !== runIdRef.current) return;
      setState(row.book.id, state);
      setCheckedCount(c => c + 1);
    }
  }, [checkBook]);

  /** Queue a chapter 1 re-upload for each selected story that passed the check. */
  const enqueueReup = useCallback((bookIds: number[]) => {
    const queued: Record<number, string> = {};
    for (const row of rows) {
      if (!bookIds.includes(row.book.id) || row.state.kind !== 'ready') continue;
      queued[row.book.id] = addJob({ ...row.state.options, account: account || undefined }, `${row.book.title} · reup chương 1`);
    }
    setJobIds(prev => ({ ...prev, ...queued }));
    return Object.keys(queued).length;
  }, [rows, addJob, account]);

  const checking = loadingBooks || (rows.length > 0 && checkedCount < rows.length);

  return { rows, loadingBooks, checking, checkedCount, error, jobIds, runCheck, enqueueReup };
}
