export type LocalSortMode = 'name' | 'file';
export type UnlockTimer = '' | '8h' | '1d' | '3d' | '7d';

export interface SplitterSettings {
  maxWords: number;
  minWords: number;
  roundUp: boolean;
}

export interface TtcUploaderSettings {
  enableSplit: boolean;
  uploadDelayMs: number;
  booksLimit: number;
  chaptersLimit: number;
  localSortMode: LocalSortMode;
  folderPath: string;
  chapterPrice: number;
  unlockTimer: UnlockTimer;
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
    uploadDelayMs: 200,
    booksLimit: 20,
    chaptersLimit: 10,
    localSortMode: 'name',
    folderPath: '',
    chapterPrice: 0,
    unlockTimer: '',
  },
};
