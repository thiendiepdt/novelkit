// ─── TTC API Response Types ────────────────────────────────

export interface TtcStory {
  id: number;
  title: string;
  author: string;
  poster: string;
  category: string;
  status: string;
  total_chapters: number;
  latest_chapter_title: string | null;
  last_chap_updated: string | null;
  views: number;
  follows: number;
}

export interface TtcBooksResponse {
  success: boolean;
  stories: TtcStory[];
  totalPages: number;
  totalStories: number;
  currentPage: number;
}

// ─── TTC Chapter List Types (from API) ─────────────────────

export interface TtcChapter {
  chapterNumber: number;
  title: string;
  wordCount: number;
  views: number;
  status: string | null;
  chapter_price: number;
  last_chap_updated: string | null;
}

export interface TtcChaptersResponse {
  success: boolean;
  chapters: TtcChapter[];
  totalPages: number;
  totalChapters: number;
  currentPage: number;
}

// ─── Chapter Parsing Types ─────────────────────────────────

export interface ParsedChapter {
  index: number;
  title: string;
  content: string;
  word_count: number;
  file_name: string;
}

// ─── Upload Types ──────────────────────────────────────────

export interface UploadOptions {
  book_id: number;
  chapters: ParsedChapter[];
  delay_ms?: number;
}

/** Rust-side event payload emitted via `ttc://upload-progress`. */
export interface UploadProgressEvent {
  job_id: string | null;
  current: number;
  total: number;
  current_title: string;
  success: number;
  failed: number;
  status: string;
  message: string | null;
}

/** UI-facing progress shape (superset of backend event + queue states). */
export interface UploadProgress {
  current: number;
  total: number;
  current_title: string;
  success: number;
  failed: number;
  status: 'idle' | 'uploading' | 'done' | 'error' | 'pending';
  message?: string;
}

// ─── Sync Mode ─────────────────────────────────────────────

export type SyncMode = 'all' | 'append' | 'range';

export const SYNC_MODE_LABELS: Record<SyncMode, string> = {
  all: 'Upload tất cả (ghi đè)',
  append: 'Chỉ upload chương mới',
  range: 'Upload theo khoảng',
};

// ─── Download Chapter (scraped from edit page) ─────────────

export interface DownloadedChapter {
  title: string;
  content: string;
}

// ─── Download All Types (canonical source: @/shared/types/download) ──
// Re-exported here for backward compatibility within the feature.
export type { DownloadAllOptions, DownloadAllProgressEvent } from '@/shared/types/download';

// ─── Edit Book Types ───────────────────────────────────────

export interface OptionItem {
  value: string;
  label: string;
}

export interface EditBookOptions {
  categories: OptionItem[];
  subCategoriesTichCach: OptionItem[];
  subCategoriesBoiCanh: OptionItem[];
  subCategoriesLuuPhai: OptionItem[];
}

export interface EditBookData {
  title: string;
  chinese_title: string;
  chinese_link: string;
  gender: string;
  type: string;
  story_length: string;
  author: string;
  author_original: string;
  category: string;
  sub_categories: string[];
  description: string;
  status: string;
}

export interface EditBookForm {
  actionUrl: string;
  csrfToken: string;
  data: EditBookData;
  options: EditBookOptions;
}

