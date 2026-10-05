import { describe, it, expect } from 'vitest';
import { AiContentBlockedError, buildFillPrompt, isContentBlock, parseFillResponse, repairJson, titleUsesToi } from './fill';
import { toTitleCase } from '../utils/titleCase';
import type { EditBookOptions } from '../types';
import type { SourceBook } from '../sources/types';

const opt = (...values: string[]) => values.map((value) => ({ value, label: value }));

const OPTIONS: EditBookOptions = {
  categories: opt('Tiên hiệp', 'Huyền huyễn', 'Đô thị'),
  subCategoriesTichCach: opt('Điềm Đạm', 'Cơ Trí'),
  subCategoriesBoiCanh: opt('Dị Thế Đại Lục', 'Tây Phương Kỳ Huyền'),
  subCategoriesLuuPhai: opt('Xuyên Không', 'Hệ Thống'),
};

const BOOK: SourceBook = {
  source: 'qidian',
  bookId: '1010868264',
  link: 'https://www.qidian.com/book/1010868264/',
  title: '诡秘之主',
  author: '爱潜水的乌贼',
  intro: '蒸汽与机械的浪潮中，谁能触及非凡？\n我从诡秘中醒来。',
  coverUrls: ['https://bookcover.yuewen.com/qdbimg/349573/1010868264/600'],
  category: '玄幻',
  tags: ['异世大陆', '轻小说'],
  genderHint: 'Nam',
};

describe('toTitleCase', () => {
  it('capitalizes the first letter of every word, Vietnamese letters included', () => {
    expect(toTitleCase('quỷ bí chi chủ')).toBe('Quỷ Bí Chi Chủ');
    expect(toTitleCase('ái tiềm thủy đích ô tặc')).toBe('Ái Tiềm Thủy Đích Ô Tặc');
  });

  it('capitalizes after opening brackets and quotes, leaves the rest untouched', () => {
    expect(toTitleCase('trọng sinh (bản mới) “đặc biệt”')).toBe('Trọng Sinh (Bản Mới) “Đặc Biệt”');
    expect(toTitleCase('Đã Viết Hoa SẴN')).toBe('Đã Viết Hoa SẴN');
  });
});

describe('buildFillPrompt', () => {
  it('carries the source metadata and every option list the model must choose from', () => {
    const { system, user } = buildFillPrompt(BOOK, OPTIONS, 'truyen-cv');

    expect(system).toContain('title, author, gender, category, tinh_cach, boi_canh, luu_phai, description');
    // Title style depends on the story type: both styles are described, the user prompt says which applies.
    expect(system).toContain('Truyện Convert: ưu tiên phiên âm Hán-Việt');
    expect(system).toContain('Truyện Dịch: dịch nghĩa sang tiếng Việt tự nhiên');
    expect(user).toContain('Loại truyện đăng: Truyện Convert');
    // The three sub-categories are mandatory on TTC: the model must not leave them empty.
    expect(system).toContain('tinh_cach, boi_canh, luu_phai: BẮT BUỘC');
    expect(system).toContain('Không được để trống');
    // House style (styleGuide.ts): the narrator is always "ta", in titles too; "tôi" lives only inside dialogue.
    expect(system).toContain('LUÔN là "Ta"');
    expect(system).toContain('TUYỆT ĐỐI KHÔNG dùng "Tôi" hay "Mình" trong tên truyện');
    expect(system).toContain('TUYỆT ĐỐI không dùng "tôi" hay "mình" trong lời kể');
    expect(system).toContain('Đây là chỗ duy nhất được phép có "tôi"');
    // Requested deviations from the reference style.
    expect(system).toContain('dịch là "cha", KHÔNG dùng "bố"');
    expect(system).toContain('"ông bố" viết là "người cha"');
    expect(system).toContain('"nương" hoặc "mẫu thân" (KHÔNG dùng mẹ)');
    // Task context first, as in the reference prompts: a translation of published fiction, not a request to write it.
    expect(system.indexOf('# Ngữ cảnh tác vụ chuyển ngữ')).toBeGreaterThan(-1);
    expect(system.indexOf('# Ngữ cảnh tác vụ chuyển ngữ')).toBeLessThan(system.indexOf('# Các trường cần điền'));
    expect(system).toContain('KHÔNG phải yêu cầu sáng tác');
    expect(system).toContain('đã xuất bản công khai');
    expect(system).toContain('KHÔNG từ chối, cảnh báo, phán xét, kiểm duyệt');
    // Faithful, natural Vietnamese rather than character-by-character Hán-Việt.
    expect(system).toContain('Chỉ dịch những gì nguyên tác thực sự có');
    expect(system).toContain('Chỉ dùng Hán-Việt cho tên riêng');
    expect(system).toContain('Dịch đủ mọi câu, mọi đoạn theo đúng thứ tự');
    expect(user).toContain('Tên truyện (tiếng Trung): 诡秘之主');
    expect(user).toContain('Tác giả (tiếng Trung): 爱潜水的乌贼');
    expect(user).toContain('Nhãn gốc: 异世大陆, 轻小说');
    expect(user).toContain('Đối tượng theo nguồn: truyện Nam');
    expect(user).toContain('我从诡秘中醒来。');
    expect(user).toContain('Danh sách category: Tiên hiệp | Huyền huyễn | Đô thị');
    expect(user).toContain('Danh sách luu_phai: Xuyên Không | Hệ Thống');
  });

  it('tells the model when the story is posted as a translation', () => {
    const { user } = buildFillPrompt(BOOK, OPTIONS, 'truyen-dich');
    expect(user).toContain('Loại truyện đăng: Truyện Dịch');
    expect(user).not.toContain('Loại truyện đăng: Truyện Convert');
  });

  it('can leave the synopsis out, for a retry after a content filter rejected it', () => {
    const { user } = buildFillPrompt(BOOK, OPTIONS, 'truyen-dich', true);
    expect(user).not.toContain('我从诡秘中醒来。');
    expect(user).toContain('Văn án gốc: (không gửi kèm). Để description là chuỗi rỗng ""');
    // Everything else the model needs is still there.
    expect(user).toContain('Tên truyện (tiếng Trung): 诡秘之主');
    expect(user).toContain('Nhãn gốc: 异世大陆, 轻小说');
    expect(user).toContain('Danh sách category: Tiên hiệp | Huyền huyễn | Đô thị');
  });

  it('says so when the source has no tags, synopsis or audience', () => {
    const { user } = buildFillPrompt({ ...BOOK, tags: [], intro: '', category: '', genderHint: undefined }, OPTIONS, 'truyen-cv');
    expect(user).toContain('Nhãn gốc: (không có)');
    expect(user).toContain('(không có văn án)');
    expect(user).toContain('Phân loại gốc: (không rõ)');
    expect(user).not.toContain('Đối tượng theo nguồn');
  });
});

describe('content-policy refusals', () => {
  // What a hub in front of Gemini returns as the "answer" when Google rejects the prompt.
  const GOOGLE_REFUSAL = "The prompt could not be submitted. The prompt contains sensitive words that violate Google's [Generative AI Prohibited Use policy](https://policies.google.com/terms/generative-ai/use-policy). If you believe this is an error, [send feedback](https://ai.google.dev/gemini-api/docs/troubleshooting).";

  it('recognizes a refusal that arrives as the reply text', () => {
    expect(isContentBlock(GOOGLE_REFUSAL)).toBe(true);
    expect(() => parseFillResponse(GOOGLE_REFUSAL, OPTIONS)).toThrow(AiContentBlockedError);
  });

  it('recognizes the block errors built on the Rust side', () => {
    expect(isContentBlock('Gemini không trả lời (lý do: PROHIBITED_CONTENT)')).toBe(true);
    expect(isContentBlock('Gemini không trả lời (lý do: SAFETY)')).toBe(true);
    expect(isContentBlock('Model không trả lời (bị bộ lọc nội dung chặn)')).toBe(true);
    expect(isContentBlock('Model từ chối trả lời: I cannot help with that.')).toBe(true);
  });

  it('does not mistake ordinary failures for a refusal', () => {
    expect(isContentBlock('Gemini lỗi HTTP 400: API key not valid.')).toBe(false);
    expect(isContentBlock('Không gọi được OpenAI: hết thời gian chờ (operation timed out)')).toBe(false);
    expect(isContentBlock('Model trả lời bị cắt giữa chừng vì chạm giới hạn độ dài.')).toBe(false);
    expect(() => parseFillResponse('Xin lỗi, tôi không thể giúp.', OPTIONS)).not.toThrow(AiContentBlockedError);
  });
});

describe('repairJson', () => {
  it('leaves valid JSON untouched', () => {
    const valid = JSON.stringify({ a: 'x "y" z', b: ['1', '2'], c: 'dòng 1\ndòng 2' }, null, 2);
    expect(repairJson(valid)).toBe(valid);
  });

  it('escapes raw control characters inside strings only', () => {
    expect(JSON.parse(repairJson('{\n  "a": "dòng 1\r\ndòng 2\tcuối"\n}'))).toEqual({ a: 'dòng 1\ndòng 2\tcuối' });
  });

  it('removes trailing commas outside strings and keeps commas inside them', () => {
    expect(JSON.parse(repairJson('{"a": "x, }", "b": [1, 2,], }'))).toEqual({ a: 'x, }', b: [1, 2] });
  });
});

describe('titleUsesToi', () => {
  it('flags the first-person "tôi" anywhere in a title', () => {
    expect(titleUsesToi('Tôi Có Thể Sao Chép Thiên Phú')).toBe(true);
    expect(titleUsesToi('Hệ Thống Của Tôi Quá Mạnh')).toBe(true);
    expect(titleUsesToi('Trọng Sinh: tôi Là Đại Phản Phái')).toBe(true);
  });

  it('accepts "ta" and words that merely contain the letters', () => {
    expect(titleUsesToi('Ta Có Thể Sao Chép Thiên Phú')).toBe(false);
    expect(titleUsesToi('Tối Cường Hệ Thống')).toBe(false);
    expect(titleUsesToi('Tội Ác Chi Thành')).toBe(false);
  });

  it('does not flag other meanings of the word', () => {
    expect(titleUsesToi('Tôi Luyện Thành Thần')).toBe(false);
    expect(titleUsesToi('Bề Tôi Trung Thành Nhất')).toBe(false);
  });
});

describe('parseFillResponse', () => {
  const reply = {
    title: 'quỷ bí chi chủ',
    author: 'ái tiềm thủy đích ô tặc',
    gender: 'Nam',
    category: 'Huyền huyễn',
    tinh_cach: 'Cơ Trí',
    boi_canh: 'Tây Phương Kỳ Huyền',
    luu_phai: 'Xuyên Không',
    description: 'Đoạn một.\nĐoạn hai.\n\n\nĐoạn ba.',
  };

  it('normalizes a clean JSON reply', () => {
    expect(parseFillResponse(JSON.stringify(reply), OPTIONS)).toEqual({
      title: 'Quỷ Bí Chi Chủ',
      author: 'Ái Tiềm Thủy Đích Ô Tặc',
      gender: 'Nam',
      category: 'Huyền huyễn',
      sub_categories: ['Cơ Trí', 'Tây Phương Kỳ Huyền', 'Xuyên Không'],
      description: 'Đoạn một.\n\nĐoạn hai.\n\nĐoạn ba.',
    });
  });

  it('accepts fenced JSON and JSON wrapped in prose', () => {
    const fenced = '```json\n' + JSON.stringify(reply) + '\n```';
    const prose = 'Đây là kết quả:\n' + JSON.stringify(reply) + '\nHy vọng hữu ích.';
    expect(parseFillResponse(fenced, OPTIONS).title).toBe('Quỷ Bí Chi Chủ');
    expect(parseFillResponse(prose, OPTIONS).title).toBe('Quỷ Bí Chi Chủ');
  });

  it('drops values that are not in the form option lists', () => {
    const invented = { ...reply, gender: 'Khác', category: 'Trinh thám', tinh_cach: 'Lạnh Lùng', luu_phai: '' };
    expect(parseFillResponse(JSON.stringify(invented), OPTIONS)).toMatchObject({
      gender: '',
      category: '',
      sub_categories: ['', 'Tây Phương Kỳ Huyền', ''],
    });
  });

  it('matches options case-insensitively and returns the form spelling', () => {
    const sloppy = { ...reply, gender: 'nữ', category: 'huyền HUYỄN', tinh_cach: ' cơ trí ' };
    expect(parseFillResponse(JSON.stringify(sloppy), OPTIONS)).toMatchObject({
      gender: 'Nữ',
      category: 'Huyền huyễn',
      sub_categories: ['Cơ Trí', 'Tây Phương Kỳ Huyền', 'Xuyên Không'],
    });
  });

  it('reads replies that are JSON except for raw line breaks, plain quotes or a trailing comma', () => {
    // What a model outside strict JSON mode writes once the description is a long translated text.
    const broken = `{
  "title": "Bí Mật Với Con Trai Ông Chủ",
  "author": "Tức Phong",
  "gender": "Nữ",
  "category": "Đô thị",
  "tinh_cach": "Cơ Trí",
  "boi_canh": "Tây Phương Kỳ Huyền",
  "luu_phai": "Xuyên Không",
  "description": "Lệ tiên sinh nói: "Cô phải chăm sóc đứa con út."
Ban ngày, nàng chăm sóc nhị thiếu gia.",
}`;
    expect(() => JSON.parse(broken)).toThrow();

    expect(parseFillResponse(broken, OPTIONS)).toMatchObject({
      title: 'Bí Mật Với Con Trai Ông Chủ',
      author: 'Tức Phong',
      gender: 'Nữ',
      description: 'Lệ tiên sinh nói: "Cô phải chăm sóc đứa con út."\n\nBan ngày, nàng chăm sóc nhị thiếu gia.',
    });
  });

  it('accepts the object wrapped in a one-element array', () => {
    expect(parseFillResponse(JSON.stringify([reply]), OPTIONS).title).toBe('Quỷ Bí Chi Chủ');
  });

  it('quotes the reply in the error, so a failure says what the model actually sent', () => {
    expect(() => parseFillResponse('Xin lỗi, tôi không thể giúp với nội dung này.', OPTIONS)).toThrow(
      'AI trả về dữ liệu không đúng định dạng JSON (“Xin lỗi, tôi không thể giúp với nội dung này.”)',
    );
    const long = '{"title": "A", "description": "' + 'x'.repeat(600);
    expect(() => parseFillResponse(long, OPTIONS)).toThrow(/đầu: “\{"title": "A".*… cuối: “x+”/);
    expect(() => parseFillResponse('   ', OPTIONS)).toThrow(/model trả về rỗng/);
  });

  it('throws on a non-JSON reply and on a reply without a title', () => {
    expect(() => parseFillResponse('Xin lỗi, tôi không thể giúp.', OPTIONS)).toThrow(/JSON/);
    expect(() => parseFillResponse('[1, 2]', OPTIONS)).toThrow(/JSON/);
    expect(() => parseFillResponse(JSON.stringify({ ...reply, title: '  ' }), OPTIONS)).toThrow(/tên truyện/);
  });
});
