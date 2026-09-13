export type LocalSortMode = 'name' | 'file';
export type UnlockTimer = '' | '8h' | '1d' | '3d' | '7d';

export interface SplitterSettings {
  maxWords: number;
  minWords: number;
  roundUp: boolean;
}

export interface TtcUploaderSettings {
  enableSplit: boolean;
  splitFromChapter: number;
  uploadDelayMs: number;
  booksLimit: number;
  chaptersLimit: number;
  localSortMode: LocalSortMode;
  /** Only with localSortMode = "file": first non-empty line of each file is the chapter title */
  fileFirstLineTitle: boolean;
  folderPath: string;
  chapterPrice: number;
  unlockTimer: UnlockTimer;
  vipNewChaptersOnly: boolean;
  /** Chapters with fewer words than this are uploaded free (TTC rejects VIP on short chapters) */
  vipMinWords: number;
  skipChapters: number;
}

export interface AppSettings {
  splitter: SplitterSettings;
  ttcUploader: TtcUploaderSettings;
}

export type PerBookSettings = Partial<{
  splitter: Partial<SplitterSettings>;
  ttcUploader: Partial<TtcUploaderSettings>;
}>;

export const DEFAULT_SETTINGS: AppSettings = {
  splitter: {
    maxWords: 1700,
    minWords: 1000,
    roundUp: false,
  },
  ttcUploader: {
    enableSplit: true,
    splitFromChapter: 1,
    uploadDelayMs: 200,
    booksLimit: 20,
    chaptersLimit: 10,
    localSortMode: 'name',
    fileFirstLineTitle: false,
    folderPath: '',
    chapterPrice: 0,
    unlockTimer: '',
    vipNewChaptersOnly: true,
    vipMinWords: 1450,
    skipChapters: 0,
  },
};
