/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SourceBook, SourceRef } from './types';

/** One paragraph per line: drop HTML breaks/tags, indentation and blank lines. */
export function cleanIntro(raw: unknown): string {
  return String(raw ?? '')
    .replace(/<br\s*\/?>|<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

function uniq(values: unknown[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const s = str(v);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function base(ref: SourceRef): Pick<SourceBook, 'source' | 'bookId' | 'link'> {
  return { source: ref.source, bookId: ref.bookId, link: ref.link };
}

// ─── Fanqie ────────────────────────────────────────────────

/**
 * Cover candidates for a Fanqie thumbnail, best first.
 *
 * The page's own thumbnail URL is signed (it expires) and tiny. The same image path on
 * p6-novel.byteimg.com is served unsigned, with no referer check, in two forms:
 *  1. `{path}~tplv-shrink:640:0.image` — capped at 640px wide: plenty for a cover, and
 *     about a quarter of the bytes of the original;
 *  2. `origin/{path}` — the full-size original, kept as a fallback.
 * The CDN is flaky from outside mainland China, so both are worth having.
 */
export function fanqieCovers(url: string): string[] {
  const m = url.match(/^https?:\/\/[^/]+\/(.+)$/);
  const path = m?.[1].split('?')[0].split('~')[0];
  if (!path) return url ? [url] : [];
  const host = 'https://p6-novel.byteimg.com';
  return [`${host}/${path}~tplv-shrink:640:0.image`, `${host}/origin/${path}`];
}

/** fanqienovel.com/page/{id}: everything is in `window.__INITIAL_STATE__` (a JS literal, not JSON). */
export function parseFanqie(html: string, ref: SourceRef): SourceBook {
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) throw new Error('Không đọc được dữ liệu trang Fanqie (trang đổi cấu trúc hoặc bị chặn)');

  let state: any;
  try {
    state = JSON.parse(
      m[1]
        .replace(/\bundefined\b/g, 'null')
        .replace(/\bNaN\b/g, 'null')
        .replace(/,\s*([}\]])/g, '$1'),
    );
  } catch {
    throw new Error('Dữ liệu trang Fanqie không hợp lệ');
  }

  const page = state?.page ?? {};
  if (!str(page.bookName)) throw new Error('Fanqie không trả về thông tin truyện (sai link hoặc truyện đã gỡ)');

  let cats: any[] = [];
  try {
    const raw = typeof page.categoryV2 === 'string' ? JSON.parse(page.categoryV2) : page.categoryV2;
    if (Array.isArray(raw)) cats = raw;
  } catch {
    cats = [];
  }
  const names = uniq(cats.map((c) => c?.Name));
  const gender = cats.length ? Number(cats[0]?.Gender) : NaN;
  const thumb = str(page.thumbUri) || str(page.thumbUrl);

  return {
    ...base(ref),
    title: str(page.bookName),
    author: str(page.authorName) || str(page.author),
    intro: cleanIntro(page.abstract),
    coverUrls: fanqieCovers(thumb),
    category: names[0] ?? str(page.category),
    tags: names.slice(1),
    genderHint: gender === 1 ? 'Nam' : gender === 0 ? 'Nữ' : undefined,
  };
}

// ─── Qidian ────────────────────────────────────────────────

/** m.qidian.com/book/{id}/: SSR page context embedded as a JSON script tag. */
export function parseQidian(html: string, ref: SourceRef): SourceBook {
  const m = html.match(/<script id="vite-plugin-ssr_pageContext" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Không đọc được dữ liệu trang Qidian (trang đổi cấu trúc hoặc bị chặn)');

  let pageData: any;
  try {
    pageData = JSON.parse(m[1])?.pageContext?.pageProps?.pageData;
  } catch {
    throw new Error('Dữ liệu trang Qidian không hợp lệ');
  }

  const info = pageData?.bookInfo ?? {};
  if (!str(info.bookName)) throw new Error('Qidian không trả về thông tin truyện (sai link hoặc truyện đã gỡ)');

  const labels: unknown[] = Array.isArray(info.bookLabels)
    ? info.bookLabels.map((l: any) => (typeof l === 'string' ? l : l?.tag ?? l?.tagName ?? l?.name))
    : [];
  const gender = str(pageData.gender).toLowerCase();

  return {
    ...base(ref),
    title: str(info.bookName),
    author: str(info.authorName),
    intro: cleanIntro(info.desc),
    coverUrls: [`https://bookcover.yuewen.com/qdbimg/349573/${ref.bookId}/600`],
    category: str(info.chanName),
    tags: uniq([info.subCateName, info.bookTag?.tagName, ...labels]),
    genderHint: gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : undefined,
  };
}

// ─── QQ Reading ────────────────────────────────────────────

/** detailadr.reader.qq.com/book/queryDetailPage: public JSON, no signature. */
export function parseQq(text: string, ref: SourceRef): SourceBook {
  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('QQ Reading trả về dữ liệu không hợp lệ');
  }

  const book = j?.introinfo?.book;
  if (!str(book?.title)) {
    throw new Error(str(j?.msg) || 'QQ Reading không trả về thông tin truyện (sai link hoặc truyện đã gỡ)');
  }

  const n = Number(ref.bookId);
  const sex = Number(book.sexAttr);
  const tagNames: unknown[] = Array.isArray(j.bookTags)
    ? j.bookTags.map((t: any) => t?.tagshortname ?? t?.tagname)
    : [];

  return {
    ...base(ref),
    title: str(book.title),
    author: str(book.author),
    intro: cleanIntro(book.intro),
    // The payload's own cover first, then the bookcover CDN (always derivable from the bid).
    coverUrls: uniq([book.coverUrl, `https://bookcover.reader.qq.com/cover/${n % 1000}/${n}/t9_${n}.webp`]),
    category: str(j.cate2Info?.cate2Name) || str(book.categoryname),
    tags: uniq([j.cate3Info?.cate3Name, ...tagNames]),
    genderHint: sex === 1 ? 'Nam' : sex === 2 ? 'Nữ' : undefined,
  };
}

// ─── HTML-rendered sources (Qimao, SFACG) ──────────────────

const parseHtml = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

/** Text of an element with whitespace collapsed ('' when the element is missing). */
const text = (el: Element | null | undefined) => str(el?.textContent).replace(/\s+/g, ' ');

/** Protocol-relative and http image URLs, as https (the image fetcher only allows https). */
function httpsUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  return url.replace(/^http:\/\//i, 'https://');
}

/**
 * www.qimao.com/shuku/{id}/ is server-rendered. Its embedded `__NUXT__` state is a
 * minified JS program rather than data, so the markup is read instead.
 */
export function parseQimao(html: string, ref: SourceRef): SourceBook {
  const info = parseHtml(html).querySelector('.book-information');
  const title = text(info?.querySelector('.title .txt'));
  if (!info || !title) {
    throw new Error('Không đọc được dữ liệu trang Qimao (sai link, truyện đã gỡ hoặc trang đổi cấu trúc)');
  }

  const authorRow = Array.from(info.querySelectorAll('.sub-title .txt')).find((el) => el.textContent?.includes('作者'));
  // Linked tags are categories, broad one first; the unlinked tag is the serial status.
  const categories = uniq(Array.from(info.querySelectorAll('.tags-wrap .qm-tag a')).map((a) => text(a)));
  // The page shows a 360x480 rendition; the same path without the suffix is the original.
  const cover = httpsUrl(str(info.querySelector('.wrap-pic img')?.getAttribute('src')));

  return {
    ...base(ref),
    title,
    author: text(authorRow?.querySelector('em')),
    intro: cleanIntro(info.ownerDocument.querySelector('.book-introduction p.intro')?.textContent),
    coverUrls: uniq([cover, cover.replace(/_\d+x\d+(\.\w+)$/, '$1')]),
    category: categories[0] ?? '',
    tags: categories.slice(1),
  };
}

/**
 * SFACG splits what we need across two pages: m.sfacg.com/b/{id}/ has the full synopsis
 * (the desktop page cuts it off with "..."), book.sfacg.com/Novel/{id}/ has the tags.
 * `desktopHtml` is optional: without it the book simply has no tags.
 */
export function parseSfacg(mobileHtml: string, ref: SourceRef, desktopHtml?: string): SourceBook {
  const doc = parseHtml(mobileHtml);
  const title = text(doc.querySelector('.book_newtitle'));
  if (!title) {
    throw new Error('Không đọc được dữ liệu trang SFACG (sai link, truyện đã gỡ hoặc trang đổi cấu trúc)');
  }

  // "{author} / {word count}字{updated}"
  const author = text(doc.querySelector('.book_info3')).split(' / ')[0].trim();
  const cover = httpsUrl(str(doc.querySelector('.book_info img')?.getAttribute('src')));
  const tags = desktopHtml
    ? uniq(Array.from(parseHtml(desktopHtml).querySelectorAll('.tag-list .tag .text')).map((el) => text(el)))
    : [];

  return {
    ...base(ref),
    title,
    author,
    intro: cleanIntro(doc.querySelector('.book_profile .book_bk_qs1')?.textContent),
    coverUrls: cover ? [cover] : [],
    // First badge is the type (古风, 魔幻, 都市...); the rest are status/VIP markers.
    category: text(doc.querySelector('.book_info2 span')),
    tags,
  };
}

/** m.sfacg.com/c/{chapterId}/ names no book; its "返回" link points at /b/{bookId}/. */
export function sfacgBookIdFromChapter(html: string): string {
  const m = html.match(/href="\/b\/(\d+)\/?"/);
  if (!m) throw new Error('Không tìm được truyện từ link chương SFACG này. Hãy dán link trang truyện.');
  return m[1];
}

// ─── Faloo, JJWXC, Ciweimao ────────────────────────────────

/**
 * Content of an Open Graph meta tag ('' when absent). The standard attribute is `property`,
 * but some sites (Faloo) declare the same tags with `name`.
 */
const ogMeta = (doc: Document, key: string) =>
  str(doc.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content'));

/** `&lt;br/&gt;` → `<br/>`: undo one level of HTML escaping (JJWXC escapes its synopsis). */
function decodeEntities(escaped: string): string {
  const area = document.createElement('textarea');
  area.innerHTML = escaped;
  return area.value;
}

/** Faloo appends its own legal notice to every synopsis. */
const FALOO_DISCLAIMER = /^飞卢小说网提醒您/;

/**
 * b.faloo.com/{id}.html. The page is GB2312; the Rust side decodes it (reqwest `charset`
 * feature) so this receives proper text. Names come from the Open Graph tags, the
 * synopsis and tags from the markup.
 */
export function parseFaloo(html: string, ref: SourceRef): SourceBook {
  const doc = parseHtml(html);
  const title = ogMeta(doc, 'og:novel:book_name') || text(doc.querySelector('#novelName'));
  if (!title) {
    throw new Error('Không đọc được dữ liệu trang Faloo (sai link, truyện đã gỡ hoặc trang đổi cấu trúc)');
  }

  const rows = Array.from(doc.querySelectorAll('.T-R-T-B2-Box1'));
  const subCategory = text(rows.find((row) => row.textContent?.includes('小说子类'))?.querySelector('a'));
  const labels = Array.from(doc.querySelectorAll('a.LXbq')).map((a) => text(a));
  const intro = cleanIntro(doc.querySelector('.T-L-T-C-Box1')?.innerHTML)
    .split('\n')
    .filter((line) => !FALOO_DISCLAIMER.test(line))
    .join('\n');
  const cover = httpsUrl(ogMeta(doc, 'og:image'));

  return {
    ...base(ref),
    title,
    author: ogMeta(doc, 'og:novel:author'),
    intro,
    coverUrls: cover ? [cover] : [],
    category: ogMeta(doc, 'og:novel:category'),
    tags: uniq([subCategory, ...labels]),
  };
}

/**
 * Cover candidates for an image hot-linked from Baidu (`*.bdstatic.com`), best first.
 *
 * JJWXC authors link their covers from anywhere, very often from Baidu, and often as a
 * multi-megabyte original. Baidu's image host is slow and erratic from outside mainland
 * China (measured for one 2.8MB cover: anything from 5s to "64KB in 40s"), so a
 * 600px-wide rendition (`@w_600,q_80`, about 100KB) is tried before the original.
 */
export function baiduCovers(url: string): string[] {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return url ? [url] : [];
  }
  const onBaidu = host === 'bdstatic.com' || host.endsWith('.bdstatic.com');
  // A URL that already carries processing parameters is left alone.
  if (!onBaidu || /[@?]/.test(url.slice(url.indexOf(host) + host.length))) return [url];
  return [`${url}@w_600,q_80`, url];
}

/**
 * JJWXC's app endpoint (app.jjwxc.net/androidapi/novelbasicinfo): public JSON in UTF-8,
 * unlike the GB18030 web pages. An unavailable book answers `{ code, message }`.
 */
export function parseJjwxc(body: string, ref: SourceRef): SourceBook {
  let j: any;
  try {
    j = JSON.parse(body);
  } catch {
    throw new Error('JJWXC trả về dữ liệu không hợp lệ');
  }
  if (!str(j?.novelName)) {
    throw new Error(str(j?.message) || 'JJWXC không trả về thông tin truyện (sai link hoặc truyện đã gỡ)');
  }

  return {
    ...base(ref),
    title: str(j.novelName),
    author: str(j.authorName),
    intro: cleanIntro(decodeEntities(str(j.novelIntro))),
    // JJWXC-hosted covers: 300x420 rendition first, the original as a fallback.
    // Covers hot-linked from Baidu get a small rendition of their own (see baiduCovers).
    coverUrls: uniq([j.novelCover, j.originalCover].map((url) => httpsUrl(str(url)))).flatMap(baiduCovers),
    // e.g. "原创-言情-架空历史-爱情-女主": origin, orientation, era, genre, point of view.
    category: str(j.novelClass),
    tags: uniq(str(j.novelTags).split(/[,，]/)),
  };
}

/**
 * Cover candidates for a Ciweimao cover URL, best first.
 *
 * Ciweimao's pages link covers on e1/e2.kuangxiangit.com, a CDN that is slow or
 * unreachable from outside mainland China (measured: 10-30s, or a connect timeout).
 * The same path on c1.kuangxiangit.com is served by a different CDN and answers in a
 * few seconds, so it is tried first and the page's own URL kept as a fallback.
 */
export function ciweimaoCovers(url: string): string[] {
  const m = url.match(/^https:\/\/[a-z]\d+\.kuangxiangit\.com\/(.+)$/i);
  if (!m) return url ? [url] : [];
  return uniq([`https://c1.kuangxiangit.com/${m[1]}`, url]);
}

/** www.ciweimao.com/book/{id}: server-rendered page with Open Graph novel tags. */
export function parseCiweimao(html: string, ref: SourceRef): SourceBook {
  const doc = parseHtml(html);
  const title = ogMeta(doc, 'og:novel:book_name');
  if (!title) {
    throw new Error('Không đọc được dữ liệu trang Ciweimao (sai link, truyện đã gỡ hoặc trang đổi cấu trúc)');
  }

  const category = ogMeta(doc, 'og:novel:category');
  // Breadcrumb: 首页 > {channel} > {category} > {title}; only the channel adds information.
  const channels = Array.from(doc.querySelectorAll('.breadcrumb a'))
    .map((a) => text(a))
    .filter((name) => name !== '首页' && name !== category);
  const labels = Array.from(doc.querySelectorAll('.label-box .label')).map((el) => text(el));
  const cover = httpsUrl(ogMeta(doc, 'og:image'));

  return {
    ...base(ref),
    title,
    author: ogMeta(doc, 'og:novel:author'),
    intro: cleanIntro(doc.querySelector('.book-intro .book-desc')?.innerHTML),
    coverUrls: ciweimaoCovers(cover),
    category,
    tags: uniq([...channels, ...labels]),
  };
}
