import { describe, it, expect } from 'vitest';
import {
  getWordCount,
  countChapterBoundaries,
  detectMultiChapterMode,
  splitChapter,
  splitMultipleChapters,
} from './splitter';

describe('getWordCount', () => {
  it('should return 0 for empty text', () => {
    expect(getWordCount('')).toBe(0);
    expect(getWordCount('   ')).toBe(0);
  });

  it('should count Vietnamese words by whitespace', () => {
    expect(getWordCount('Xin chào thế giới')).toBe(4);
  });

  it('should count Chinese characters individually', () => {
    expect(getWordCount('你好世界')).toBe(4);
  });

  it('should handle mixed content (Chinese takes priority)', () => {
    // When Chinese is detected, it counts all non-whitespace chars
    const count = getWordCount('你好 world');
    expect(count).toBeGreaterThan(0);
  });
});

describe('countChapterBoundaries', () => {
  it('should return 0 for text without chapter headings', () => {
    expect(countChapterBoundaries('Hello world\nNo chapters here')).toBe(0);
  });

  it('should count "Chương N" headings', () => {
    const text = 'Chương 1: Bắt đầu\nContent\nChương 2: Tiếp theo\nMore content';
    expect(countChapterBoundaries(text)).toBe(2);
  });

  it('should be case-insensitive', () => {
    const text = 'CHƯƠNG 1: Test\nchương 2: Test';
    expect(countChapterBoundaries(text)).toBe(2);
  });

  it('should handle chapter numbers without colons', () => {
    const text = 'Chương 1 Bắt đầu\nContent\nChương 2 Tiếp tục';
    expect(countChapterBoundaries(text)).toBe(2);
  });
});

describe('detectMultiChapterMode', () => {
  it('should return false for single chapter', () => {
    expect(detectMultiChapterMode('Chương 1: Test\nContent')).toBe(false);
  });

  it('should return true for 2+ chapters', () => {
    expect(detectMultiChapterMode('Chương 1: A\nContent\nChương 2: B')).toBe(true);
  });
});

describe('splitChapter', () => {
  it('should return empty for empty input', () => {
    const result = splitChapter('', 2000);
    expect(result.parts).toHaveLength(0);
    expect(result.totalWords).toBe(0);
  });

  it('should not split short chapters', () => {
    const input = 'Chương 1: Test\n\nĐoạn văn ngắn';
    const result = splitChapter(input, 2000);
    expect(result.parts).toHaveLength(1);
  });

  it('should split long chapters into multiple parts', () => {
    // Create a long input that exceeds maxWords
    const paragraphs = Array.from({ length: 50 }, (_, i) => `Đoạn văn ${i + 1} với nội dung dài dài dài dài dài dài dài dài dài dài.`);
    const input = `Chương 1: Test\n\n${paragraphs.join('\n\n')}`;
    const result = splitChapter(input, 50);
    expect(result.parts.length).toBeGreaterThan(1);
  });

  it('should include chapter heading with part number in each split', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => `Đoạn ${i + 1} dài dài dài dài dài dài dài dài dài.`);
    const input = `Chương 1: Title\n\n${paragraphs.join('\n\n')}`;
    const result = splitChapter(input, 30);
    if (result.parts.length > 1) {
      expect(result.parts[0].text).toContain('Chương 1: Title (1/');
      expect(result.parts[1].text).toContain('Chương 1: Title (2/');
    }
  });

  it('should merge short last part into previous when minWords is set', () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) =>
      `Đoạn ${i + 1} ${Array(20).fill('chữ').join(' ')}.`
    );
    const input = `Chương 1: Test\n\n${paragraphs.join('\n\n')}`;
    const resultWithMin = splitChapter(input, 50, false, 40);
    const resultWithoutMin = splitChapter(input, 50, false, 0);
    // With min, the last part may be merged, so we should have fewer or equal parts
    expect(resultWithMin.parts.length).toBeLessThanOrEqual(resultWithoutMin.parts.length);
  });
});

describe('splitMultipleChapters', () => {
  it('should return empty for empty input', () => {
    const result = splitMultipleChapters('', 2000);
    expect(result.parts).toHaveLength(0);
    expect(result.chapterCount).toBe(0);
  });

  it('should handle multiple short chapters without splitting', () => {
    const input = 'Chương 1: A\n\nNội dung 1\n\nChương 2: B\n\nNội dung 2';
    const result = splitMultipleChapters(input, 2000);
    expect(result.parts).toHaveLength(2);
    expect(result.chapterCount).toBe(2);
  });

  it('should split a long chapter within multi-chapter input', () => {
    const longContent = Array.from({ length: 30 }, (_, i) =>
      `Đoạn ${i} dài dài dài dài dài dài dài.`
    ).join('\n\n');
    const input = `Chương 1: Short\n\nNgắn\n\nChương 2: Long\n\n${longContent}`;
    const result = splitMultipleChapters(input, 30);
    expect(result.chapterCount).toBe(2);
    expect(result.parts.length).toBeGreaterThan(2); // ch2 should be split
  });

  it('should handle chapter-only entries (heading, no content)', () => {
    const input = 'Chương 1: Empty\n\nChương 2: Also empty';
    const result = splitMultipleChapters(input, 2000);
    expect(result.chapterCount).toBe(2);
    expect(result.parts.length).toBe(2);
  });
});
