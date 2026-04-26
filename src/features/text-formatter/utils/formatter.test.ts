import { describe, it, expect } from 'vitest';
import { formatText } from './formatter';

describe('formatText', () => {
  it('should return empty result for empty input', () => {
    const result = formatText('');
    expect(result.text).toBe('');
    expect(result.charCount).toBe(0);
    expect(result.paragraphCount).toBe(0);
    expect(result.hasChinese).toBe(false);
  });

  it('should return empty result for whitespace-only input', () => {
    const result = formatText('   \n\n   \t\t  ');
    expect(result.text).toBe('');
    expect(result.paragraphCount).toBe(0);
  });

  it('should strip leading tabs and spaces from each line', () => {
    const input = '\tHello\n  World\n\t\t  Foo';
    const result = formatText(input);
    expect(result.text).toBe('Hello\n\nWorld\n\nFoo');
  });

  it('should collapse multiple blank lines into single paragraph separators', () => {
    const input = 'First\n\n\n\n\nSecond\n\n\nThird';
    const result = formatText(input);
    expect(result.text).toBe('First\n\nSecond\n\nThird');
  });

  it('should handle Windows-style line endings (CRLF)', () => {
    const input = 'Line1\r\nLine2\r\n\r\nLine3';
    const result = formatText(input);
    expect(result.text).toBe('Line1\n\nLine2\n\nLine3');
  });

  it('should handle old Mac-style line endings (CR)', () => {
    const input = 'Line1\rLine2\rLine3';
    const result = formatText(input);
    expect(result.text).toBe('Line1\n\nLine2\n\nLine3');
  });

  it('should count paragraphs correctly', () => {
    const input = 'P1\n\nP2\n\nP3\n\nP4';
    const result = formatText(input);
    expect(result.paragraphCount).toBe(4);
  });

  it('should count characters excluding whitespace', () => {
    const input = 'Hello World';
    const result = formatText(input);
    expect(result.charCount).toBe(10); // "HelloWorld"
  });

  it('should count characters including whitespace', () => {
    const input = 'Hello World';
    const result = formatText(input);
    expect(result.charCountWithSpaces).toBe(11);
  });

  it('should detect Chinese characters', () => {
    const input = 'Hello 你好世界';
    const result = formatText(input);
    expect(result.hasChinese).toBe(true);
    expect(result.chineseChars).toContain('你');
    expect(result.chineseChars).toContain('好');
    expect(result.chineseChars).toContain('世');
    expect(result.chineseChars).toContain('界');
  });

  it('should return unique Chinese characters only', () => {
    const input = '你你你好好';
    const result = formatText(input);
    expect(result.chineseChars).toEqual(['你', '好']);
  });

  it('should report no Chinese for pure Latin text', () => {
    const input = 'This is a pure English text with no Chinese.';
    const result = formatText(input);
    expect(result.hasChinese).toBe(false);
    expect(result.chineseChars).toEqual([]);
  });

  it('should handle mixed Vietnamese and Chinese text', () => {
    const input = 'Chương 1: Bắt đầu 了解';
    const result = formatText(input);
    expect(result.hasChinese).toBe(true);
    expect(result.chineseChars.length).toBe(2);
  });

  it('should trim trailing whitespace', () => {
    const input = 'Hello   \n\n  World   ';
    const result = formatText(input);
    expect(result.text).toBe('Hello\n\nWorld');
  });
});
