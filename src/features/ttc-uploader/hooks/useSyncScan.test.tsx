import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/features/settings/context/SettingsContext';
import { UploadQueueContext } from '@/shared/context/UploadQueueContext';
import { useSyncScan } from './useSyncScan';
import type { TtcChapter, TtcStory, UploadOptions } from '../types';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
// jsdom has no Web Worker: parse on the test thread instead.
vi.mock('../utils/chapterParser', async () => {
  const { parseLocalChapters } = await import('../utils/localChapters');
  return {
    createChapterParser: () => ({
      firstChapter: async (...args: Parameters<typeof parseLocalChapters>) =>
        parseLocalChapters(...args).find(c => c.index === 1) ?? null,
      allChapters: async (...args: Parameters<typeof parseLocalChapters>) => parseLocalChapters(...args),
      dispose: () => {},
    }),
  };
});

const story = (id: number, extra: Partial<TtcStory> = {}): TtcStory => ({
  id,
  title: `Truyện ${id}`,
  author: '',
  poster: '',
  category: '',
  status: 'ongoing',
  total_chapters: 2,
  latest_chapter_title: null,
  last_chap_updated: null,
  views: 0,
  follows: 0,
  ...extra,
});

/** A chapter file: "Chương n: title" plus `words` words of body. */
const file = (n: number, title: string, words = 50) => ({
  name: `${n}.txt`,
  text: `Chương ${n}: ${title}\n\n${Array.from({ length: words }, () => 'chữ').join(' ')}`,
});
const remote = (n: number, title: string, wordCount: number): TtcChapter => ({
  chapterNumber: n,
  title: `Chương ${n}: ${title}`,
  wordCount,
  views: 0,
  status: null,
  chapter_price: 0,
  last_chap_updated: null,
});

const BOOKS = [
  story(1),                       // folder has 2 new chapters
  story(2),                       // chapter 2 renamed in the folder
  story(3),                       // in sync
  story(4, { status: 'full' }),   // no folder
  story(5),                       // empty folder
];

const FOLDERS: Record<string, ReturnType<typeof file>[]> = {
  '/books/1': [file(1, 'Một'), file(2, 'Hai'), file(3, 'Ba'), file(4, 'Bốn')],
  '/books/2': [file(1, 'Một'), file(2, 'Hai mới'), file(3, 'Ba')],
  '/books/3': [file(1, 'Một'), file(2, 'Hai')],
  '/books/5': [],
};

const addJob = vi.fn<(options: UploadOptions, title: string) => string>(options => `job-${options.book_id}`);

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <UploadQueueContext.Provider
      value={{ jobs: [], addJob, removeJob: vi.fn(), cancelJob: vi.fn(), clearDone: vi.fn(), getJobForBook: () => undefined }}
    >
      {children}
    </UploadQueueContext.Provider>
  </SettingsProvider>
);

describe('useSyncScan', () => {
  beforeEach(() => {
    localStorage.clear();
    const folder = (path: string) => ({ ttcUploader: { folderPath: path, enableSplit: false, chapterPrice: 0 } });
    localStorage.setItem('nk_book_settings', JSON.stringify({
      1: folder('/books/1'),
      2: folder('/books/2'),
      3: folder('/books/3'),
      5: folder('/books/5'),
    }));
    addJob.mockClear();
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'ttc_fetch_books') return { success: true, stories: BOOKS, totalPages: 1, totalStories: BOOKS.length, currentPage: 1 };
      if (cmd === 'ttc_read_folder_files') return FOLDERS[args.folderPath as string] ?? [];
      if (cmd === 'ttc_fetch_chapters') {
        // Every story has "Một" and "Hai" on TTC; the parser counts the heading line too.
        const chapters = [remote(1, 'Một', 53), remote(2, 'Hai', 53)];
        return { success: true, chapters, totalPages: 1, totalChapters: 2, currentPage: 1 };
      }
      throw new Error(`unexpected invoke ${cmd}`);
    });
  });

  it('scans every story with a folder and decides what to upload', async () => {
    const { result } = renderHook(() => useSyncScan('thiendiepdt'), { wrapper });
    await act(() => result.current.runScan());
    await waitFor(() => expect(result.current.checking).toBe(false));

    expect(invokeMock).toHaveBeenCalledWith('ttc_fetch_books', expect.objectContaining({ status: 'ongoing,full,paused' }));
    expect(result.current.rows.map(r => r.book.id)).toEqual([1, 2, 3, 5]);
    expect(result.current.noFolderCount).toBe(1);

    const byId = Object.fromEntries(result.current.rows.map(r => [r.book.id, r.state]));
    expect(byId[1]).toMatchObject({ kind: 'new', from: 3, to: 4 });
    expect(byId[2]).toMatchObject({
      kind: 'changed',
      fromIndex: 2,
      toIndex: 3,
      newCount: 1,
      firstDiff: { local: 'Chương 2: Hai mới', remote: 'Chương 2: Hai' },
    });
    expect(byId[3]).toEqual({ kind: 'synced', localCount: 2, remoteExtra: 0 });
    expect(byId[5]).toMatchObject({ kind: 'invalid', reason: 'Folder không có file .txt' });
  });

  it('queues one job per story, pinned to the account, with the planned chapters', async () => {
    const { result } = renderHook(() => useSyncScan('thiendiepdt'), { wrapper });
    await act(() => result.current.runScan());
    await waitFor(() => expect(result.current.checking).toBe(false));

    let count = 0;
    act(() => { count = result.current.enqueue([1, 2, 3, 5]); });
    // The synced and the invalid story have nothing to upload.
    expect(count).toBe(2);

    const [appendOptions, appendTitle] = addJob.mock.calls[0];
    expect(appendOptions).toMatchObject({ book_id: 1, account: 'thiendiepdt' });
    expect(appendOptions.chapters.map(c => c.index)).toEqual([3, 4]);
    expect(appendTitle).toBe('Truyện 1 · 2 chương mới');

    const [overwriteOptions, overwriteTitle] = addJob.mock.calls[1];
    expect(overwriteOptions.chapters.map(c => c.index)).toEqual([2, 3]);
    expect(overwriteTitle).toBe('Truyện 2 · ghi đè chương 2–3');
    expect(result.current.jobIds).toEqual({ 1: 'job-1', 2: 'job-2' });
  });

  it('reports a TTC failure on the story instead of stopping the scan', async () => {
    const base = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'ttc_fetch_chapters' && args.bookId === 1) throw 'HTTP 502';
      return base(cmd, args);
    });
    const { result } = renderHook(() => useSyncScan(), { wrapper });
    await act(() => result.current.runScan());
    await waitFor(() => expect(result.current.checking).toBe(false));

    const byId = Object.fromEntries(result.current.rows.map(r => [r.book.id, r.state]));
    expect(byId[1]).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('HTTP 502') });
    expect(byId[3]).toMatchObject({ kind: 'synced' });
  });
});
