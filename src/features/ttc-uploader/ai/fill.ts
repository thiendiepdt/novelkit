import type { EditBookOptions, OptionItem } from '../types';
import { SOURCE_LABELS } from '../sources/types';
import type { SourceBook } from '../sources/types';
import { toTitleCase } from '../utils/titleCase';

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

const SYSTEM_PROMPT = `Bạn là biên tập viên của một trang truyện convert Trung - Việt. Nhiệm vụ: từ thông tin gốc tiếng Trung của một bộ truyện, điền hồ sơ đăng truyện bằng tiếng Việt.

Quy tắc:
- title: tên truyện tiếng Việt. Viết hoa chữ cái đầu mỗi từ. Không kèm tên tiếng Trung, không thêm chú thích. Cách dịch tùy theo "Loại truyện đăng":
  + Truyện Convert: ưu tiên phiên âm Hán-Việt theo cách cộng đồng truyện convert vẫn đặt tên; chỗ nào Hán-Việt tối nghĩa thì dịch nghĩa cho tự nhiên.
  + Truyện Dịch: dịch nghĩa sang tiếng Việt tự nhiên, đọc lên hiểu ngay như tên một bản dịch hoàn chỉnh. Chỉ giữ Hán-Việt cho tên riêng và các thuật ngữ thể loại đã quen thuộc (tu tiên, trùng sinh, hệ thống...). Không ghép từ Hán-Việt mà người đọc phổ thông không hiểu. Ví dụ: 高考 dịch là "Thi Đại Học", không viết "Cao Khảo"; 觉醒 dịch là "Thức Tỉnh", không viết "Giác Tỉnh".
- author: tên tác giả phiên âm Hán-Việt, viết hoa chữ cái đầu mỗi từ.
- gender: "Nam" nếu là truyện nam tần, "Nữ" nếu là truyện nữ tần.
- category: chọn ĐÚNG MỘT giá trị trong danh sách category.
- tinh_cach, boi_canh, luu_phai: BẮT BUỘC, mỗi mục chọn ĐÚNG MỘT giá trị trong danh sách tương ứng. Không được để trống. Khi văn án không nói rõ (nhất là tính cách nhân vật chính), hãy suy luận từ thể loại, nhãn gốc và giọng văn rồi chọn giá trị gần nhất.
- description: dịch văn án sang tiếng Việt tự nhiên, trôi chảy, giữ đủ ý và giữ nguyên cách chia đoạn (mỗi đoạn một dòng). Tên riêng phiên âm Hán-Việt. Bỏ các câu quảng cáo, kêu gọi đề cử/vote, thông báo nhóm chat, lịch ra chương. Không thêm nội dung không có trong văn án gốc.
- Xưng hô trong description theo văn phong truyện convert, không theo lối nói thường ngày:
  + Ngôi thứ nhất (我, 吾, 本人...): mặc định dịch là "ta", không dùng "tôi".
  + Cha (爸, 爸爸, 父亲, 爹...): mặc định dịch là "cha", không dùng "bố"; "ông bố" thì viết là "người cha".
  + Mẹ (妈, 妈妈, 母亲, 娘...): truyện bối cảnh cổ đại, tiên hiệp, huyền huyễn, võ hiệp thì dùng "nương" hoặc "mẫu thân", không dùng "mẹ".
  + Các từ chỉ quan hệ khác xử lý cùng tinh thần đó: bối cảnh cổ dùng từ Hán-Việt, cổ phong (phụ thân, huynh, đệ, tỷ, muội...).
  + Hai ngoại lệ cho cả nhóm quy tắc xưng hô này: (1) truyện bối cảnh hiện đại (đô thị, hiện đại, vườn trường, giới giải trí, thương trường...) thì dùng từ thường ngày như "tôi", "mẹ"; (2) trong câu đối thoại (lời nhân vật nói, thường nằm trong ngoặc kép) thì chọn cách xưng hô hợp với quan hệ và bối cảnh của nhân vật.
- Chỉ dùng đúng nguyên văn giá trị trong các danh sách, không tự đặt giá trị mới.

Trả về DUY NHẤT một JSON object với đúng các khoá: title, author, gender, category, tinh_cach, boi_canh, luu_phai, description.`;

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
  lines.push(
    'Văn án gốc:',
    '"""',
    book.intro || '(không có văn án)',
    '"""',
    '',
    `Danh sách category: ${list(options.categories)}`,
    `Danh sách tinh_cach: ${list(options.subCategoriesTichCach)}`,
    `Danh sách boi_canh: ${list(options.subCategoriesBoiCanh)}`,
    `Danh sách luu_phai: ${list(options.subCategoriesLuuPhai)}`,
  );
  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

/** Pull the JSON object out of a model reply (bare JSON, fenced, or wrapped in prose). */
function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(trimmed.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // try the next candidate
    }
  }
  throw new Error('AI trả về dữ liệu không đúng định dạng JSON');
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
