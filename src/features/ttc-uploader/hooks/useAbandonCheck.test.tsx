import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/features/settings/context/SettingsContext';
import { UploadQueueContext } from '@/shared/context/UploadQueueContext';
import { useAbandonCheck } from './useAbandonCheck';
import type { TtcStory, UploadOptions } from '../types';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
// jsdom has no Web Worker: parse on the test thread instead.
vi.mock('../utils/chapterParser', async () => {
  const { parseLocalChapters } = await import('../utils/localChapters');
  return {
    createChapterParser: () => ({
      firstChapter: async (...args: Parameters<typeof parseLocalChapters>) =>
        parseLocalChapters(...args).find(c => c.index === 1) ?? null,
      dispose: () => {},
    }),
  };
});

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000 - 60_000).toISOString();

const story = (id: number, extra: Partial<TtcStory> = {}): TtcStory => ({
  id,
  title: `Truyện ${id}`,
  author: '',
  poster: '',
  category: '',
  status: 'ongoing',
  total_chapters: 10,
  latest_chapter_title: null,
  last_chap_updated: daysAgo(id),
  views: 0,
  follows: 0,
  ...extra,
});

const BOOKS = [
  story(1),                              // ready
  story(2),                              // no folder
  story(3, { approved: false }),         // pending approval
  story(4),                              // folder title differs from the web
  story(5, { total_chapters: 0 }),       // nothing on TTC
];

const FOLDERS: Record<string, { name: string; text: string }[]> = {
  '/books/1': [{ name: '1.txt', text: 'Chương 1: Một\n\nNội dung' }, { name: '2.txt', text: 'Chương 2: Hai\n\nNội dung' }],
  '/books/4': [{ name: '1.txt', text: 'Chương 1: Khác\n\nNội dung' }],
};

const addJob = vi.fn((options: UploadOptions) => `job-${options.book_id}`);

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <UploadQueueContext.Provider
      value={{ jobs: [], addJob, waitForJob: vi.fn(), removeJob: vi.fn(), cancelJob: vi.fn(), clearDone: vi.fn(), getJobForBook: () => undefined }}
    >
      {children}
    </UploadQueueContext.Provider>
  </SettingsProvider>
);

describe('useAbandonCheck', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('nk_book_settings', JSON.stringify({
      1: { ttcUploader: { folderPath: '/books/1', enableSplit: false } },
      3: { ttcUploader: { folderPath: '/books/1' } },
      4: { ttcUploader: { folderPath: '/books/4', enableSplit: false } },
    }));
    addJob.mockClear();
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'ttc_fetch_books') return { success: true, stories: BOOKS, totalPages: 1, totalStories: BOOKS.length, currentPage: 1 };
      if (cmd === 'ttc_read_folder_files') return FOLDERS[args.folderPath as string] ?? [];
      if (cmd === 'ttc_fetch_chapters') {
        return { success: true, chapters: [{ chapterNumber: 1, title: 'Chương 1: Một' }], totalPages: 10, totalChapters: 10, currentPage: 1 };
      }
      throw new Error(`unexpected invoke ${cmd}`);
    });
  });

  it('checks every ongoing story and queues chapter 1 of the valid ones', async () => {
    const { result } = renderHook(() => useAbandonCheck(), { wrapper });
    await act(() => result.current.runCheck());
    await waitFor(() => expect(result.current.checking).toBe(false));

    const byId = Object.fromEntries(result.current.rows.map(r => [r.book.id, r]));
    // Closest to the deadline first
    expect(result.current.rows.map(r => r.book.id)).toEqual([5, 4, 3, 2, 1]);
    expect(byId[1].days).toBe(1);
    expect(byId[1].state).toMatchObject({ kind: 'ready', chapter: { index: 1, title: 'Chương 1: Một' } });
    expect(byId[1].state.kind === 'ready' && byId[1].state.warning).toBeFalsy();
    expect(byId[2].state).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('Chưa chọn folder') });
    expect(byId[3].state).toMatchObject({ kind: 'invalid', reason: 'Truyện đang chờ duyệt' });
    expect(byId[4].state).toMatchObject({ kind: 'ready', warning: expect.stringContaining('Chương 1: Khác') });
    expect(byId[5].state).toMatchObject({ kind: 'invalid', reason: 'Chưa có chương nào trên TTC' });
    expect(invokeMock).toHaveBeenCalledWith('ttc_fetch_books', expect.objectContaining({ status: 'ongoing' }));

    let count = 0;
    act(() => { count = result.current.enqueueReup([1, 2, 4]); });
    expect(count).toBe(2);
    expect(addJob).toHaveBeenCalledTimes(2);
    // Queued in list order: closest to the deadline first
    expect(addJob.mock.calls.map(([o]) => o.book_id)).toEqual([4, 1]);
    const [options] = addJob.mock.calls[1];
    expect(options).toMatchObject({ book_id: 1, chapters: [{ index: 1, title: 'Chương 1: Một' }] });
    expect(options.chapters).toHaveLength(1);
    expect(result.current.jobIds).toEqual({ 1: 'job-1', 4: 'job-4' });
  });

  it('rejects a folder whose numbering starts after chapter 1', async () => {
    localStorage.setItem('nk_book_settings', JSON.stringify({
      1: { ttcUploader: { folderPath: '/books/1', enableSplit: false, skipChapters: 5 } },
    }));
    const { result } = renderHook(() => useAbandonCheck(), { wrapper });
    await act(() => result.current.runCheck());
    await waitFor(() => expect(result.current.checking).toBe(false));

    const row = result.current.rows.find(r => r.book.id === 1)!;
    expect(row.state).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('bỏ qua 5 chương') });
  });
});
