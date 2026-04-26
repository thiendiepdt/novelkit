import { describe, it, expect } from 'vitest';
import { isChinese, CHINESE_CHAR_REGEX, CHINESE_CHAR_REGEX_GLOBAL } from './regex';

describe('isChinese', () => {
  it('should return true for CJK Unified Ideographs', () => {
    expect(isChinese('你')).toBe(true);
    expect(isChinese('好')).toBe(true);
    expect(isChinese('世')).toBe(true);
  });

  it('should return false for Latin characters', () => {
    expect(isChinese('A')).toBe(false);
    expect(isChinese('z')).toBe(false);
  });

  it('should return false for digits', () => {
    expect(isChinese('0')).toBe(false);
    expect(isChinese('9')).toBe(false);
  });

  it('should return false for punctuation', () => {
    expect(isChinese('.')).toBe(false);
    expect(isChinese('!')).toBe(false);
  });

  it('should return false for Vietnamese diacritics', () => {
    expect(isChinese('ế')).toBe(false);
    expect(isChinese('ạ')).toBe(false);
  });
});

describe('CHINESE_CHAR_REGEX', () => {
  it('should match Chinese characters in a string', () => {
    expect(CHINESE_CHAR_REGEX.test('Hello你好')).toBe(true);
  });

  it('should not match pure Latin strings', () => {
    expect(CHINESE_CHAR_REGEX.test('Hello World')).toBe(false);
  });
});

describe('CHINESE_CHAR_REGEX_GLOBAL', () => {
  it('should find all Chinese characters', () => {
    const matches = 'Hello你好世界Test'.match(CHINESE_CHAR_REGEX_GLOBAL);
    expect(matches).toEqual(['你', '好', '世', '界']);
  });

  it('should return null for no matches', () => {
    const matches = 'No Chinese here'.match(CHINESE_CHAR_REGEX_GLOBAL);
    expect(matches).toBeNull();
  });
});
