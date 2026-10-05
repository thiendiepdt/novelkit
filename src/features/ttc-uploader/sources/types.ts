/** Chinese novel sites the AI-fill flow can read book metadata from. */
export type SourceId = 'fanqie' | 'qq' | 'qidian' | 'qimao' | 'sfacg' | 'faloo' | 'jjwxc' | 'ciweimao';

export const SOURCE_LABELS: Record<SourceId, string> = {
  fanqie: 'Fanqie (番茄小说)',
  qq: 'QQ Reading (QQ阅读)',
  qidian: 'Qidian (起点中文网)',
  qimao: 'Qimao (七猫中文网)',
  sfacg: 'SFACG (SF轻小说)',
  faloo: 'Faloo (飞卢小说网)',
  jjwxc: 'JJWXC (晋江文学城)',
  ciweimao: 'Ciweimao (刺猬猫)',
};

/** Short names for UI copy, in the order they are listed to the user. */
export const SOURCE_NAMES = 'Fanqie, QQ Reading, Qidian, Qimao, SFACG, Faloo, JJWXC và Ciweimao';

/** A book link resolved to its source, id, canonical link and the URL to fetch metadata from. */
export interface SourceRef {
  source: SourceId;
  bookId: string;
  /** Canonical public link of the book (what goes into TTC's "Link tiếng Trung"). */
  link: string;
  /** Unsigned endpoint/page that carries the book metadata. */
  fetchUrl: string;
  /**
   * A second page with data the first one lacks (SFACG: tags are only on the desktop
   * page, the full synopsis only on the mobile one). Best effort: the book is still
   * usable when this fetch fails.
   */
  extraFetchUrl?: string;
}

/** A link that names only a chapter: the book id has to be read from that chapter's page. */
export interface SourceLookup {
  source: SourceId;
  lookupUrl: string;
}

/** Raw (Chinese) book metadata, normalized across sources. */
export interface SourceBook {
  source: SourceId;
  bookId: string;
  link: string;
  title: string;
  author: string;
  /** Synopsis, one paragraph per line, no leading indentation. */
  intro: string;
  /** Cover image candidates, best first (later ones are fallbacks). Empty when the source has none. */
  coverUrls: string[];
  category: string;
  tags: string[];
  /** Audience the source files the book under, when it says so. */
  genderHint?: 'Nam' | 'Nữ';
}
