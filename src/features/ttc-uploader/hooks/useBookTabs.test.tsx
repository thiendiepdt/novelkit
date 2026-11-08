import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/features/settings/context/SettingsContext';
import { useBookTabs } from './useBookTabs';
import type { TtcStory } from '../types';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
// jsdom has no Web Worker: parse on the test thread instead.
vi.mock('../utils/chapterParser', async () => {
  const { parseLocalChapters } = await import('../utils/localChapters');
  return {
    createChapterParser: () => ({
      firstChapter: async () => null,
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
  latest_chapter_title: 'Chương 2: Hai',
  last_chap_updated: null,
  views: 0,
  follows: 0,
  chinese_link: 'https://fanqienovel.com/page/7582401378450951193',
  ...extra,
});

const file = (n: number, title: string) => ({ name: `${n}.txt`, text: `Chương ${n}: ${title}\n\nNội dung chương.` });
const FOLDERS: Record<string, ReturnType<typeof file>[]> = {
  '/books/1': [file(1, 'Một'), file(2, 'Hai'), file(3, 'Ba')], // one chapter ahead
  '/books/2': [file(1, 'Một'), file(2, 'Hai')], // in sync
};

const BOOKS = [
  story(1),
  story(2, { chinese_link: 'https://www.qidian.com/book/1047881520/' }),
  story(3, { approved: false, total_chapters: 0, latest_chapter_title: null }), // no folder
];

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;
const readCalls = () => invokeMock.mock.calls.filter((c) => c[0] === 'ttc_read_folder_files');

describe('useBookTabs', () => {
  beforeEach(() => {
    localStorage.clear();
    const folder = (path: string) => ({ ttcUploader: { folderPath: path, enableSplit: false } });
    localStorage.setItem('nk_book_settings', JSON.stringify({ 1: folder('/books/1'), 2: folder('/books/2') }));
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'ttc_read_folder_files') return FOLDERS[args.folderPath as string] ?? [];
      throw new Error(`unexpected invoke ${cmd}`);
    });
  });

  it('counts the local tabs and filters by source', () => {
    const { result } = renderHook(() => useBookTabs(BOOKS), { wrapper });
    expect(result.current.counts).toMatchObject({ all: 3, pending: 1, empty: 1, noFolder: 1 });
    expect(result.current.sourceOptions).toEqual([
      { name: 'Fanqie', count: 2 },
      { name: 'Qidian', count: 1 },
    ]);

    act(() => result.current.toggleSource('Qidian'));
    expect(result.current.visible.map((b) => b.id)).toEqual([2]);
    expect(result.current.counts.all).toBe(1);
    // The source counts do not shrink with the source filter: every source stays pickable.
    expect(result.current.sourceOptions).toEqual([
      { name: 'Fanqie', count: 2 },
      { name: 'Qidian', count: 1 },
    ]);
  });

  it('counts the sources within the open tab, in the same order on every tab', () => {
    const { result } = renderHook(() => useBookTabs(BOOKS), { wrapper });
    act(() => result.current.setTab('pending'));
    expect(result.current.sourceOptions).toEqual([
      { name: 'Fanqie', count: 1 },
      { name: 'Qidian', count: 0 },
    ]);
    act(() => result.current.setTab('noFolder'));
    expect(result.current.sourceOptions.map((s) => s.count)).toEqual([1, 0]);
  });

  it('reads the folders only when "Chưa đồng bộ" is open, and only once', async () => {
    const { result, rerender } = renderHook(({ books }) => useBookTabs(books), { wrapper, initialProps: { books: BOOKS } });
    expect(readCalls()).toHaveLength(0);

    act(() => result.current.setTab('unsynced'));
    await waitFor(() => expect(result.current.folderSync.checking).toBe(false));
    expect(result.current.folderSync).toMatchObject({ done: 2, total: 2 });
    expect(result.current.visible.map((b) => b.id)).toEqual([1]);
    expect(result.current.folderSync.statusOf(1)).toEqual({ kind: 'ahead', localCount: 3, remoteCount: 2 });
    expect(readCalls()).toHaveLength(2);

    // Same stories reloaded: nothing is read again.
    act(() => result.current.setTab('all'));
    rerender({ books: BOOKS.map((b) => ({ ...b })) });
    act(() => result.current.setTab('unsynced'));
    expect(result.current.folderSync.checking).toBe(false);
    expect(readCalls()).toHaveLength(2);

    // Story 1 got its chapter 3 on TTC: only that folder is read again.
    rerender({ books: BOOKS.map((b) => (b.id === 1 ? { ...b, total_chapters: 3, latest_chapter_title: 'Chương 3: Ba' } : b)) });
    await waitFor(() => expect(result.current.folderSync.checking).toBe(false));
    expect(readCalls()).toHaveLength(3);
    expect(result.current.visible).toEqual([]);
  });
});
