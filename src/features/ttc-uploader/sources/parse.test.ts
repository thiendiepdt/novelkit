import { describe, it, expect } from 'vitest';
import { cleanIntro, fanqieCovers, parseFanqie, parseQidian, parseQq } from './parse';
import type { SourceRef } from './types';

const ref = (source: SourceRef['source'], bookId: string): SourceRef => ({
  source,
  bookId,
  link: `https://example.test/${bookId}`,
  fetchUrl: `https://example.test/fetch/${bookId}`,
});

describe('cleanIntro', () => {
  it('turns <br> and indentation into one clean paragraph per line', () => {
    expect(cleanIntro('　　第一段。<br>　　第二段。<br><br>\r\n  第三段  ')).toBe('第一段。\n第二段。\n第三段');
  });

  it('handles missing input', () => {
    expect(cleanIntro(undefined)).toBe('');
  });
});

describe('fanqieCovers', () => {
  it('turns a signed, resized thumbnail into unsigned candidates: 640px first, original as fallback', () => {
    expect(
      fanqieCovers('https://p3-novel-sign.byteimg.com/novel-pic/83d326b6~tplv-resize:225:300.image?lk3s=1&x-expires=2&x-signature=abc'),
    ).toEqual([
      'https://p6-novel.byteimg.com/novel-pic/83d326b6~tplv-shrink:640:0.image',
      'https://p6-novel.byteimg.com/origin/novel-pic/83d326b6',
    ]);
  });

  it('has no candidates when the page has no thumbnail', () => {
    expect(fanqieCovers('')).toEqual([]);
  });
});

describe('parseFanqie', () => {
  const page = {
    bookName: '部族荣光',
    author: '丧狐',
    authorName: '丧狐',
    abstract: '第一段。\n　　第二段。\n',
    description: '我是丧狐。',
    thumbUri: 'https://p3-novel-sign.byteimg.com/novel-pic/abc~tplv-resize:225:300.image?x-signature=s',
    categoryV2: JSON.stringify([
      { Name: '传统玄幻', Gender: 1 },
      { Name: '玄幻', Gender: 1 },
      { Name: '升级流', Gender: 1 },
    ]),
    creationStatus: 0,
  };
  // __INITIAL_STATE__ is a JS literal: `undefined` and trailing commas must be tolerated.
  const literal = `{"common":{"x":undefined},"page":${JSON.stringify(page).replace(/}$/, ',}')},}`;
  const html = `<html><script>window.__INITIAL_STATE__=${literal};</script></html>`;

  it('reads title, author, synopsis, cover, categories and audience', () => {
    expect(parseFanqie(html, ref('fanqie', '7069948840148732967'))).toEqual({
      source: 'fanqie',
      bookId: '7069948840148732967',
      link: 'https://example.test/7069948840148732967',
      title: '部族荣光',
      author: '丧狐',
      intro: '第一段。\n第二段。',
      coverUrls: [
        'https://p6-novel.byteimg.com/novel-pic/abc~tplv-shrink:640:0.image',
        'https://p6-novel.byteimg.com/origin/novel-pic/abc',
      ],
      category: '传统玄幻',
      tags: ['玄幻', '升级流'],
      genderHint: 'Nam',
    });
  });

  it('throws a readable error when the state is missing or has no book', () => {
    expect(() => parseFanqie('<html>captcha</html>', ref('fanqie', '1'))).toThrow(/Fanqie/);
    expect(() => parseFanqie('<script>window.__INITIAL_STATE__={"page":{}};</script>', ref('fanqie', '1'))).toThrow(/không trả về/);
  });
});

describe('parseQidian', () => {
  const ctx = {
    pageContext: {
      pageProps: {
        pageData: {
          gender: 'male',
          bookInfo: {
            bookName: '诡秘之主',
            authorName: '爱潜水的乌贼',
            desc: '　　蒸汽与机械的浪潮中，谁能触及非凡？<br>　　我从诡秘中醒来。',
            chanName: '玄幻',
            subCateName: '异世大陆',
            bookTag: { tagName: '轻小说' },
            bookLabels: [{ tag: '克苏鲁' }, '蒸汽朋克'],
          },
        },
      },
    },
  };
  const html = `<html><script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify(ctx)}</script></html>`;

  it('reads the SSR page context', () => {
    expect(parseQidian(html, ref('qidian', '1010868264'))).toEqual({
      source: 'qidian',
      bookId: '1010868264',
      link: 'https://example.test/1010868264',
      title: '诡秘之主',
      author: '爱潜水的乌贼',
      intro: '蒸汽与机械的浪潮中，谁能触及非凡？\n我从诡秘中醒来。',
      coverUrls: ['https://bookcover.yuewen.com/qdbimg/349573/1010868264/600'],
      category: '玄幻',
      tags: ['异世大陆', '轻小说', '克苏鲁', '蒸汽朋克'],
      genderHint: 'Nam',
    });
  });

  it('throws a readable error on the anti-bot probe page', () => {
    expect(() => parseQidian('<html><script src="/probe.js"></script></html>', ref('qidian', '1'))).toThrow(/Qidian/);
  });
});

describe('parseQq', () => {
  const payload = {
    introinfo: {
      book: {
        title: '长生为猫',
        author: '风里猫',
        intro: '被大运撞了。\r\n\r\n狗都不看，我看！',
        coverUrl: 'https://ccstatic-1252317822.file.myqcloud.com/c.jpg',
        categoryname: '仙侠',
        sexAttr: 1,
      },
    },
    cate2Info: { cate2Name: '仙侠' },
    cate3Info: { cate3Name: '幻修' },
    bookTags: [{ tagshortname: '穿越' }, { tagshortname: '修仙' }, { tagshortname: '穿越' }],
  };

  it('reads the detail payload', () => {
    expect(parseQq(JSON.stringify(payload), ref('qq', '59366432'))).toEqual({
      source: 'qq',
      bookId: '59366432',
      link: 'https://example.test/59366432',
      title: '长生为猫',
      author: '风里猫',
      intro: '被大运撞了。\n狗都不看，我看！',
      coverUrls: [
        'https://ccstatic-1252317822.file.myqcloud.com/c.jpg',
        'https://bookcover.reader.qq.com/cover/432/59366432/t9_59366432.webp',
      ],
      category: '仙侠',
      tags: ['幻修', '穿越', '修仙'],
      genderHint: 'Nam',
    });
  });

  it('falls back to the bookcover CDN when the payload has no cover', () => {
    const noCover = { ...payload, introinfo: { book: { ...payload.introinfo.book, coverUrl: '' } } };
    expect(parseQq(JSON.stringify(noCover), ref('qq', '59366432')).coverUrls).toEqual([
      'https://bookcover.reader.qq.com/cover/432/59366432/t9_59366432.webp',
    ]);
  });

  it('surfaces the server message when the book is missing', () => {
    expect(() => parseQq('{"msg":"书籍不存在","introinfo":{}}', ref('qq', '1'))).toThrow('书籍不存在');
    expect(() => parseQq('<html>403</html>', ref('qq', '1'))).toThrow(/QQ Reading/);
  });
});
