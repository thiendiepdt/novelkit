import { describe, it, expect } from 'vitest';
import { detectSource } from './detect';
import { baiduCovers, ciweimaoCovers, cleanIntro, parseCiweimao, parseFaloo, parseJjwxc } from './parse';

describe('detectSource: Faloo', () => {
  const expected = {
    source: 'faloo',
    bookId: '550081',
    link: 'https://b.faloo.com/550081.html',
    fetchUrl: 'https://b.faloo.com/550081.html',
  };

  it('accepts the book page', () => {
    expect(detectSource('https://b.faloo.com/550081.html')).toEqual(expected);
    expect(detectSource('http://wap.faloo.com/550081.html')).toEqual(expected);
  });

  it('normalizes the chapter list and chapter links to the book', () => {
    expect(detectSource('https://b.faloo.com/html_550_550081/')).toEqual(expected);
    expect(detectSource('https://b.faloo.com/550081_12.html')).toEqual(expected);
  });

  it('rejects listing pages, which carry no book id', () => {
    expect(detectSource('https://b.faloo.com/l_1_30_1.html')).toBeNull();
    expect(detectSource('https://b.faloo.com/tag_3357.html')).toBeNull();
  });
});

describe('detectSource: JJWXC', () => {
  const expected = {
    source: 'jjwxc',
    bookId: '4468196',
    link: 'https://www.jjwxc.net/onebook.php?novelid=4468196',
    fetchUrl: 'https://app.jjwxc.net/androidapi/novelbasicinfo?novelId=4468196',
  };

  it('accepts desktop book and chapter links', () => {
    expect(detectSource('https://www.jjwxc.net/onebook.php?novelid=4468196')).toEqual(expected);
    expect(detectSource('https://www.jjwxc.net/onebook.php?novelid=4468196&chapterid=3')).toEqual(expected);
    expect(detectSource('https://my.jjwxc.net/onebook_vip.php?novelId=4468196&chapterid=40')).toEqual(expected);
  });

  it('accepts mobile book and chapter links', () => {
    expect(detectSource('https://m.jjwxc.net/book2/4468196')).toEqual(expected);
    expect(detectSource('https://m.jjwxc.net/book2/4468196/1')).toEqual(expected);
  });

  it('accepts a link on a renamed or dead jjwxc mirror domain: only the id is used', () => {
    expect(detectSource('https://m.jjwxcbroken.net/book2/4468196/1')).toEqual(expected);
  });

  it('rejects domains that merely contain or imitate the name', () => {
    expect(detectSource('https://notjjwxc.net/book2/4468196')).toBeNull();
    expect(detectSource('https://www.jjwxc.net.evil.example/onebook.php?novelid=4468196')).toBeNull();
  });

  it('rejects jjwxc pages without a novel id', () => {
    expect(detectSource('https://www.jjwxc.net/oneauthor.php?authorid=208622')).toBeNull();
  });
});

describe('detectSource: Ciweimao', () => {
  const expected = {
    source: 'ciweimao',
    bookId: '100339985',
    link: 'https://www.ciweimao.com/book/100339985',
    fetchUrl: 'https://www.ciweimao.com/book/100339985',
  };

  it('normalizes www, mip and wap links to the www book page', () => {
    expect(detectSource('https://www.ciweimao.com/book/100339985')).toEqual(expected);
    expect(detectSource('https://mip.ciweimao.com/book/100339985')).toEqual(expected);
    expect(detectSource('https://wap.ciweimao.com/book/100339985/')).toEqual(expected);
  });

  it('rejects chapter links, which carry no book id', () => {
    expect(detectSource('https://www.ciweimao.com/chapter/108912345')).toBeNull();
  });
});

describe('cleanIntro', () => {
  it('separates paragraphs written back to back as <p> elements', () => {
    expect(cleanIntro('\n<p>第一段。</p><p>第二段。</p>\n<p>第三段。</p>')).toBe('第一段。\n第二段。\n第三段。');
  });
});

describe('parseFaloo', () => {
  const ref = detectSource('https://b.faloo.com/550081.html')!;
  // Faloo declares its Open Graph tags with `name`, not `property`.
  const html = `<html><head>
<meta name="og:novel:category" content="玄幻奇幻"/>
<meta name="og:novel:author" content="剑神无敌"/>
<meta name="og:novel:book_name" content="我能复制天赋"/>
<meta name="og:image" content="http://img.faloo.com/Novel/498x705/1/1030/001030475.jpg"/>
</head><body>
<h1 id="novelName">我能复制天赋</h1>
<div class="T-L-T-C-Box1">
<p>【飞卢小说网独家签约小说：我能复制天赋】</p><p>全民天赋的时代，人与凶兽共存。</p>
<p>超神级天赋，又多了一个！</p>
<p>飞卢小说网提醒您：本小说及人物纯属虚构，如有雷同，纯属巧合，切勿模仿。</p>
</div>
<div class="T-R-T-B2-Box1"><span>小说分类：<span> <a title="玄幻奇幻">玄幻奇幻</a> </span></span></div>
<div class="T-R-T-B2-Box1"><span>小说子类： <a title="转世重生">转世重生</a> </span></div>
<div class="T-R-T-B2-Box1"><span>标签：</span> <a class="LXbq">爽文</a> <a class="LXbq">穿越</a></div>
</body></html>`;

  it('reads names from the meta tags, the synopsis and tags from the markup, and drops the site disclaimer', () => {
    expect(parseFaloo(html, ref)).toEqual({
      source: 'faloo',
      bookId: '550081',
      link: 'https://b.faloo.com/550081.html',
      title: '我能复制天赋',
      author: '剑神无敌',
      intro: '【飞卢小说网独家签约小说：我能复制天赋】\n全民天赋的时代，人与凶兽共存。\n超神级天赋，又多了一个！',
      coverUrls: ['https://img.faloo.com/Novel/498x705/1/1030/001030475.jpg'],
      category: '玄幻奇幻',
      tags: ['转世重生', '爽文', '穿越'],
    });
  });

  it('throws a readable error when the page is not a book page', () => {
    expect(() => parseFaloo('<html><body>404</body></html>', ref)).toThrow(/Faloo/);
  });
});

describe('parseJjwxc', () => {
  const ref = detectSource('https://www.jjwxc.net/onebook.php?novelid=4468196')!;
  const payload = {
    novelId: '4468196',
    novelName: '不可名状的聊天群',
    authorName: '鱼危',
    novelClass: '衍生-无CP-近代现代-轻小说-男主',
    novelTags: '综漫,文野,克苏鲁',
    novelCover: 'https://i4-static.jjwxc.net/tmp/backend/a_300_420.jpg',
    originalCover: 'https://i4-static.jjwxc.net/tmp/backend/a.jpg',
    // The API escapes the synopsis markup.
    novelIntro: '【文案】&lt;br/&gt;穿越至今，金手指迟迟不来。&lt;br/&gt;&lt;br/&gt;立意:探寻未知',
  };

  it('reads the app payload and unescapes the synopsis', () => {
    expect(parseJjwxc(JSON.stringify(payload), ref)).toEqual({
      source: 'jjwxc',
      bookId: '4468196',
      link: 'https://www.jjwxc.net/onebook.php?novelid=4468196',
      title: '不可名状的聊天群',
      author: '鱼危',
      intro: '【文案】\n穿越至今，金手指迟迟不来。\n立意:探寻未知',
      coverUrls: ['https://i4-static.jjwxc.net/tmp/backend/a_300_420.jpg', 'https://i4-static.jjwxc.net/tmp/backend/a.jpg'],
      category: '衍生-无CP-近代现代-轻小说-男主',
      tags: ['综漫', '文野', '克苏鲁'],
    });
  });

  it('tries a small rendition first for a cover hot-linked from Baidu', () => {
    const hotLinked = { ...payload, novelCover: 'https://pic.rmb.bdstatic.com/bjh/portrait/e8210b76.jpeg', originalCover: '' };
    expect(parseJjwxc(JSON.stringify(hotLinked), ref).coverUrls).toEqual([
      'https://pic.rmb.bdstatic.com/bjh/portrait/e8210b76.jpeg@w_600,q_80',
      'https://pic.rmb.bdstatic.com/bjh/portrait/e8210b76.jpeg',
    ]);
  });

  it('surfaces the message of JJWXC when the book is unavailable', () => {
    const blocked = '{"code":"1062","message":"1062:该文已被屏蔽，无法查看","data":{}}';
    expect(() => parseJjwxc(blocked, ref)).toThrow('1062:该文已被屏蔽，无法查看');
    expect(() => parseJjwxc('<html>502</html>', ref)).toThrow(/JJWXC/);
  });
});

describe('ciweimaoCovers', () => {
  it('tries the c1 host first and keeps the host of the page as a fallback', () => {
    expect(ciweimaoCovers('https://e2.kuangxiangit.com/uploads/allimg/c220215/a.jpg')).toEqual([
      'https://c1.kuangxiangit.com/uploads/allimg/c220215/a.jpg',
      'https://e2.kuangxiangit.com/uploads/allimg/c220215/a.jpg',
    ]);
  });

  it('does not duplicate a cover that is already on c1, and leaves other hosts alone', () => {
    expect(ciweimaoCovers('https://c1.kuangxiangit.com/uploads/a.jpg')).toEqual(['https://c1.kuangxiangit.com/uploads/a.jpg']);
    expect(ciweimaoCovers('https://www.ciweimao.com/resources/images/tmp/cover.jpg')).toEqual([
      'https://www.ciweimao.com/resources/images/tmp/cover.jpg',
    ]);
    expect(ciweimaoCovers('')).toEqual([]);
  });
});

describe('baiduCovers', () => {
  it('leaves other hosts and already-processed Baidu URLs alone', () => {
    expect(baiduCovers('https://i4-static.jjwxc.net/tmp/backend/a_300_420.jpg')).toEqual(['https://i4-static.jjwxc.net/tmp/backend/a_300_420.jpg']);
    expect(baiduCovers('https://pic.rmb.bdstatic.com/bjh/a.jpeg@w_300')).toEqual(['https://pic.rmb.bdstatic.com/bjh/a.jpeg@w_300']);
    expect(baiduCovers('https://notbdstatic.com/a.jpeg')).toEqual(['https://notbdstatic.com/a.jpeg']);
    expect(baiduCovers('')).toEqual([]);
  });
});

describe('parseCiweimao', () => {
  const ref = detectSource('https://mip.ciweimao.com/book/100339985')!;
  const html = `<html><head>
<meta property="og:novel:category" content="游戏竞技">
<meta property="og:novel:author" content="永恒之主">
<meta property="og:novel:book_name" content="崩坏，幕后黑手模拟器！">
<meta property="og:image" content="https://e1.kuangxiangit.com/uploads/allimg/c240806/cover.jpg">
</head><body>
<div class="breadcrumb"><a href="/index">首页</a> &gt; <a href="/zhaiwen">宅文</a> &gt; <a href="/book_list/youxishijie/">游戏竞技</a> &gt; 崩坏，幕后黑手模拟器！</div>
<p class="label-box"><span class="label label-warning"> 万订 <i></i></span> <span class="label label-warning"> 精品 <i></i></span></p>
<div class="book-intro"><div class="book-desc">
        （非桃文、节奏慢）【你将其命名为T病毒。】<br>
【这并非灾难。】<br>
......<br>
【你将其命名为陵墓计划。】</div>
  <div class="book-property">小说类别：游戏竞技</div></div>
</body></html>`;

  it('reads the Open Graph tags, the synopsis, and channel + labels as tags', () => {
    expect(parseCiweimao(html, ref)).toEqual({
      source: 'ciweimao',
      bookId: '100339985',
      link: 'https://www.ciweimao.com/book/100339985',
      title: '崩坏，幕后黑手模拟器！',
      author: '永恒之主',
      intro: '（非桃文、节奏慢）【你将其命名为T病毒。】\n【这并非灾难。】\n......\n【你将其命名为陵墓计划。】',
      coverUrls: [
        'https://c1.kuangxiangit.com/uploads/allimg/c240806/cover.jpg',
        'https://e1.kuangxiangit.com/uploads/allimg/c240806/cover.jpg',
      ],
      category: '游戏竞技',
      tags: ['宅文', '万订', '精品'],
    });
  });

  it('throws a readable error when the page is not a book page', () => {
    expect(() => parseCiweimao('<html><body>书籍不存在</body></html>', ref)).toThrow(/Ciweimao/);
  });
});
