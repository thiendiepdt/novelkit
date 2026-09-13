import { describe, it, expect } from 'vitest';
import {
  getWordCount,
  countChapterBoundaries,
  detectMultiChapterMode,
  splitChapter,
  splitMultipleChapters,
  splitFilesByFirstLine,
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

describe('splitFilesByFirstLine', () => {
  it('should return empty for no files', () => {
    const result = splitFilesByFirstLine([], 2000);
    expect(result.parts).toHaveLength(0);
    expect(result.chapterCount).toBe(0);
  });

  it('should use the first non-empty line of each file as the chapter title', () => {
    const files = [
      { name: '0001.txt', text: '01 Ta nói ba câu\n\nNội dung 1\n\nĐoạn 2' },
      { name: '0002.txt', text: '\n\n  02 Chuyện xấu đều là ta làm  \nNội dung 2' },
    ];
    const result = splitFilesByFirstLine(files, 2000);
    expect(result.chapterCount).toBe(2);
    expect(result.parts).toHaveLength(2);
    expect(result.parts[0].title).toBe('01 Ta nói ba câu');
    expect(result.parts[0].content).toBe('Nội dung 1\n\nĐoạn 2');
    expect(result.parts[0].fileName).toBe('0001.txt');
    expect(result.parts[1].title).toBe('02 Chuyện xấu đều là ta làm');
    expect(result.parts[1].content).toBe('Nội dung 2');
    expect(result.parts[1].fileName).toBe('0002.txt');
  });

  it('should skip empty files', () => {
    const files = [
      { name: 'blank.txt', text: '\n\n  \n' },
      { name: '0001.txt', text: 'Tiêu đề\n\nNội dung' },
    ];
    const result = splitFilesByFirstLine(files, 2000);
    expect(result.chapterCount).toBe(1);
    expect(result.parts[0].title).toBe('Tiêu đề');
  });

  it('should handle a file that only has a title line', () => {
    const result = splitFilesByFirstLine([{ name: 'a.txt', text: 'Chỉ có tiêu đề' }], 2000);
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].title).toBe('Chỉ có tiêu đề');
    expect(result.parts[0].content).toBe('');
  });

  it('should split a long file into parts with (X/Y) suffix', () => {
    const longContent = Array.from({ length: 30 }, (_, i) =>
      `Đoạn ${i} dài dài dài dài dài dài dài.`
    ).join('\n\n');
    const result = splitFilesByFirstLine([{ name: 'a.txt', text: `Tiêu đề dài\n\n${longContent}` }], 30);
    expect(result.chapterCount).toBe(1);
    expect(result.parts.length).toBeGreaterThan(1);
    expect(result.parts[0].title).toBe(`Tiêu đề dài (1/${result.parts.length})`);
    expect(result.parts.every(p => p.fileName === 'a.txt')).toBe(true);
  });

  it('should not split chapters before splitFromChapter', () => {
    const longContent = Array.from({ length: 30 }, (_, i) =>
      `Đoạn ${i} dài dài dài dài dài dài dài.`
    ).join('\n\n');
    const files = [
      { name: '1.txt', text: `Một\n\n${longContent}` },
      { name: '2.txt', text: `Hai\n\n${longContent}` },
    ];
    const result = splitFilesByFirstLine(files, 30, true, 0, 2);
    const fromOne = result.parts.filter(p => p.fileName === '1.txt');
    const fromTwo = result.parts.filter(p => p.fileName === '2.txt');
    expect(fromOne).toHaveLength(1);
    expect(fromOne[0].title).toBe('Một');
    expect(fromTwo.length).toBeGreaterThan(1);
  });
});
