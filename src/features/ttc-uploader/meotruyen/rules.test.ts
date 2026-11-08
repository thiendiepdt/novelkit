import { describe, expect, it } from 'vitest';
import { chapterBatches, countWords, formatChapterFile, isWebLink } from './rules';

describe('formatChapterFile', () => {
  it('keeps one paragraph per non-empty line, trimmed, a blank line apart', () => {
    expect(formatChapterFile('  Đoạn một.  \r\n\r\n\r\n　　Đoạn hai.\n   \nĐoạn ba.', 3)).toEqual({
      heading: null,
      text: 'Đoạn một.\n\nĐoạn hai.\n\nĐoạn ba.',
    });
  });

  it("takes out a first line that is this chapter's heading, and only that one", () => {
    expect(formatChapterFile('Chương 12: Gặp lại\nNội dung.', 12)).toEqual({ heading: 'Chương 12: Gặp lại', text: 'Nội dung.' });
    expect(formatChapterFile('第12章 重逢\n内容', 12).heading).toBe('第12章 重逢');
    expect(formatChapterFile('Chương 012 - A\nB', 12).heading).toBe('Chương 012 - A');
    // Another number, or a sentence that happens to start with "Chương".
    expect(formatChapterFile('Chương 13: Khác\nB', 12).heading).toBeNull();
    expect(formatChapterFile('Chương 120 bắt đầu\nB', 12).heading).toBeNull();
  });
});

describe('chapterBatches', () => {
  it('cuts at the chapter count and at the byte ceiling, in order', () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({ number: i + 1, bytes: 10 }));
    expect(chapterBatches(entries, 2, 1000)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chapterBatches(entries, 100, 25)).toEqual([[1, 2], [3, 4], [5]]);
    // A chapter bigger than the ceiling still goes, alone.
    expect(chapterBatches([{ number: 1, bytes: 50 }, { number: 2, bytes: 5 }], 100, 20)).toEqual([[1], [2]]);
  });
});

describe('countWords / isWebLink', () => {
  it('counts words by whitespace and takes http(s) links only', () => {
    expect(countWords('  một  hai\nba ')).toBe(3);
    expect(countWords('   ')).toBe(0);
    expect(isWebLink('https://fanqienovel.com/page/1')).toBe(true);
    expect(isWebLink('ftp://x.com')).toBe(false);
    expect(isWebLink('không phải link')).toBe(false);
  });
});
