export const DEFAULTS = {
  MAX_WORDS: 2000,
  MIN_WORDS: 1000,
  ITEMS_PER_PAGE: 20,
  LARGE_INPUT_CHAR_THRESHOLD: 10_000,
  LARGE_OUTPUT_WORD_THRESHOLD: 10_000,
  MAX_WORDS_PRESETS: [1700, 2000, 2500, 3000, 3400] as const,
  MIN_WORDS_PRESETS: [0, 500, 800, 1000, 1200] as const,
} as const;

export const STORAGE_KEYS = {
  MAX_WORDS: 'novelkit_chapter_splitter_max_words',
  ROUND_UP: 'novelkit_chapter_splitter_round_up',
  MIN_WORDS: 'novelkit_chapter_splitter_min_words',
} as const;
