// ─── Status filter ─────────────────────────────────────────
export type BookStatus = 'ongoing' | 'full' | 'paused';

export const STATUS_OPTIONS: { value: BookStatus; label: string; icon: string }[] = [
  { value: 'ongoing', label: 'Đang ra', icon: '🟢' },
  { value: 'full', label: 'Hoàn thành', icon: '🔵' },
  { value: 'paused', label: 'Tạm dừng', icon: '🟡' },
];

// ─── Pagination defaults ───────────────────────────────────
export const DEFAULT_BOOKS_LIMIT = 12;
export const DEFAULT_CHAPTERS_LIMIT = 16;
