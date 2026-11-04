import type { BookType } from './types';

// ─── Status filter ─────────────────────────────────────────
export type BookStatus = 'ongoing' | 'full' | 'paused';

export const STATUS_OPTIONS: { value: BookStatus; label: string; icon: string }[] = [
  { value: 'ongoing', label: 'Đang ra', icon: '🟢' },
  { value: 'full', label: 'Hoàn thành', icon: '🔵' },
  { value: 'paused', label: 'Tạm dừng', icon: '🟡' },
];

// ─── Story form choices (create, and edit while pending) ──
export const BOOK_TYPE_OPTIONS: { value: BookType; label: string }[] = [
  { value: 'truyen-cv', label: 'Truyện Convert' },
  { value: 'truyen-dich', label: 'Truyện Dịch' },
  { value: 'sang-tac', label: 'Truyện Sáng Tác' },
];

export const GENDER_OPTIONS: { value: 'Nam' | 'Nữ'; label: string }[] = [
  { value: 'Nam', label: 'Truyện Nam' },
  { value: 'Nữ', label: 'Truyện Nữ' },
];

export const LENGTH_OPTIONS: { value: 'Truyện dài' | 'Truyện ngắn'; label: string }[] = [
  { value: 'Truyện dài', label: 'Truyện dài' },
  { value: 'Truyện ngắn', label: 'Truyện ngắn' },
];

// ─── Pagination defaults ───────────────────────────────────
export const DEFAULT_BOOKS_LIMIT = 12;
export const DEFAULT_CHAPTERS_LIMIT = 16;
