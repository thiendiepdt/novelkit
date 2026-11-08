/** Shapes of the Mèo Truyện import API (meotruyen repo: `shared/admin.ts`, `shared/types.ts`). */

export const MEOTRUYEN_ORIGIN = 'https://meotruyen.com';

/** A genre ("thể loại", at least one needed) or a tag ("chủ đề") of the site. */
export interface MeoGenre {
  slug: string;
  name: string;
  kind: 'genre' | 'tag';
  sort: number;
}

export type MeoBookStatus = 'ongoing' | 'paused' | 'completed';

/** Body of `POST /api/admin/imports`. */
export interface MeoImportOpenInput {
  title: string;
  titleZh: string | null;
  author: string;
  authorZh: string | null;
  /** null = the token's owner (new book) or the current translator (overwrite). */
  translator: string | null;
  sourceUrl: string | null;
  synopsis: string;
  status: MeoBookStatus;
  /** Story id on TTC (the site links to the app with it). */
  appId: number | null;
  editorNote: string | null;
  /** Genre slugs, then tag slugs. */
  genres: string[];
  chapters: { number: number; title: string }[];
  /** Two base64 JPEGs, 600×800 and 180×240; null = no cover (an overwrite keeps the old one). */
  cover: { full: string; thumb: string } | null;
  overwriteBookId?: number;
}

export interface MeoImportOpened {
  jobId: string;
  slug: string;
}

/** A book of the site that has the same Chinese title or source link. */
export interface MeoDuplicate {
  id: number;
  slug: string;
  title: string;
  isPublished: boolean;
  chapterCount: number;
  fields: ('titleZh' | 'sourceUrl')[];
  /** Chapters past the new last one: deleted by an overwrite, with their comments. */
  chaptersDeleted: number;
  commentsDeleted: number;
}

export interface MeoImportResult {
  id: number;
  slug: string;
}

/** What NovelKit remembers of a story it imported, keyed by the TTC story id. */
export interface MeoLink {
  bookId: number;
  slug: string;
  genres: string[];
  editorNote: string;
  /** Chapters sent by the last import. */
  chapters: number;
  /** Epoch ms of the last import. */
  at: number;
}

/** A failed call, as the Rust side reports it (`status` 0 = the site was not reached). */
export class MeoApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'MeoApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
