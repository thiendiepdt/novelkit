import { invoke } from '@tauri-apps/api/core';
import type { TtcChapter, TtcChaptersResponse, TtcStory, TtcBooksResponse } from '../types';

/** TTC serves up to 200 stories per page: most accounts fit in one request. */
const BOOKS_PAGE_SIZE = 200;
const CHAPTERS_PAGE_SIZE = 1000;

/**
 * Every story of the active account with one of the given statuses (comma-separated, as the
 * list sends them), in TTC's order. `keyword` is TTC's own search.
 */
export async function fetchAllBooks(status: string, keyword = ''): Promise<TtcStory[]> {
  const all: TtcStory[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const resp = await invoke<TtcBooksResponse>('ttc_fetch_books', {
      page,
      limit: BOOKS_PAGE_SIZE,
      keyword: keyword || null,
      status,
    });
    all.push(...resp.stories);
    totalPages = resp.totalPages;
    page++;
  } while (page <= totalPages);
  // A story that moved between pages while they were read would show twice.
  const seen = new Set<number>();
  return all.filter((b) => !seen.has(b.id) && seen.add(b.id));
}

/**
 * The full chapter list of a story on TTC, sorted by chapter number.
 * @param account - read with this account's session instead of the active one
 */
export async function fetchAllChapters(bookId: number, account?: string): Promise<TtcChapter[]> {
  const fetchPage = (page: number) =>
    invoke<TtcChaptersResponse>('ttc_fetch_chapters', { bookId, page, limit: CHAPTERS_PAGE_SIZE, account: account ?? null });
  const first = await fetchPage(1);
  const all: TtcChapter[] = [...first.chapters];
  if (first.totalPages > 1) {
    const rest = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, i) => fetchPage(i + 2)));
    rest.forEach(r => all.push(...r.chapters));
  }
  return all.sort((a, b) => a.chapterNumber - b.chapterNumber);
}
