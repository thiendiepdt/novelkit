import type { ParsedChapter, TtcStory } from '../types';
import type { MeoBookStatus, MeoGenre, MeoImportOpenInput } from './types';
import { BOOK_TEXT_MAX, GENRES_MAX, IMPORT_LIMITS, charCount, countWords, formatChapterFile, isWebLink, textBytes } from './rules';

/** Only stories filed as "Nữ" on TTC go to Mèo Truyện (a romance site). */
export const isFemaleStory = (story: TtcStory) => story.gender === 'Nữ';

export function meoStatus(ttcStatus: string): MeoBookStatus {
  if (ttcStatus === 'full') return 'completed';
  if (ttcStatus === 'paused') return 'paused';
  return 'ongoing';
}

/** What the user picks before sending: genre and tag slugs, the editor's note. */
export interface MeoPicks {
  genres: string[];
  editorNote: string;
}

/** A chapter text exactly as it will be sent, with its JSON size for the batches. */
export interface MeoChapterText {
  number: number;
  text: string;
  bytes: number;
}

export interface MeoBuild {
  open: Omit<MeoImportOpenInput, 'cover' | 'overwriteBookId'>;
  texts: MeoChapterText[];
  wordCount: number;
  /** Anything here keeps the import from being sent. */
  problems: string[];
  warnings: string[];
}

const blank = (v: string | null | undefined) => !v || v.trim() === '';
const optional = (v: string | null | undefined) => (blank(v) ? null : v!.trim());

/** Genre and tag slugs of the site only, genres first, without repeats. */
export function orderPicks(slugs: readonly string[], known: readonly MeoGenre[]): string[] {
  const picked = new Set(slugs);
  const sorted = [...known].sort((a, b) => (a.kind === b.kind ? a.sort - b.sort : a.kind === 'genre' ? -1 : 1));
  return sorted.filter((g) => picked.has(g.slug)).map((g) => g.slug);
}

/**
 * A TTC story and the chapters of its folder → the body of an import job and the chapter
 * texts, checked with the site's rules (see `rules.ts`). Never throws: whatever is wrong is
 * listed in `problems`, all at once.
 */
export function buildMeoImport(
  story: TtcStory,
  chapters: readonly ParsedChapter[],
  picks: MeoPicks,
  known: readonly MeoGenre[],
): MeoBuild {
  const problems: string[] = [];
  const warnings: string[] = [];
  const tooLong = (label: string, value: string, max: number) => {
    if (charCount(value) > max) problems.push(`${label} dài quá ${max} ký tự.`);
  };

  if (!isFemaleStory(story)) problems.push('Chỉ truyện nữ mới đăng được lên Mèo Truyện.');

  const title = story.title.trim();
  if (title === '') problems.push('Truyện chưa có tên.');
  tooLong('Tên truyện', title, BOOK_TEXT_MAX.title);

  const titleZh = optional(story.chinese_title);
  if (titleZh === null) {
    problems.push('Truyện chưa có tên tiếng Trung (Mèo Truyện dùng nó để kiểm trùng): điền ở "Sửa" trên TTC.');
  } else tooLong('Tên tiếng Trung', titleZh, BOOK_TEXT_MAX.titleZh);

  const author = story.author.trim();
  if (author === '') problems.push('Truyện chưa có tác giả.');
  tooLong('Tác giả', author, BOOK_TEXT_MAX.author);
  const authorZh = optional(story.author_original);
  if (authorZh !== null) tooLong('Tác giả tiếng Trung', authorZh, BOOK_TEXT_MAX.authorZh);

  const synopsis = (story.description ?? '').trim();
  if (synopsis === '') problems.push('Truyện chưa có giới thiệu (văn án).');
  tooLong('Giới thiệu', synopsis, BOOK_TEXT_MAX.synopsis);

  const editorNote = picks.editorNote.trim();
  tooLong('Lời giới thiệu của BTV', editorNote, BOOK_TEXT_MAX.editorNote);

  let sourceUrl = optional(story.chinese_link);
  if (sourceUrl !== null && (!isWebLink(sourceUrl) || charCount(sourceUrl) > BOOK_TEXT_MAX.sourceUrl)) {
    warnings.push('Link nguồn không phải link http(s) hợp lệ nên không gửi kèm.');
    sourceUrl = null;
  }

  const genres = orderPicks(picks.genres, known);
  const kinds = new Map(known.map((g) => [g.slug, g.kind]));
  if (!genres.some((slug) => kinds.get(slug) === 'genre')) problems.push('Chọn ít nhất một thể loại.');
  if (genres.length > GENRES_MAX) problems.push(`Tối đa ${GENRES_MAX} thể loại và chủ đề.`);

  // Chapters: numbered 1..N without a gap, as on TTC.
  const sorted = [...chapters].sort((a, b) => a.index - b.index);
  if (sorted.length === 0) problems.push('Folder chưa có chương nào.');
  if (sorted.length > IMPORT_LIMITS.chapters) problems.push(`Một lần nạp tối đa ${IMPORT_LIMITS.chapters} chương.`);
  const first = sorted[0]?.index;
  if (first !== undefined && first > 1) {
    problems.push(
      `Folder bắt đầu từ chương ${first} (đang bỏ qua ${first - 1} chương đầu): Mèo Truyện cần đủ các chương từ chương 1.`,
    );
  } else {
    const gap = sorted.findIndex((c, i) => c.index !== i + 1);
    if (gap !== -1) problems.push(`Số chương phải liên tục từ 1; thiếu hoặc lệch ở chương ${gap + 1}.`);
  }

  const toc: { number: number; title: string }[] = [];
  const texts: MeoChapterText[] = [];
  let wordCount = 0;
  for (const chapter of sorted) {
    const number = chapter.index;
    const { heading, text } = formatChapterFile(chapter.content, number);
    const chapterTitle = chapter.title.trim() || heading || '';
    if (chapterTitle === '') problems.push(`Chương ${number} thiếu tên.`);
    else if (charCount(chapterTitle) > IMPORT_LIMITS.chapterTitle) {
      problems.push(`Tên chương ${number} dài quá ${IMPORT_LIMITS.chapterTitle} ký tự.`);
    }
    if (text === '') problems.push(`Nội dung chương ${number} đang trống.`);
    else if (textBytes(text) > IMPORT_LIMITS.chapterTextBytes) {
      problems.push(`Nội dung chương ${number} vượt ${IMPORT_LIMITS.chapterTextBytes / 1024} KB.`);
    }
    toc.push({ number, title: chapterTitle });
    texts.push({ number, text, bytes: textBytes(JSON.stringify({ number, text })) });
    wordCount += countWords(text);
  }
  if (textBytes(JSON.stringify(toc)) > IMPORT_LIMITS.tocBytes) {
    problems.push('Mục lục (số và tên chương) vượt 1,5 MB.');
  }

  return {
    open: {
      title,
      titleZh,
      author,
      authorZh,
      translator: null,
      sourceUrl,
      synopsis,
      status: meoStatus(story.status),
      appId: story.id > 0 ? story.id : null,
      editorNote: editorNote === '' ? null : editorNote,
      genres,
      chapters: toc,
    },
    texts,
    wordCount,
    problems,
    warnings,
  };
}
