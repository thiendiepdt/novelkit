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
  /** Chapters with fewer words than this are uploaded free (TTC rejects VIP on short chapters) */
  vipMinWords: number;
  /** Chapters (web number, skipChapters included) before this are uploaded free */
  vipFromChapter: number;
  skipChapters: number;
}

/** `gemini` = Google's Gemini API; `openai` = OpenAI or any OpenAI-compatible hub (chat/completions). */
export type AiProvider = 'gemini' | 'openai';

export interface AiProviderSettings {
  apiKey: string;
  model: string;
  /** Empty = the provider's official endpoint (see DEFAULT_AI_BASE_URLS). */
  baseUrl: string;
}

export interface AiSettings {
  provider: AiProvider;
  gemini: AiProviderSettings;
  openai: AiProviderSettings;
}

export const DEFAULT_AI_BASE_URLS: Record<AiProvider, string> = {
  gemini: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com/v1',
};

export interface AppSettings {
  splitter: SplitterSettings;
  ttcUploader: TtcUploaderSettings;
  /** Global only: AI credentials are never overridden per book. */
  ai: AiSettings;
}

export type PerBookSettings = Partial<{
  splitter: Partial<SplitterSettings>;
  ttcUploader: Partial<TtcUploaderSettings>;
}>;

/** Sections that can be overridden per book. */
export type BookSettingsSection = keyof PerBookSettings;

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
    vipMinWords: 1450,
    vipFromChapter: 51,
    skipChapters: 0,
  },
  ai: {
    provider: 'gemini',
    gemini: { apiKey: '', model: 'gemini-3.8-flash', baseUrl: '' },
    openai: { apiKey: '', model: 'gpt-5.6-sol', baseUrl: '' },
  },
};
