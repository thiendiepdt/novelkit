import type { EditBookOptions, OptionItem } from '../types';
import { SOURCE_LABELS } from '../sources/types';
import type { SourceBook } from '../sources/types';
import { toTitleCase } from '../utils/titleCase';
import { TASK_CONTEXT, TRANSLATION_STYLE_GUIDE } from './styleGuide';

/** What the model fills in: the Vietnamese-facing fields of TTC's create-story form. */
export interface AiFillResult {
  title: string;
  author: string;
  /** '' when the model gave no usable value (the form keeps its current choice). */
  gender: 'Nam' | 'Nữ' | '';
  category: string;
  /**
   * [Tính cách, Bối cảnh, Lưu phái]. TTC requires all three (its form only looks optional);
   * '' means the model gave nothing usable and the user has to pick by hand.
   */
  sub_categories: [string, string, string];
  description: string;
}

const SYSTEM_PROMPT = `Bạn là dịch giả tiểu thuyết Trung Quốc sang tiếng Việt, đang điền hồ sơ đăng truyện cho một trang truyện. Từ thông tin gốc tiếng Trung của một bộ truyện, hãy điền các trường bên dưới. Phần dịch là chuyển ngữ trung thành, không sáng tác lại hay biên tập nâng giọng.

${TASK_CONTEXT}

# Các trường cần điền
- title: tên truyện tiếng Việt. Viết hoa chữ cái đầu mỗi từ. Không kèm tên tiếng Trung, không thêm chú thích.
  + Ngôi thứ nhất trong tên truyện (我, 吾, 本人, 俺...) LUÔN là "Ta". TUYỆT ĐỐI KHÔNG dùng "Tôi" hay "Mình" trong tên truyện, ở mọi loại truyện và mọi bối cảnh. Ví dụ: 我能复制天赋 là "Ta Có Thể Sao Chép Thiên Phú", không phải "Tôi Có Thể Sao Chép Thiên Phú". Các đại từ khác theo bảng đại từ của Quy tắc dịch (他 là "Hắn", 她 là "Nàng" hoặc "Cô").
  + Cách dịch tùy theo "Loại truyện đăng":
    * Truyện Convert: ưu tiên phiên âm Hán-Việt theo cách cộng đồng truyện convert vẫn đặt tên; chỗ nào Hán-Việt tối nghĩa thì dịch nghĩa cho tự nhiên.
    * Truyện Dịch: dịch nghĩa sang tiếng Việt tự nhiên theo đúng Quy tắc dịch, đọc lên hiểu ngay như tên một bản dịch hoàn chỉnh. Chỉ giữ Hán-Việt cho tên riêng và các thuật ngữ thể loại đã quen thuộc (tu tiên, trùng sinh, hệ thống, thiên phú...). Không ghép từ Hán-Việt mà người đọc phổ thông không hiểu. Ví dụ: 高考 dịch là "Thi Đại Học", không viết "Cao Khảo"; 觉醒 dịch là "Thức Tỉnh", không viết "Giác Tỉnh".
- author: tên tác giả phiên âm Hán-Việt, viết hoa chữ cái đầu mỗi từ.
- gender: "Nam" nếu là truyện nam tần, "Nữ" nếu là truyện nữ tần.
- category: chọn ĐÚNG MỘT giá trị trong danh sách category.
- tinh_cach, boi_canh, luu_phai: BẮT BUỘC, mỗi mục chọn ĐÚNG MỘT giá trị trong danh sách tương ứng. Không được để trống. Khi văn án không nói rõ (nhất là tính cách nhân vật chính), hãy suy luận từ thể loại, nhãn gốc và giọng văn rồi chọn giá trị gần nhất.
- description: bản dịch văn án theo đúng Quy tắc dịch bên dưới. Dịch đủ mọi câu, mọi đoạn theo đúng thứ tự, mỗi đoạn một dòng. Ngoại lệ duy nhất của việc dịch đủ: bỏ các câu không thuộc nội dung truyện như quảng cáo, kêu gọi đề cử/vote, thông báo nhóm chat, lịch ra chương, lời nhắn của nền tảng phát hành.
- Chỉ dùng đúng nguyên văn giá trị trong các danh sách, không tự đặt giá trị mới.

${TRANSLATION_STYLE_GUIDE}

# Đầu ra
Trả về DUY NHẤT một JSON object với đúng các khoá: title, author, gender, category, tinh_cach, boi_canh, luu_phai, description. Không in phần suy nghĩ, không giải thích, không markdown.`;

/**
 * True when a title still carries the first-person "tôi", which the house style bans
 * ("ta" is used instead). Reported to the user instead of auto-corrected, because "tôi"
 * is also an ordinary word: "tôi luyện" (to temper), "bề tôi" / "tôi tớ" (servant).
 */
export function titleUsesToi(title: string): boolean {
  const withoutOtherMeanings = title.replace(/tôi\s+(?:luyện|tớ|đòi|vôi)|(?:bề|vua)\s+tôi/giu, ' ');
  return /(?<!\p{L})tôi(?!\p{L})/iu.test(withoutOtherMeanings);
}

const list = (items: OptionItem[]) => items.map((o) => o.value).join(' | ');

/** Story types the AI fill applies to ("Sáng Tác" stories have no Chinese source). */
export type FillBookType = 'truyen-cv' | 'truyen-dich';

const TYPE_LABELS: Record<FillBookType, string> = {
  'truyen-cv': 'Truyện Convert',
  'truyen-dich': 'Truyện Dịch',
};

/**
 * Build the system + user prompt for one book. Option lists come from TTC's live form.
 * The story type decides the title style: Hán-Việt for a convert, plain Vietnamese for a translation.
 */
export function buildFillPrompt(
  book: SourceBook,
  options: EditBookOptions,
  type: FillBookType,
  /**
   * Leave the synopsis out of the prompt. Used after a provider's content filter rejected
   * the full prompt: the synopsis is by far the likeliest trigger, and the other fields can
   * still be filled from the title, category and tags.
   */
  omitSynopsis = false,
): { system: string; user: string } {
  const lines = [
    `Loại truyện đăng: ${TYPE_LABELS[type]}`,
    `Nguồn: ${SOURCE_LABELS[book.source]}`,
    `Tên truyện (tiếng Trung): ${book.title}`,
    `Tác giả (tiếng Trung): ${book.author}`,
    `Phân loại gốc: ${book.category || '(không rõ)'}`,
    `Nhãn gốc: ${book.tags.length ? book.tags.join(', ') : '(không có)'}`,
  ];
  if (book.genderHint) lines.push(`Đối tượng theo nguồn: truyện ${book.genderHint}`);
  if (omitSynopsis) {
    lines.push('Văn án gốc: (không gửi kèm). Để description là chuỗi rỗng "", chỉ điền các trường còn lại.', '');
  } else {
    lines.push('Văn án gốc:', '"""', book.intro || '(không có văn án)', '"""', '');
  }
  lines.push(
    `Danh sách category: ${list(options.categories)}`,
    `Danh sách tinh_cach: ${list(options.subCategoriesTichCach)}`,
    `Danh sách boi_canh: ${list(options.subCategoriesBoiCanh)}`,
    `Danh sách luu_phai: ${list(options.subCategoriesLuuPhai)}`,
  );
  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

/**
 * Make almost-JSON parseable. Models that are not held to a strict JSON mode (many
 * OpenAI-compatible hubs) break it in predictable ways once a field carries a long
 * translated text: real line breaks inside a string, dialogue in plain double quotes,
 * a trailing comma. Only used after a strict parse has failed.
 */
export function repairJson(source: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (!inString) {
      if (ch === '"') inString = true;
      // Trailing comma before a closing bracket.
      if (ch === ',' && /^\s*[}\]]/.test(source.slice(i + 1))) continue;
      out += ch;
      continue;
    }

    if (ch === '\\') {
      out += ch + (source[i + 1] ?? '');
      i++;
    } else if (ch === '\n') {
      out += '\\n';
    } else if (ch === '\r') {
      // dropped: the following \n carries the line break
    } else if (ch === '\t') {
      out += '\\t';
    } else if (ch === '"') {
      // A string really ends where JSON syntax continues; any other quote is part of the text.
      const next = source.slice(i + 1).match(/^\s*([\s\S])/)?.[1];
      if (next === undefined || next === ',' || next === '}' || next === ']' || next === ':') {
        inString = false;
        out += ch;
      } else {
        out += '\\"';
      }
    } else {
      out += ch;
    }
  }
  return out;
}

function parseObject(candidate: string): Record<string, unknown> | null {
  try {
    let parsed: unknown = JSON.parse(candidate);
    // Some models wrap the single object in an array.
    if (Array.isArray(parsed) && parsed.length === 1) parsed = parsed[0];
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // not JSON as it stands
  }
  return null;
}

/** Enough of a bad reply to tell what went wrong (prose, a refusal, a cut-off answer...). */
function replyExcerpt(reply: string): string {
  const flat = reply.replace(/\s+/g, ' ').trim();
  if (!flat) return 'model trả về rỗng';
  return flat.length <= 220 ? `“${flat}”` : `đầu: “${flat.slice(0, 130)}” … cuối: “${flat.slice(-80)}”`;
}

/**
 * The provider refused the prompt itself on content-policy grounds, as opposed to answering
 * badly. Worth telling apart: the fix is a different prompt or provider, not a retry.
 */
export class AiContentBlockedError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'AiContentBlockedError';
  }
}

/**
 * Recognize a content-policy refusal, whichever way it arrives: as the reply text itself
 * (hubs in front of Gemini answer "The prompt could not be submitted. The prompt contains
 * sensitive words that violate Google's Generative AI Prohibited Use policy..."), or as one of
 * the errors the Rust side builds from a block reason, a content filter or a refusal.
 */
export function isContentBlock(message: string): boolean {
  return /could not be submitted|prohibited use policy|sensitive words|content[_ ]filter|bộ lọc nội dung|không trả lời \(lý do|từ chối trả lời/i.test(
    message,
  );
}

/** Pull the JSON object out of a model reply (bare JSON, fenced, wrapped in prose, or slightly broken). */
function extractJson(reply: string): Record<string, unknown> {
  const trimmed = reply.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(trimmed.slice(start, end + 1));

  // Strict first, so a valid reply is never touched by the repair heuristics.
  for (const candidate of candidates) {
    const parsed = parseObject(candidate);
    if (parsed) return parsed;
  }
  for (const candidate of candidates) {
    const parsed = parseObject(repairJson(candidate));
    if (parsed) return parsed;
  }
  if (isContentBlock(reply)) throw new AiContentBlockedError(replyExcerpt(reply));
  throw new Error(`AI trả về dữ liệu không đúng định dạng JSON (${replyExcerpt(reply)})`);
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Keep only values TTC's form actually offers; match loosely on case, return the form's spelling. */
function pickOption(value: unknown, items: OptionItem[]): string {
  const wanted = text(value).toLocaleLowerCase('vi');
  if (!wanted) return '';
  return items.find((o) => o.value.toLocaleLowerCase('vi') === wanted)?.value ?? '';
}

/** One blank line between paragraphs, as TTC's rules ask for a clearly segmented synopsis. */
function normalizeDescription(value: unknown): string {
  return text(value)
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Validate and normalize a model reply. Throws when it is not a JSON object or carries no title. */
export function parseFillResponse(reply: string, options: EditBookOptions): AiFillResult {
  const json = extractJson(reply);

  const title = toTitleCase(text(json.title));
  if (!title) throw new Error('AI không trả về tên truyện');

  const gender = text(json.gender).toLocaleLowerCase('vi');

  return {
    title,
    author: toTitleCase(text(json.author)),
    gender: gender === 'nam' ? 'Nam' : gender === 'nữ' || gender === 'nu' ? 'Nữ' : '',
    category: pickOption(json.category, options.categories),
    sub_categories: [
      pickOption(json.tinh_cach, options.subCategoriesTichCach),
      pickOption(json.boi_canh, options.subCategoriesBoiCanh),
      pickOption(json.luu_phai, options.subCategoriesLuuPhai),
    ],
    description: normalizeDescription(json.description),
  };
}
