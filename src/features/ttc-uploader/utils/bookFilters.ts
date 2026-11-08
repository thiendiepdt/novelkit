import { isPendingApproval, type TtcStory } from '../types';
import { isUnsynced, type FolderSyncStatus } from './folderSync';
import { sourceSite } from './sourceSite';

/**
 * Views of the book list. "Tất cả" is the list as TTC returns it; the others filter it here,
 * without another request.
 */
export type BookTab = 'all' | 'pending' | 'empty' | 'noFolder' | 'unsynced';

export const BOOK_TABS: { value: BookTab; label: string; hint: string }[] = [
  { value: 'all', label: 'Tất cả', hint: 'Mọi truyện theo trạng thái và từ khóa đang chọn' },
  { value: 'pending', label: 'Chờ duyệt', hint: 'Truyện TTC chưa duyệt' },
  { value: 'empty', label: 'Chưa có chương', hint: 'Truyện chưa có chương nào trên TTC' },
  { value: 'noFolder', label: 'Chưa chọn folder', hint: 'Truyện chưa chọn folder chương trong máy' },
  {
    value: 'unsynced',
    label: 'Chưa đồng bộ',
    hint: 'Folder có chương chưa đăng, hoặc chương mới nhất khác TTC. Chỉ đọc folder trong máy; sửa chương cũ thì dùng "Quét chương mới"',
  },
];

/** Stories without a source link ("Sáng Tác"). */
export const NO_SOURCE = 'Không có nguồn';

export const sourceNameOf = (book: Pick<TtcStory, 'chinese_link'>) => sourceSite(book.chinese_link)?.name ?? NO_SOURCE;

/** The sources of the list with their story counts, most used first, "no source" last. */
export function sourceCounts(books: TtcStory[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of books) counts.set(sourceNameOf(b), (counts.get(sourceNameOf(b)) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => Number(a.name === NO_SOURCE) - Number(b.name === NO_SOURCE) || b.count - a.count || a.name.localeCompare(b.name));
}

/** No source picked = every source. */
export const filterBySources = (books: TtcStory[], sources: string[]) =>
  sources.length ? books.filter((b) => sources.includes(sourceNameOf(b))) : books;

export interface TabContext {
  hasFolder: (bookId: number) => boolean;
  folderStatus: (bookId: number) => FolderSyncStatus | undefined;
}

export function inTab(book: TtcStory, tab: BookTab, ctx: TabContext): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'pending':
      return isPendingApproval(book);
    case 'empty':
      return book.total_chapters === 0;
    case 'noFolder':
      return !ctx.hasFolder(book.id);
    case 'unsynced':
      return ctx.hasFolder(book.id) && isUnsynced(ctx.folderStatus(book.id));
  }
}
