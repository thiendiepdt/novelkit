import type { ParsedChapter, TtcChapter } from '../types';

export type ChapterSyncStatus = 'match' | 'changed' | 'new';

export interface ChapterSyncRow {
  local: ParsedChapter;
  /** The TTC chapter at the same position, or null when TTC has none there. */
  remote: TtcChapter | null;
  status: ChapterSyncStatus;
}

export interface ChapterSyncAnalysis {
  rows: ChapterSyncRow[];
  /** Local chapters TTC has nothing for. */
  newCount: number;
  /** Local chapters whose title or length differs from TTC. */
  changedCount: number;
  /** Index (as numbered on TTC) of the first changed chapter, or null. */
  firstChangedIndex: number | null;
  /** Index of the last local chapter (includes the skipChapters offset), 0 for an empty folder. */
  maxLocalIndex: number;
  /** TTC chapters beyond the end of the folder. */
  remoteExtra: number;
}

/** Word counts within this share of each other count as the same chapter. */
const WORD_COUNT_TOLERANCE = 0.03;

/**
 * Compare a parsed folder with the chapter list of TTC, chapter by chapter. Shared by the
 * "So sánh & Upload" tab and the "Quét chương mới" scan, so both always reach the same verdict.
 *
 * `remote` must be sorted by chapter number; a local chapter is compared with the remote one
 * at the same position (`index - 1`). A chapter is changed when its title differs (catches the
 * renumbering a different split produces) or its word count differs by more than 3%.
 */
export function compareChapters(local: ParsedChapter[], remote: TtcChapter[]): ChapterSyncAnalysis {
  let newCount = 0;
  let changedCount = 0;
  let firstChangedIndex: number | null = null;

  const rows = local.map((chapter): ChapterSyncRow => {
    const match = remote[chapter.index - 1] ?? null;
    if (!match) {
      newCount++;
      return { local: chapter, remote: null, status: 'new' };
    }
    const titleChanged = chapter.title.trim() !== match.title.trim();
    const larger = Math.max(chapter.word_count, match.wordCount);
    const wordCountChanged = larger > 0 && Math.abs(chapter.word_count - match.wordCount) / larger > WORD_COUNT_TOLERANCE;
    if (titleChanged || wordCountChanged) {
      changedCount++;
      if (firstChangedIndex === null) firstChangedIndex = chapter.index;
      return { local: chapter, remote: match, status: 'changed' };
    }
    return { local: chapter, remote: match, status: 'match' };
  });

  const maxLocalIndex = local.length > 0 ? local[local.length - 1].index : 0;
  return {
    rows,
    newCount,
    changedCount,
    firstChangedIndex,
    maxLocalIndex,
    remoteExtra: Math.max(0, remote.length - maxLocalIndex),
  };
}

/** What a sync of one story should upload, decided from the comparison. */
export type SyncPlan =
  | { kind: 'synced'; remoteExtra: number }
  /** Append: the chapters after the last chapter on TTC. */
  | { kind: 'new'; chapters: ParsedChapter[] }
  /** Overwrite from the first changed chapter to the end of the folder (like the "Range" mode). */
  | { kind: 'changed'; chapters: ParsedChapter[]; fromIndex: number; toIndex: number; newCount: number };

export function planSync(local: ParsedChapter[], remote: TtcChapter[], analysis = compareChapters(local, remote)): SyncPlan {
  if (analysis.firstChangedIndex !== null) {
    const fromIndex = analysis.firstChangedIndex;
    return {
      kind: 'changed',
      chapters: local.filter(c => c.index >= fromIndex),
      fromIndex,
      toIndex: analysis.maxLocalIndex,
      newCount: analysis.newCount,
    };
  }
  if (analysis.newCount > 0) {
    // Same start as the "Tiếp nối" (append) mode of the sync page.
    const startIndex = remote.length > 0 ? remote[remote.length - 1].chapterNumber + 1 : 1;
    const chapters = local.filter(c => c.index >= startIndex);
    if (chapters.length > 0) return { kind: 'new', chapters };
  }
  return { kind: 'synced', remoteExtra: analysis.remoteExtra };
}
