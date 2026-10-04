import { invoke } from '@tauri-apps/api/core';
import { detectChapterLookup, detectSource, sourceRef } from './detect';
import { parseFanqie, parseQidian, parseQimao, parseQq, parseSfacg, sfacgBookIdFromChapter } from './parse';
import { SOURCE_NAMES } from './types';
import type { SourceBook, SourceId, SourceRef } from './types';

export { detectChapterLookup, detectSource } from './detect';
export { SOURCE_LABELS, SOURCE_NAMES } from './types';
export type { SourceBook, SourceId, SourceRef } from './types';

const PARSERS: Record<SourceId, (body: string, ref: SourceRef, extraBody?: string) => SourceBook> = {
  fanqie: parseFanqie,
  qidian: parseQidian,
  qq: parseQq,
  qimao: parseQimao,
  sfacg: parseSfacg,
};

/** Sources whose chapter links carry no book id: how to read it from the chapter page. */
const CHAPTER_BOOK_ID: Partial<Record<SourceId, (chapterHtml: string) => string>> = {
  sfacg: sfacgBookIdFromChapter,
};

export const UNSUPPORTED_LINK_MESSAGE = `Link không được hỗ trợ. AI fill chỉ đọc được link truyện từ ${SOURCE_NAMES}.`;

/** Rust side: no CORS, plain User-Agent, allowlisted hosts only. */
const fetchText = (url: string) => invoke<string>('source_fetch_text', { url });

/** A chapter-only link costs one extra fetch to find its book. */
async function resolveChapterLink(link: string): Promise<SourceRef | null> {
  const lookup = detectChapterLookup(link);
  const readBookId = lookup && CHAPTER_BOOK_ID[lookup.source];
  if (!lookup || !readBookId) return null;
  return sourceRef(lookup.source, readBookId(await fetchText(lookup.lookupUrl)));
}

/** Fetch and parse a source book from a pasted book or chapter link. */
export async function fetchSourceBook(link: string): Promise<SourceBook> {
  const ref = detectSource(link) ?? (await resolveChapterLink(link));
  if (!ref) throw new Error(UNSUPPORTED_LINK_MESSAGE);

  const [body, extraBody] = await Promise.all([
    fetchText(ref.fetchUrl),
    // The extra page only enriches the result: losing it must not lose the book.
    ref.extraFetchUrl ? fetchText(ref.extraFetchUrl).catch(() => undefined) : undefined,
  ]);
  return PARSERS[ref.source](body, ref, extraBody);
}

/**
 * Download a cover as raw bytes, trying each candidate in order until one works.
 * The Rust side enforces an image-host allowlist and retries transient failures itself.
 * Rejects with the last candidate's error.
 */
export async function fetchSourceCover(urls: string[]): Promise<{ bytes: number[]; mime: string }> {
  let lastError: unknown = new Error('Nguồn không có ảnh bìa');
  for (const url of urls) {
    try {
      return await invoke<{ bytes: number[]; mime: string }>('source_fetch_image', { url });
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
