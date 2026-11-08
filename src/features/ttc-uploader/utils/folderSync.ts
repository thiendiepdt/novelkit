import type { ParsedChapter, TtcStory } from '../types';

/**
 * Folder against TTC from what the story list already says (number of chapters and title of
 * the latest one): no request to TTC. It finds chapters not uploaded yet and a last chapter
 * that differs; an older chapter edited in the folder needs "Quét chương mới", which reads
 * every chapter on TTC.
 */
export type FolderSyncStatus =
  | { kind: 'synced'; localCount: number }
  /** The folder has chapters TTC does not have yet. */
  | { kind: 'ahead'; localCount: number; remoteCount: number }
  /** The latest chapter on TTC differs from the same chapter in the folder. */
  | { kind: 'changed'; chapter: number; local: string; remote: string }
  | { kind: 'error'; reason: string };

export const isUnsynced = (status: FolderSyncStatus | undefined) =>
  !!status && (status.kind === 'ahead' || status.kind === 'changed' || status.kind === 'error');

export function folderVerdict(local: ParsedChapter[], book: Pick<TtcStory, 'total_chapters' | 'latest_chapter_title'>): FolderSyncStatus {
  if (local.length === 0) return { kind: 'error', reason: 'Không tách được chương nào từ folder' };
  const localCount = Math.max(...local.map((c) => c.index));
  const remoteCount = book.total_chapters;
  if (localCount > remoteCount) return { kind: 'ahead', localCount, remoteCount };

  const latest = (book.latest_chapter_title || '').trim();
  const same = local.find((c) => c.index === remoteCount);
  if (remoteCount > 0 && latest && same && same.title.trim() !== latest) {
    return { kind: 'changed', chapter: remoteCount, local: same.title.trim(), remote: latest };
  }
  return { kind: 'synced', localCount };
}
