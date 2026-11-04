import { invoke } from '@tauri-apps/api/core';
import type { EditBookForm, EditBookData, EditBookOptions, OptionItem } from './types';

/**
 * Option lists of TTC's story form (`#storyForm`), shared by the edit and create pages:
 * one category select followed by three `sub_categories` selects (tính cách, bối cảnh, lưu phái).
 */
export function parseBookFormOptions(form: HTMLFormElement): EditBookOptions {
  const parseOptions = (selectElem: HTMLSelectElement | null | undefined): OptionItem[] => {
    if (!selectElem) return [];
    return Array.from(selectElem.options)
      .filter(opt => opt.value && !opt.disabled)
      .map(opt => ({
        value: opt.value,
        label: opt.text.trim()
      }));
  };

  const subCatSelects = Array.from(form.querySelectorAll('select[name="sub_categories"]')) as HTMLSelectElement[];

  return {
    categories: parseOptions(form.querySelector('select[name="category"]') as HTMLSelectElement | null),
    subCategoriesTichCach: parseOptions(subCatSelects[0]),
    subCategoriesBoiCanh: parseOptions(subCatSelects[1]),
    subCategoriesLuuPhai: parseOptions(subCatSelects[2]),
  };
}

/**
 * A field of the story form as TTC's own page posts it (FormData: checked radios, selected
 * options, hidden inputs), whatever control carries it: the type is a select while the story
 * waits for approval. A disabled control that only displays the value is the fallback.
 */
function formValue(form: HTMLFormElement, posted: FormData, name: string): string {
  const value = posted.get(name);
  if (typeof value === 'string') return value;
  const controls = Array.from(form.querySelectorAll(`[name="${name}"]`)) as (HTMLInputElement | HTMLSelectElement)[];
  const control = controls.find((c) => !('checked' in c) || (c.type !== 'radio' && c.type !== 'checkbox') || c.checked);
  return control?.value ?? '';
}

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

  const posted = new FormData(form);
  const value = (name: string) => formValue(form, posted, name);
  const data: EditBookData = {
    title: value('title'),
    chinese_title: value('chinese_title'),
    chinese_link: value('chinese_link'),
    gender: value('gender') || 'Nam',
    type: value('type') || 'truyen-dich',
    story_length: value('story_length') || 'Truyện dài',
    author: value('author'),
    author_original: value('author_original'),
    category: value('category'),
    // Positional [tính cách, bối cảnh, lưu phái], '' for one not chosen.
    sub_categories: (Array.from(form.querySelectorAll('select[name="sub_categories"]')) as HTMLSelectElement[]).map(s => s.value),
    description: value('description'),
    status: value('status') || 'ongoing',
  };

  const options = parseBookFormOptions(form);

  return { actionUrl, csrfToken, data, options };
}

export async function submitEditBookForm(actionUrl: string, csrfToken: string, data: EditBookData): Promise<void> {
  const fields: [string, string][] = [
    ['_csrf', csrfToken],
    ['title', data.title.trim()],
    ['chinese_title', data.chinese_title.trim()],
    ['chinese_link', data.chinese_link.trim()],
    ['gender', data.gender],
    ['type', data.type],
    ['story_length', data.story_length],
    ['author', data.author.trim()],
    ['author_original', data.author_original.trim()],
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

/**
 * Delete one of the account stories on TTC. Irreversible: confirm with the user first.
 * Resolves with the confirmation message of TTC, or null when TTC said nothing either way
 * (re-check the list). Rejects with the reason when TTC refuses.
 */
export async function deleteBook(bookId: number): Promise<string | null> {
  return invoke<string | null>('ttc_delete_story', { bookId });
}
