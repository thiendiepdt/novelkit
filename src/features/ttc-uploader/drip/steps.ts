import type { ParsedChapter, TtcChapter } from '../types';
import { compareChapters } from '../utils/syncCompare';

/**
 * What one turn of a drip plan uploads, decided from the folder and the chapter list of TTC
 * every time (never from what the app remembers), so a restart or an edit of the folder
 * always continues from what TTC really has:
 *
 * 1. `resync`: a chapter already on TTC differs from the folder → overwrite from the first
 *    difference up to the last chapter on TTC (no new chapter in the same step).
 * 2. `initial`: TTC has fewer chapters than the initial batch → upload up to it in one go.
 * 3. `drip`: the next chapter after the last one on TTC, alone.
 * 4. `caught-up`: the folder has nothing TTC lacks.
 */
export type DripStep =
  | { kind: 'resync' | 'initial' | 'drip'; chapters: ParsedChapter[]; from: number; to: number }
  | { kind: 'caught-up'; lastOnTtc: number };

/** Number of the last chapter on TTC; 0 for a story without chapters. */
export function lastChapterOnTtc(remote: TtcChapter[]): number {
  return remote.length > 0 ? remote[remote.length - 1].chapterNumber : 0;
}

/**
 * @param local - the parsed folder, numbered as on TTC
 * @param remote - the chapter list of TTC, sorted by chapter number
 * @param initialBatch - chapters uploaded at once before dripping; 0 = drip from the start
 */
export function decideDripStep(local: ParsedChapter[], remote: TtcChapter[], initialBatch: number): DripStep {
  const lastOnTtc = lastChapterOnTtc(remote);
  const span = (kind: 'resync' | 'initial' | 'drip', chapters: ParsedChapter[]): DripStep => ({
    kind,
    chapters,
    from: chapters[0].index,
    to: chapters[chapters.length - 1].index,
  });

  const { firstChangedIndex } = compareChapters(local, remote);
  if (firstChangedIndex !== null) {
    const chapters = local.filter(c => c.index >= firstChangedIndex && c.index <= lastOnTtc);
    if (chapters.length > 0) return span('resync', chapters);
  }

  const fresh = local.filter(c => c.index > lastOnTtc);
  if (fresh.length === 0) return { kind: 'caught-up', lastOnTtc };

  if (lastOnTtc < initialBatch) {
    const batch = fresh.filter(c => c.index <= initialBatch);
    if (batch.length > 0) return span('initial', batch);
  }
  return span('drip', [fresh[0]]);
}

/** Label of the upload job, as the queue and the plan list show it. */
export function stepLabel(step: Exclude<DripStep, { kind: 'caught-up' }>): string {
  const range = step.from === step.to ? `chương ${step.from}` : `chương ${step.from}–${step.to}`;
  if (step.kind === 'resync') return `đồng bộ lại ${range}`;
  if (step.kind === 'initial') return `đợt đầu ${range}`;
  return `nhỏ giọt ${range}`;
}
