import { CHINESE_CHAR_REGEX_GLOBAL } from '@/shared/utils/regex';

export interface FormatResult {
  /** Formatted text output */
  text: string;
  /** Total character count (excluding whitespace) */
  charCount: number;
  /** Total character count (including whitespace) */
  charCountWithSpaces: number;
  /** Number of paragraphs */
  paragraphCount: number;
  /** Whether the text contains Chinese characters */
  hasChinese: boolean;
  /** Array of unique Chinese characters found */
  chineseChars: string[];
}

/**
 * Format novel text:
 * 1. Remove leading tabs/spaces from each line
 * 2. Collapse multiple blank lines into exactly one blank line between paragraphs
 * 3. Ensure each paragraph is separated by one blank line
 * 4. Trim trailing whitespace
 */
export function formatText(rawInput: string): FormatResult {
  // Normalize line endings
  const text = rawInput.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into lines
  const lines = text.split('\n');

  // Process each line: trim leading whitespace (tabs + spaces) and trailing whitespace
  const trimmedLines = lines.map((line) => line.replace(/^[\t ]+/, '').trimEnd());

  // Each non-empty line = one paragraph, separated by blank lines
  const paragraphs = trimmedLines.filter((line) => line.length > 0);

  // Join paragraphs with blank line separator
  const formatted = paragraphs.join('\n\n').trim();

  // Detect Chinese characters
  const chineseMatches = formatted.match(CHINESE_CHAR_REGEX_GLOBAL) || [];
  const uniqueChinese = [...new Set(chineseMatches)];

  // Count characters (excluding whitespace)
  const charCount = formatted.replace(/\s/g, '').length;
  const charCountWithSpaces = formatted.length;

  return {
    text: formatted,
    charCount,
    charCountWithSpaces,
    paragraphCount: paragraphs.length,
    hasChinese: uniqueChinese.length > 0,
    chineseChars: uniqueChinese,
  };
}
