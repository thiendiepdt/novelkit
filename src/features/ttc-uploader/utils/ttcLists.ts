import { invoke } from '@tauri-apps/api/core';
import type { TtcChapter, TtcChaptersResponse, TtcStory, TtcBooksResponse } from '../types';

const BOOKS_PAGE_SIZE = 50;
const CHAPTERS_PAGE_SIZE = 1000;

/** Every story of the active account with one of the given statuses (comma-separated, as the list sends them). */
export async function fetchAllBooks(status: string): Promise<TtcStory[]> {
  const all: TtcStory[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const resp = await invoke<TtcBooksResponse>('ttc_fetch_books', {
      page,
      limit: BOOKS_PAGE_SIZE,
      keyword: null,
      status,
    });
    all.push(...resp.stories);
    totalPages = resp.totalPages;
    page++;
  } while (page <= totalPages);
  return all;
}

/** The full chapter list of a story on TTC, sorted by chapter number. */
export async function fetchAllChapters(bookId: number): Promise<TtcChapter[]> {
  const first = await invoke<TtcChaptersResponse>('ttc_fetch_chapters', { bookId, page: 1, limit: CHAPTERS_PAGE_SIZE });
  const all: TtcChapter[] = [...first.chapters];
  if (first.totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, i) =>
        invoke<TtcChaptersResponse>('ttc_fetch_chapters', { bookId, page: i + 2, limit: CHAPTERS_PAGE_SIZE }),
      ),
    );
    rest.forEach(r => all.push(...r.chapters));
  }
  return all.sort((a, b) => a.chapterNumber - b.chapterNumber);
}
