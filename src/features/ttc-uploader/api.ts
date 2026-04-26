import { invoke } from '@tauri-apps/api/core';
import type { EditBookForm, EditBookData, EditBookOptions, OptionItem } from './types';

export async function fetchEditBookForm(bookId: string | number): Promise<EditBookForm> {
  const html = await invoke<string>('ttc_fetch_html', {
    path: `/sua-truyen/${bookId}`
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const form = doc.getElementById('storyForm') as HTMLFormElement;
  if (!form) {
    throw new Error('Không tìm thấy form sửa truyện trên trang');
  }

  const actionUrl = form.getAttribute('action') || `/sua-truyen/${bookId}`;
  const csrfToken = (form.querySelector('input[name="_csrf"]') as HTMLInputElement)?.value || '';

  const data: EditBookData = {
    title: (form.querySelector('input[name="title"]') as HTMLInputElement)?.value || '',
    chinese_title: (form.querySelector('input[name="chinese_title"]') as HTMLInputElement)?.value || '',
    chinese_link: (form.querySelector('input[name="chinese_link"]') as HTMLInputElement)?.value || '',
    gender: (form.querySelector('input[name="gender"]:checked') as HTMLInputElement)?.value || 'Nam',
    type: (form.querySelector('input[name="type"]') as HTMLInputElement)?.value || 'truyen-dich',
    story_length: (form.querySelector('input[name="story_length"]:checked') as HTMLInputElement)?.value || 'Truyện dài',
    author: (form.querySelector('input[name="author"]') as HTMLInputElement)?.value || '',
    author_original: (form.querySelector('input[name="author_original"]') as HTMLInputElement)?.value || '',
    category: (form.querySelector('select[name="category"]') as HTMLSelectElement)?.value || '',
    sub_categories: [],
    description: (form.querySelector('textarea[name="description"]') as HTMLTextAreaElement)?.value || '',
    status: (form.querySelector('input[name="status"]:checked') as HTMLInputElement)?.value || 'ongoing',
  };

  // Collect sub_categories current values
  const subCatSelects = Array.from(form.querySelectorAll('select[name="sub_categories"]')) as HTMLSelectElement[];
  subCatSelects.forEach(select => {
    if (select.value) {
      data.sub_categories.push(select.value);
    }
  });

  // Extract options
  const parseOptions = (selectElem: HTMLSelectElement | null): OptionItem[] => {
    if (!selectElem) return [];
    return Array.from(selectElem.options)
      .filter(opt => opt.value && !opt.disabled)
      .map(opt => ({
        value: opt.value,
        label: opt.text.trim()
      }));
  };

  const categorySelect = form.querySelector('select[name="category"]') as HTMLSelectElement;
  
  const options: EditBookOptions = {
    categories: parseOptions(categorySelect),
    subCategoriesTichCach: parseOptions(subCatSelects[0]),
    subCategoriesBoiCanh: parseOptions(subCatSelects[1]),
    subCategoriesLuuPhai: parseOptions(subCatSelects[2]),
  };

  return { actionUrl, csrfToken, data, options };
}

export async function submitEditBookForm(actionUrl: string, csrfToken: string, data: EditBookData): Promise<void> {
  const fields: [string, string][] = [
    ['_csrf', csrfToken],
    ['title', data.title],
    ['chinese_title', data.chinese_title],
    ['chinese_link', data.chinese_link],
    ['gender', data.gender],
    ['type', data.type],
    ['story_length', data.story_length],
    ['author', data.author],
    ['author_original', data.author_original],
    ['category', data.category],
    ['description', data.description],
    ['status', data.status],
  ];

  // Append sub_categories array values
  data.sub_categories.forEach(sub => {
    if (sub) {
      fields.push(['sub_categories', sub]);
    }
  });

  await invoke('ttc_submit_multipart', {
    path: actionUrl,
    fields
  });
}

export async function uploadCover(bookId: number, imageBytes: number[], mimeType: string): Promise<void> {
  await invoke('ttc_upload_cover', {
    bookId,
    imageBytes,
    mimeType
  });
}
