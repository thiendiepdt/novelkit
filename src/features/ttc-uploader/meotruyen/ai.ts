import { invoke } from '@tauri-apps/api/core';
import type { AiSettings } from '@/features/settings/types';
import type { TtcStory } from '../types';
import { AiContentBlockedError, extractJson, isContentBlock } from '../ai/fill';
import { AI_BLOCKED_MESSAGE } from '../ai/client';
import { BOOK_TEXT_MAX, charCount } from './rules';
import type { MeoGenre } from './types';
import { SOURCE_LABELS, type SourceBook } from '../sources';
import { sourceTerms } from './sourceTags';
import { MEO_ZH_NAMES } from './zhNames';

/** What the model picks for Mèo Truyện. Slugs are always ones of the site. */
export interface MeoAiPicks {
  genres: string[];
  tags: string[];
  editorNote: string;
}

const MAX_GENRES = 2;
const MAX_TAGS = 10;
/** Asked of the model; the site allows 300. */
const NOTE_TARGET = 250;

const SYSTEM_PROMPT = `Bạn là biên tập viên (BTV) của Mèo Truyện, web đọc truyện ngôn tình Trung Quốc dịch tiếng Việt. Từ hồ sơ một bộ truyện nữ tần đã dịch, hãy điền:

- genres: chọn 1 slug (tối đa ${MAX_GENRES}) trong danh sách "Thể loại", đúng với bối cảnh và dòng chính của truyện (cổ đại, hiện đại, huyền huyễn, tiên hiệp...).
- tags: chọn từ 3 đến 8 slug trong danh sách "Chủ đề" thật sự đúng với truyện. Căn cứ chính là nhãn gốc tiếng Trung của trang nguồn (khi có): mỗi chủ đề có tên tiếng Trung trong ngoặc, chủ đề nào trùng hoặc cùng nghĩa với một nhãn gốc thì chọn. Sau đó mới dựa vào văn án, phân loại và thể loại. Không chọn cho đủ số: chủ đề nào không có căn cứ thì bỏ.
- editorNote: lời giới thiệu ngắn của BTV, tiếng Việt, 1 đến 2 câu, tối đa ${NOTE_TARGET} ký tự. Nói vì sao truyện đáng đọc: điểm hấp dẫn, cảm xúc, kiểu nhân vật, quan hệ chính. Giọng tự nhiên như người giới thiệu sách cho bạn. Không tiết lộ kết truyện, không chép lại văn án, không emoji, không hashtag, không bọc trong dấu ngoặc kép. Giữ nguyên tên nhân vật như trong văn án.

Chỉ dùng đúng slug có trong danh sách, không tự đặt slug mới.

# Đầu ra
Trả về DUY NHẤT một JSON object với đúng các khoá: genres (mảng slug), tags (mảng slug), editorNote (chuỗi). Không in phần suy nghĩ, không giải thích, không markdown.`;

/** `slug: tên (中文)`; the Chinese name is what the source labels match. */
const lines = (items: readonly MeoGenre[]) =>
  items
    .map((g) => {
      const zh = MEO_ZH_NAMES[g.slug];
      return zh && zh.toLowerCase() !== g.name.toLowerCase() ? `${g.slug}: ${g.name} (${zh})` : `${g.slug}: ${g.name}`;
    })
    .join('\n');

const subCategories = (story: TtcStory) =>
  Array.isArray(story.sub_categories) ? story.sub_categories.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [];

export function buildPickPrompt(
  story: TtcStory,
  known: readonly MeoGenre[],
  /** The book on its source site, when it could be read: its Chinese labels. */
  source: SourceBook | null = null,
  omitSynopsis = false,
): { system: string; user: string } {
  const terms = source ? sourceTerms(source) : [];
  const info = [
    `Tên truyện: ${story.title}`,
    story.chinese_title ? `Tên gốc: ${story.chinese_title}` : '',
    `Tác giả: ${story.author}`,
    story.category ? `Thể loại trên app: ${story.category}` : '',
    subCategories(story).length > 0 ? `Phân loại trên app: ${subCategories(story).join(', ')}` : '',
    source ? `Trang nguồn: ${SOURCE_LABELS[source.source]}` : '',
    terms.length > 0 ? `Nhãn gốc tiếng Trung: ${terms.join(', ')}` : '',
    omitSynopsis ? '' : `Văn án:\n${(story.description ?? '').trim()}`,
  ].filter(Boolean);
  const user = [
    ...info,
    '',
    '# Thể loại (slug: tên (tên tiếng Trung))',
    lines(known.filter((g) => g.kind === 'genre')),
    '',
    '# Chủ đề (slug: tên (tên tiếng Trung))',
    lines(known.filter((g) => g.kind === 'tag')),
  ].join('\n');
  return { system: SYSTEM_PROMPT, user };
}

const fold = (s: string) => s.normalize('NFC').trim().toLowerCase();

/** Slugs of one kind from the model's list; a name instead of a slug is accepted too. */
function pickSlugs(value: unknown, known: readonly MeoGenre[], kind: MeoGenre['kind'], max: number): string[] {
  if (!Array.isArray(value)) return [];
  const ofKind = known.filter((g) => g.kind === kind);
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const key = fold(item);
    const match = ofKind.find((g) => g.slug === key) ?? ofKind.find((g) => fold(g.name) === key);
    if (match && !out.includes(match.slug)) out.push(match.slug);
    if (out.length >= max) break;
  }
  return out;
}

/** The note as the site takes it: one paragraph, no wrapping quotes, within the limit. */
export function cleanEditorNote(value: unknown): string {
  if (typeof value !== 'string') return '';
  let note = value.replace(/\s+/g, ' ').trim();
  note = note.replace(/^["“”'‘’「『]+|["“”'‘’」』]+$/gu, '').trim();
  if (charCount(note) <= BOOK_TEXT_MAX.editorNote) return note;
  // Cut at the last sentence (or word) end that fits.
  const head = [...note].slice(0, BOOK_TEXT_MAX.editorNote).join('');
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sentence > BOOK_TEXT_MAX.editorNote / 2) return head.slice(0, sentence + 1);
  const word = head.lastIndexOf(' ');
  return `${(word > 0 ? head.slice(0, word) : head.slice(0, -1)).replace(/[,;:\s]+$/, '')}…`;
}

export function parsePickReply(reply: string, known: readonly MeoGenre[]): MeoAiPicks {
  const json = extractJson(reply);
  return {
    genres: pickSlugs(json.genres, known, 'genre', MAX_GENRES),
    tags: pickSlugs(json.tags, known, 'tag', MAX_TAGS),
    editorNote: cleanEditorNote(json.editorNote),
  };
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : '');
const isBlocked = (e: unknown) => e instanceof AiContentBlockedError || isContentBlock(messageOf(e));

/**
 * Ask the configured model for the genres, tags and editor's note of a story. As with the
 * create-story fill, a prompt refused by the provider's content filter is asked once more
 * without the synopsis.
 */
export async function aiPickMeo(
  ai: AiSettings,
  story: TtcStory,
  known: readonly MeoGenre[],
  source: SourceBook | null = null,
): Promise<MeoAiPicks> {
  const config = ai[ai.provider];
  const ask = async (omitSynopsis: boolean) => {
    const { system, user } = buildPickPrompt(story, known, source, omitSynopsis);
    const reply = await invoke<string>('ai_generate_json', {
      request: {
        provider: ai.provider,
        apiKey: config.apiKey.trim(),
        model: config.model.trim(),
        baseUrl: config.baseUrl.trim(),
        system,
        user,
      },
    });
    return parsePickReply(reply, known);
  };
  try {
    return await ask(false);
  } catch (e) {
    if (!isBlocked(e)) throw e;
  }
  try {
    return await ask(true);
  } catch (e) {
    if (isBlocked(e)) throw new Error(AI_BLOCKED_MESSAGE);
    throw e;
  }
}
