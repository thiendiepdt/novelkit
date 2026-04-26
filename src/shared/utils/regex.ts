/**
 * CJK Unified Ideographs regex — single source of truth.
 * Covers: CJK Unified Ideographs, Extension A, CJK Compatibility Ideographs.
 *
 * NOTE: Does NOT cover CJK Extension B-G (rare chars above U+20000)
 * which require surrogate pairs.
 */
export const CHINESE_CHAR_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;

/**
 * Global variant for use with String.match() / String.matchAll().
 */
export const CHINESE_CHAR_REGEX_GLOBAL = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g;

/**
 * Test whether a single character is a CJK ideograph.
 */
export function isChinese(char: string): boolean {
  return CHINESE_CHAR_REGEX.test(char);
}
