import { describe, it, expect } from 'vitest';
import { detectChapterLookup, detectSource } from './detect';
import { parseQimao, parseSfacg, sfacgBookIdFromChapter } from './parse';

describe('detectSource: Qimao', () => {
  const expected = {
    source: 'qimao',
    bookId: '10021482',
    link: 'https://www.qimao.com/shuku/10021482/',
    fetchUrl: 'https://www.qimao.com/shuku/10021482/',
  };

  it('accepts a book link with or without a trailing slash', () => {
    expect(detectSource('https://www.qimao.com/shuku/10021482/')).toEqual(expected);
    expect(detectSource('https://www.qimao.com/shuku/10021482')).toEqual(expected);
  });

  it('normalizes a chapter link to its book', () => {
    expect(detectSource('https://www.qimao.com/shuku/10021482-17698908250004/')).toEqual(expected);
  });

  it('rejects listing pages, which carry no book id', () => {
    expect(detectSource('https://www.qimao.com/shuku/a-202-37-a-a-a-a-click-1/')).toBeNull();
  });
});

describe('detectSource: SFACG', () => {
  const expected = {
    source: 'sfacg',
    bookId: '759334',
    link: 'https://book.sfacg.com/Novel/759334/',
    fetchUrl: 'https://m.sfacg.com/b/759334/',
    extraFetchUrl: 'https://book.sfacg.com/Novel/759334/',
  };

  it('accepts desktop and mobile book links', () => {
    expect(detectSource('https://book.sfacg.com/Novel/759334/')).toEqual(expected);
    expect(detectSource('https://m.sfacg.com/b/759334/')).toEqual(expected);
    expect(detectSource('https://m.sfacg.com/i/759334/')).toEqual(expected);
  });

  it('normalizes a desktop chapter link, which carries the book id', () => {
    expect(detectSource('https://book.sfacg.com/Novel/759334/1006437/9360421/')).toEqual(expected);
  });

  it('cannot resolve a mobile chapter link on its own: it names only the chapter', () => {
    expect(detectSource('https://m.sfacg.com/c/9360421/')).toBeNull();
    expect(detectChapterLookup('https://m.sfacg.com/c/9360421/')).toEqual({
      source: 'sfacg',
      lookupUrl: 'https://m.sfacg.com/c/9360421/',
    });
  });
});

describe('detectChapterLookup', () => {
  it('is only for chapter-only links', () => {
    expect(detectChapterLookup('https://m.sfacg.com/b/759334/')).toBeNull();
    expect(detectChapterLookup('https://www.qimao.com/shuku/10021482-17698908250004/')).toBeNull();
    expect(detectChapterLookup('not a link')).toBeNull();
  });
});

describe('parseQimao', () => {
  const ref = detectSource('https://www.qimao.com/shuku/10021482/')!;
  const html = `<html><body>
<script>window.__NUXT__=(function(a,b){return {title:a}}("x",1));</script>
<div class="book-detail-info">
  <div class="book-information clearfix left">
    <div class="wrap-pic"><img src="https://cdn.wtzw.com/bookimg/public/images/cover/f0e5/abc_360x480.png" width="195px"></div>
    <div class="wrap-txt">
      <div class="title clearfix"><span class="txt">每日一门神通大成</span> <span class="score">8.9<em>分</em></span></div>
      <div class="tags-wrap">
        <em class="qm-tag tag green middle">完结</em>
        <em class="qm-tag tag border middle"><a href="https://www.qimao.com/shuku/a-202-a/"> 玄幻奇幻 </a></em>
        <em class="qm-tag tag border middle"><a href="https://www.qimao.com/shuku/a-202-37/"> 东方玄幻 </a></em>
      </div>
      <div class="sub-title">
        <span class="txt">作者： <em><a href="https://www.qimao.com/zuozhe/x_574/"> 努力吃鱼 </a></em></span>
        <span class="txt"> 主角： <em> 陈斐 </em></span>
      </div>
    </div>
  </div>
</div>
<div class="book-introduction">
  <div class="book-introduction-item"><div class="qm-with-title-th"><span>简介</span></div>
    <div class="qm-with-title-tb"><p class="intro">修炼难，难于上青天。
【极山呼吸法圆满！】
陈斐：“……”</p></div></div>
  <div class="book-introduction-item"><div class="qm-with-title-th"><span>第一章 呼吸就能变强</span></div>
    <div class="qm-with-title-tb"><div class="article mask"><p>平阴县。</p></div></div></div>
</div>
</body></html>`;

  it('reads the server-rendered book page, taking the synopsis and not the first-chapter excerpt', () => {
    expect(parseQimao(html, ref)).toEqual({
      source: 'qimao',
      bookId: '10021482',
      link: 'https://www.qimao.com/shuku/10021482/',
      title: '每日一门神通大成',
      author: '努力吃鱼',
      intro: '修炼难，难于上青天。\n【极山呼吸法圆满！】\n陈斐：“……”',
      coverUrls: [
        'https://cdn.wtzw.com/bookimg/public/images/cover/f0e5/abc_360x480.png',
        'https://cdn.wtzw.com/bookimg/public/images/cover/f0e5/abc.png',
      ],
      category: '玄幻奇幻',
      tags: ['东方玄幻'],
    });
  });

  it('throws a readable error when the page is not a book page', () => {
    expect(() => parseQimao('<html><body>404</body></html>', ref)).toThrow(/Qimao/);
  });
});

describe('parseSfacg', () => {
  const ref = detectSource('https://book.sfacg.com/Novel/759334/')!;
  const mobile = `<html><body>
<ul class="book_info">
  <li><span class="book_newtitle">仙子，再哈气你真有点欠爱了</span>
    <div class="book_info2"><span>古风</span><span>已完结</span> <span>VIP</span> <label>十三征长篇</label></div>
    <span class="book_info3">合雪丶 / 2044302字<br>26-09-14 13:05</span></li>
  <li><img src="//rs.sfacg.com/web/novel/images/NovelCover/Big/2026/05/cover.jpg"></li>
</ul>
<ul class="book_profile">
  <li>作品简介</li>
  <li class="book_bk_qs1">    你们修行求长生，出生起便站在山顶，俯瞰山下蝼蚁。

    我只是想活下去。

    唯一主线任务：活下去！</li>
</ul>
<div class="book_bk_qs1"><ul class="book_xq_pinglun"><li>简评</li></ul></div>
</body></html>`;
  const desktop = `<html><body>
<p class="introduce">你们修行求长生，出生起便站在山顶，俯瞰山下蝼蚁。 ...</p>
<ul class="tag-list clearfix">
  <li class="tag"><a class="highlight"><span class="icn"></span><span class="text">恋爱</span></a></li>
  <li class="tag"><a class="highlight"><span class="icn"></span><span class="text">仙侠</span></a></li>
</ul>
</body></html>`;

  it('takes the full synopsis from the mobile page and the tags from the desktop page', () => {
    expect(parseSfacg(mobile, ref, desktop)).toEqual({
      source: 'sfacg',
      bookId: '759334',
      link: 'https://book.sfacg.com/Novel/759334/',
      title: '仙子，再哈气你真有点欠爱了',
      author: '合雪丶',
      intro: '你们修行求长生，出生起便站在山顶，俯瞰山下蝼蚁。\n我只是想活下去。\n唯一主线任务：活下去！',
      coverUrls: ['https://rs.sfacg.com/web/novel/images/NovelCover/Big/2026/05/cover.jpg'],
      category: '古风',
      tags: ['恋爱', '仙侠'],
    });
  });

  it('still returns the book, without tags, when the desktop page is unavailable', () => {
    const book = parseSfacg(mobile, ref);
    expect(book.title).toBe('仙子，再哈气你真有点欠爱了');
    expect(book.tags).toEqual([]);
  });

  it('throws a readable error when the page is not a book page', () => {
    expect(() => parseSfacg('<html><body>出错了</body></html>', ref)).toThrow(/SFACG/);
  });
});

describe('sfacgBookIdFromChapter', () => {
  it('reads the book id from the back link of a mobile chapter page', () => {
    const html = '<a href="/b/759334/">返回</a> <a href="/i/759334">上一章</a>';
    expect(sfacgBookIdFromChapter(html)).toBe('759334');
  });

  it('asks for a book link when the chapter page has no back link', () => {
    expect(() => sfacgBookIdFromChapter('<html>404</html>')).toThrow(/link trang truyện/);
  });
});
