import type { SourceLookup, SourceRef, SourceId } from './types';

// qqbook web front-ends use either the bid or 1_000_000_000 + bid in the path.
const QQ_OFFSET = 1_000_000_000;
const QQ_QMK = '1,3,7,9,10';

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

const BUILD: Record<SourceId, (bookId: string) => Omit<SourceRef, 'source' | 'bookId'>> = {
  // www.qidian.com sits behind a JS probe (HTTP 202); the mobile site serves the data in the HTML.
  qidian: (id) => ({
    link: `https://www.qidian.com/book/${id}/`,
    fetchUrl: `https://m.qidian.com/book/${id}/`,
  }),
  fanqie: (id) => ({
    link: `https://fanqienovel.com/page/${id}`,
    fetchUrl: `https://fanqienovel.com/page/${id}`,
  }),
  qq: (id) => ({
    link: `https://book.qq.com/book-detail/${id}`,
    fetchUrl: `https://detailadr.reader.qq.com/book/queryDetailPage?bid=${id}&sex=1&qmk=${QQ_QMK}`,
  }),
  // Server-rendered book page; a chapter link is the same path with "-{chapterId}" appended.
  qimao: (id) => ({
    link: `https://www.qimao.com/shuku/${id}/`,
    fetchUrl: `https://www.qimao.com/shuku/${id}/`,
  }),
  // The mobile page has the full synopsis (the desktop one truncates it); tags are desktop-only.
  sfacg: (id) => ({
    link: `https://book.sfacg.com/Novel/${id}/`,
    fetchUrl: `https://m.sfacg.com/b/${id}/`,
    extraFetchUrl: `https://book.sfacg.com/Novel/${id}/`,
  }),
  // GB2312 page; decoded on the Rust side.
  faloo: (id) => ({
    link: `https://b.faloo.com/${id}.html`,
    fetchUrl: `https://b.faloo.com/${id}.html`,
  }),
  // The web pages are GB18030 HTML; the app endpoint returns the same data as UTF-8 JSON.
  jjwxc: (id) => ({
    link: `https://www.jjwxc.net/onebook.php?novelid=${id}`,
    fetchUrl: `https://app.jjwxc.net/androidapi/novelbasicinfo?novelId=${id}`,
  }),
  ciweimao: (id) => ({
    link: `https://www.ciweimao.com/book/${id}`,
    fetchUrl: `https://www.ciweimao.com/book/${id}`,
  }),
};

/**
 * JJWXC links circulate under several domains (www/m/my.jjwxc.net, and renamed or dead
 * mirrors such as "jjwxcbroken.net"). Only the novel id is taken from the link and the
 * data always comes from JJWXC's own endpoint, so any "jjwxc*" domain is accepted.
 */
const JJWXC_HOST = /(?:^|\.)jjwxc[a-z0-9-]*\.(?:net|com)$/;

/** The canonical link and fetch URLs of a book on a source. */
export function sourceRef(source: SourceId, bookId: string): SourceRef {
  return { source, bookId, ...BUILD[source](bookId) };
}

function parseUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a pasted link (book page or chapter page) to its source and book id.
 * Returns null for anything that is not a book link of a supported source, and for
 * chapter links that do not carry the book id (see `detectChapterLookup`).
 */
export function detectSource(input: string): SourceRef | null {
  const url = parseUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();

  if (hostIs(host, 'qidian.com')) {
    const m = url.pathname.match(/\/(?:book|info|chapter)\/(\d+)/);
    return m ? sourceRef('qidian', m[1]) : null;
  }

  if (hostIs(host, 'fanqienovel.com') || hostIs(host, 'changdunovel.com') || hostIs(host, 'fqnovel.com')) {
    const id = url.searchParams.get('book_id') ?? url.pathname.match(/\/page\/(\d+)/)?.[1];
    return id && /^\d+$/.test(id) ? sourceRef('fanqie', id) : null;
  }

  if (hostIs(host, 'qq.com')) {
    const id = url.pathname.match(/\/(\d{5,})(?=[/.]|$)/)?.[1] ?? url.searchParams.get('bid');
    if (!id || !/^\d{5,}$/.test(id)) return null;
    const n = Number(id);
    return sourceRef('qq', String(n >= QQ_OFFSET ? n - QQ_OFFSET : n));
  }

  if (hostIs(host, 'qimao.com')) {
    // /shuku/{bookId}/ or /shuku/{bookId}-{chapterId}/
    const m = url.pathname.match(/\/shuku\/(\d+)(?:-\d+)?(?:\/|$)/);
    return m ? sourceRef('qimao', m[1]) : null;
  }

  if (hostIs(host, 'sfacg.com')) {
    // book.sfacg.com/Novel/{bookId}/[{volumeId}/{chapterId}/], m.sfacg.com/b/{bookId}/, m.sfacg.com/i/{bookId}/
    const m = url.pathname.match(/\/(?:Novel|b|i)\/(\d+)(?:\/|$)/i);
    return m ? sourceRef('sfacg', m[1]) : null;
  }

  if (hostIs(host, 'faloo.com')) {
    // /{bookId}.html, chapter /{bookId}_{n}.html, chapter list /html_{prefix}_{bookId}/
    const m = url.pathname.match(/\/html_\d+_(\d+)(?:\/|$)/) ?? url.pathname.match(/\/(\d+)(?:_\d+)?\.html$/);
    return m ? sourceRef('faloo', m[1]) : null;
  }

  if (JJWXC_HOST.test(host)) {
    // onebook.php?novelid={id}[&chapterid=n], mobile /book2/{id}[/{chapter}]
    const param = [...url.searchParams].find(([key]) => key.toLowerCase() === 'novelid')?.[1];
    const id = param ?? url.pathname.match(/\/book2\/(\d+)(?:\/|$)/)?.[1];
    return id && /^\d+$/.test(id) ? sourceRef('jjwxc', id) : null;
  }

  if (hostIs(host, 'ciweimao.com')) {
    // www / mip / wap.ciweimao.com/book/{id}
    const m = url.pathname.match(/\/book\/(\d+)(?:\/|$)/);
    return m ? sourceRef('ciweimao', m[1]) : null;
  }

  return null;
}

/**
 * Chapter links that name only the chapter. The book id is on the chapter's page, so
 * resolving them costs one extra fetch (see `fetchSourceBook`).
 */
export function detectChapterLookup(input: string): SourceLookup | null {
  const url = parseUrl(input);
  if (!url) return null;

  if (hostIs(url.hostname.toLowerCase(), 'sfacg.com')) {
    // m.sfacg.com/c/{chapterId}/
    const m = url.pathname.match(/^\/c\/(\d+)(?:\/|$)/i);
    return m ? { source: 'sfacg', lookupUrl: `https://m.sfacg.com/c/${m[1]}/` } : null;
  }

  return null;
}
