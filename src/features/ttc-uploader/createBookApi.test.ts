import { describe, it, expect } from 'vitest';
import { bookIdFromRedirect, buildCreateBookFields, EMPTY_CREATE_BOOK, parseCreateBookPage } from './createBookApi';
import type { CreateBookData } from './types';

const PAGE = `<!DOCTYPE html><html><body>
<form id="storyForm" action="/dang-truyen" method="POST" enctype="multipart/form-data">
  <input type="hidden" name="_csrf" value="tok123">
  <select name="category" required>
    <option value="" selected disabled hidden>Vui lòng chọn thể loại</option>
    <option value="Tiên hiệp"> Tiên hiệp </option>
    <option value="Đô thị">Đô thị</option>
  </select>
  <select name="sub_categories"><option value="" selected>Vui lòng chọn tính cách</option><option value="Cơ Trí">Cơ Trí</option></select>
  <select name="sub_categories"><option value="" selected>Vui lòng chọn bối cảnh</option><option value="Dị Thế Đại Lục">Dị Thế Đại Lục</option></select>
  <select name="sub_categories"><option value="" selected>Vui lòng chọn lưu phái</option><option value="Hệ Thống">Hệ Thống</option></select>
</form>
<ol>
  <li><strong>Bản quyền:</strong> Cấm đăng truyện đã
      được xuất bản.</li>
  <li>Không được quảng cáo.</li>
</ol>
<script>
window.PAGE_DATA = Object.assign(window.PAGE_DATA || {}, {
    currentDisplayName: "Thương Hải \\"Hoành\\" Lưu",
    isEdit: false
});
</script></body></html>`;

describe('parseCreateBookPage', () => {
  it('reads the csrf token, option lists, display name and rules', () => {
    expect(parseCreateBookPage(PAGE)).toEqual({
      csrfToken: 'tok123',
      options: {
        categories: [
          { value: 'Tiên hiệp', label: 'Tiên hiệp' },
          { value: 'Đô thị', label: 'Đô thị' },
        ],
        subCategoriesTichCach: [{ value: 'Cơ Trí', label: 'Cơ Trí' }],
        subCategoriesBoiCanh: [{ value: 'Dị Thế Đại Lục', label: 'Dị Thế Đại Lục' }],
        subCategoriesLuuPhai: [{ value: 'Hệ Thống', label: 'Hệ Thống' }],
      },
      displayName: 'Thương Hải "Hoành" Lưu',
      rules: ['Bản quyền: Cấm đăng truyện đã được xuất bản.', 'Không được quảng cáo.'],
    });
  });

  it('throws when the page has no story form (e.g. the login page)', () => {
    expect(() => parseCreateBookPage('<html><body><form id="form-login"></form></body></html>')).toThrow(/form đăng truyện/);
  });
});

describe('buildCreateBookFields', () => {
  const data: CreateBookData = {
    title: ' Quỷ Bí Chi Chủ ',
    gender: 'Nam',
    type: 'truyen-cv',
    story_length: 'Truyện dài',
    chinese_title: '诡秘之主',
    chinese_link: 'https://www.qidian.com/book/1010868264/',
    author: 'Ái Tiềm Thủy Đích Ô Tặc',
    author_original: '爱潜水的乌贼',
    category: 'Huyền huyễn',
    sub_categories: ['Cơ Trí', '', 'Xuyên Không'],
    description: 'Đoạn một.\n\nĐoạn hai.\n',
  };

  it('emits the form fields in order, trimmed, skipping unchosen sub-categories', () => {
    expect(buildCreateBookFields('tok', data)).toEqual([
      ['_csrf', 'tok'],
      ['title', 'Quỷ Bí Chi Chủ'],
      ['gender', 'Nam'],
      ['type', 'truyen-cv'],
      ['story_length', 'Truyện dài'],
      ['chinese_title', '诡秘之主'],
      ['chinese_link', 'https://www.qidian.com/book/1010868264/'],
      ['author', 'Ái Tiềm Thủy Đích Ô Tặc'],
      ['author_original', '爱潜水的乌贼'],
      ['category', 'Huyền huyễn'],
      ['sub_categories', 'Cơ Trí'],
      ['sub_categories', 'Xuyên Không'],
      ['description', 'Đoạn một.\n\nĐoạn hai.'],
    ]);
  });

  it('sends empty Chinese-source fields for an original ("Sáng Tác") story', () => {
    const fields = new Map(buildCreateBookFields('tok', { ...data, type: 'sang-tac' }));
    expect(fields.get('chinese_title')).toBe('');
    expect(fields.get('chinese_link')).toBe('');
    expect(fields.get('author_original')).toBe('');
    expect(fields.get('author')).toBe('Ái Tiềm Thủy Đích Ô Tặc');
  });

  it('starts from the same defaults as the site form', () => {
    expect(EMPTY_CREATE_BOOK).toMatchObject({ gender: 'Nam', type: 'truyen-cv', story_length: 'Truyện dài' });
  });
});

describe('bookIdFromRedirect', () => {
  it('reads the story id from the cover-upload redirect', () => {
    expect(bookIdFromRedirect('/upload-anh-bia/12345')).toBe(12345);
    expect(bookIdFromRedirect('https://tiemtruyenchu.cloud/upload-anh-bia/678?new=1')).toBe(678);
  });

  it('returns null when there is no id', () => {
    expect(bookIdFromRedirect('/my-stories')).toBeNull();
    expect(bookIdFromRedirect(null)).toBeNull();
    expect(bookIdFromRedirect(undefined)).toBeNull();
  });
});
