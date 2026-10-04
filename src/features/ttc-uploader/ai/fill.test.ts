import { describe, it, expect } from 'vitest';
import { buildFillPrompt, parseFillResponse } from './fill';
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
    // House style: first person is "ta" by default, "tôi" only for modern settings; dialogue follows the characters.
    expect(system).toContain('mặc định dịch là "ta"');
    expect(system).toContain('mặc định dịch là "cha", không dùng "bố"');
    expect(system).toContain('"ông bố" thì viết là "người cha"');
    expect(system).toContain('dùng "nương" hoặc "mẫu thân"');
    expect(system).toContain('truyện bối cảnh hiện đại');
    expect(system).toContain('trong câu đối thoại');
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

  it('says so when the source has no tags, synopsis or audience', () => {
    const { user } = buildFillPrompt({ ...BOOK, tags: [], intro: '', category: '', genderHint: undefined }, OPTIONS, 'truyen-cv');
    expect(user).toContain('Nhãn gốc: (không có)');
    expect(user).toContain('(không có văn án)');
    expect(user).toContain('Phân loại gốc: (không rõ)');
    expect(user).not.toContain('Đối tượng theo nguồn');
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

  it('throws on a non-JSON reply and on a reply without a title', () => {
    expect(() => parseFillResponse('Xin lỗi, tôi không thể giúp.', OPTIONS)).toThrow(/JSON/);
    expect(() => parseFillResponse('[1, 2]', OPTIONS)).toThrow(/JSON/);
    expect(() => parseFillResponse(JSON.stringify({ ...reply, title: '  ' }), OPTIONS)).toThrow(/tên truyện/);
  });
});
