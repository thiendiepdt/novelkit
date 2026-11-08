/**
 * The import rules of Mèo Truyện, copied from the meotruyen repo (`shared/import.ts`,
 * `shared/text.ts`, `shared/book-input.ts`). The site checks everything again; these copies
 * let NovelKit report every problem before a job is opened, and send exactly the text the
 * site's own importer would. Keep them in step with the site when it changes its rules.
 */

const MB = 1024 * 1024;

export const IMPORT_LIMITS = {
  chapters: 10_000,
  /** One batch of chapter texts: at most 100 chapters and 4 MB. */
  batchChapters: 100,
  batchBytes: 4 * MB,
  /** Table of contents (numbers and titles) as JSON. */
  tocBytes: 1.5 * MB,
  chapterTextBytes: 200 * 1024,
  chapterTitle: 200,
} as const;

export const BOOK_TEXT_MAX = {
  title: 200,
  titleZh: 200,
  author: 120,
  authorZh: 120,
  synopsis: 5000,
  editorNote: 300,
  sourceUrl: 500,
} as const;

/** A book has at most 30 genres and tags. */
export const GENRES_MAX = 30;

export const textBytes = (text: string) => new TextEncoder().encode(text).byteLength;

/** Characters as a reader sees them (code points), the unit of every length limit. */
export const charCount = (text: string) => [...text].length;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** "Chương 12: …", "Chương 012 - …", "Chapter 12", "第12章 …": only with this chapter's number. */
function isChapterHeading(line: string, number: number): boolean {
  const digits = `0*${number}(?!\\d)`;
  return (
    new RegExp(`^(?:chương|chapter|chap\\.?|ch\\.)\\s*${digits}`, 'iu').test(line) ||
    new RegExp(`^第\\s*${digits}\\s*[章回节節]`, 'u').test(line)
  );
}

/**
 * A chapter text as the site stores it: one paragraph per non-empty line, trimmed, one blank
 * line between paragraphs; a first line that is this chapter's heading is taken out.
 */
export function formatChapterFile(raw: string, number: number): { heading: string | null; text: string } {
  const paragraphs = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const first = paragraphs[0];
  const heading = first !== undefined && isChapterHeading(first, number) ? first : null;
  return { heading, text: (heading === null ? paragraphs : paragraphs.slice(1)).join('\n\n') };
}

/**
 * Batches of chapter numbers: at most `maxChapters` each and a JSON body under `maxBytes`
 * (1 KB kept for the `{"chapters":[…]}` wrapper), in order. `bytes` is the JSON size of
 * `{ number, text }`.
 */
export function chapterBatches(
  entries: readonly { number: number; bytes: number }[],
  maxChapters: number = IMPORT_LIMITS.batchChapters,
  maxBytes: number = IMPORT_LIMITS.batchBytes - 1024,
): number[][] {
  const batches: number[][] = [];
  let current: number[] = [];
  let size = 0;
  for (const entry of entries) {
    if (current.length > 0 && (current.length >= maxChapters || size + entry.bytes + 1 > maxBytes)) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(entry.number);
    size += entry.bytes + 1;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** The site takes only `http://` and `https://` source links. */
export function isWebLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
