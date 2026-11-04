import * as Comlink from 'comlink';
import type { ChapterFile } from '@/features/chapter-splitter/utils/splitter';
import type { ParsedChapter } from '../types';
import type { LocalParseOptions } from './localChapters';
import type { LocalChaptersWorkerApi } from './localChapters.worker';
import LocalChaptersWorker from './localChapters.worker?worker';

export interface ChapterParser {
  firstChapter: (files: ChapterFile[], opts: LocalParseOptions) => Promise<ParsedChapter | null>;
  allChapters: (files: ChapterFile[], opts: LocalParseOptions) => Promise<ParsedChapter[]>;
  dispose: () => void;
}

/**
 * Folder parsing in a Web Worker: splitting a long novel takes about a second,
 * which froze the UI when done for story after story on the main thread.
 */
export function createChapterParser(): ChapterParser {
  const worker = new LocalChaptersWorker();
  const api = Comlink.wrap<LocalChaptersWorkerApi>(worker);
  return {
    firstChapter: (files, opts) => api.firstChapter(files, opts),
    allChapters: (files, opts) => api.allChapters(files, opts),
    dispose: () => worker.terminate(),
  };
}
