import type { SourceBook } from '../sources';
import type { MeoGenre } from './types';
import { MEO_ZH_NAMES } from './zhNames';

const norm = (s: string) => s.normalize('NFKC').replace(/[\s【】[\]「」『』《》·•]/g, '').toLowerCase();

/**
 * The labels of a source book as single terms: its tags, and the parts of a compound
 * category (JJWXC files a book as "原创-言情-架空历史-爱情-女主").
 */
export function sourceTerms(book: SourceBook): string[] {
  const parts = [...book.category.split(/[-－/|、,，]/), ...book.tags];
  const out: string[] = [];
  for (const part of parts) {
    const term = part.trim();
    if (term && !out.some((t) => norm(t) === norm(term))) out.push(term);
  }
  return out;
}

/** Genres and tags of the site whose Chinese name is exactly one of the source's labels. */
export function matchSourceTags(book: SourceBook | null, known: readonly MeoGenre[]): string[] {
  if (!book) return [];
  const terms = new Set(sourceTerms(book).map(norm));
  return known.filter((g) => {
    const zh = MEO_ZH_NAMES[g.slug];
    return !!zh && terms.has(norm(zh));
  }).map((g) => g.slug);
}
