import { describe, it, expect } from 'vitest';
import { detectSource } from './detect';

describe('detectSource', () => {
  it('resolves qidian desktop, mobile, info and chapter links to the same book', () => {
    for (const link of [
      'https://www.qidian.com/book/1010868264/',
      'https://m.qidian.com/book/1010868264',
      'https://book.qidian.com/info/1010868264',
      'https://www.qidian.com/chapter/1010868264/736925757/',
    ]) {
      expect(detectSource(link)).toEqual({
        source: 'qidian',
        bookId: '1010868264',
        link: 'https://www.qidian.com/book/1010868264/',
        fetchUrl: 'https://m.qidian.com/book/1010868264/',
      });
    }
  });

  it('resolves fanqie page links and share links carrying book_id', () => {
    const expected = {
      source: 'fanqie',
      bookId: '7069948840148732967',
      link: 'https://fanqienovel.com/page/7069948840148732967',
      fetchUrl: 'https://fanqienovel.com/page/7069948840148732967',
    };
    expect(detectSource('https://fanqienovel.com/page/7069948840148732967?enter_from=search')).toEqual(expected);
    expect(detectSource(' https://changdunovel.com/wap/share-v2.html?aid=1967&book_id=7069948840148732967 ')).toEqual(expected);
  });

  it('rejects a fanqie chapter link, which carries no book id', () => {
    expect(detectSource('https://fanqienovel.com/reader/7069949322237805070')).toBeNull();
  });

  it('resolves qq links, including the 1e9-offset id form', () => {
    const expected = {
      source: 'qq',
      bookId: '59366432',
      link: 'https://book.qq.com/book-detail/59366432',
      fetchUrl: 'https://detailadr.reader.qq.com/book/queryDetailPage?bid=59366432&sex=1&qmk=1,3,7,9,10',
    };
    expect(detectSource('https://book.qq.com/book-detail/59366432')).toEqual(expected);
    expect(detectSource('https://ubook.reader.qq.com/book-detail/1059366432')).toEqual(expected);
    expect(detectSource('https://m.e-book.qq.com/book/59366432.html')).toEqual(expected);
  });

  it('returns null for unsupported sites and non-links', () => {
    expect(detectSource('https://www.jjwxc.net/onebook.php?novelid=123456')).toBeNull();
    expect(detectSource('https://notqidian.com.evil.example/book/1010868264/')).toBeNull();
    expect(detectSource('1010868264')).toBeNull();
    expect(detectSource('')).toBeNull();
  });
});
