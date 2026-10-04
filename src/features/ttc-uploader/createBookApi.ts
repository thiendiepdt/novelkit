import { invoke } from '@tauri-apps/api/core';
import { parseBookFormOptions } from './api';
import type { CreateBookData, CreateBookForm } from './types';

export const EMPTY_CREATE_BOOK: CreateBookData = {
  title: '',
  gender: 'Nam',
  type: 'truyen-cv',
  story_length: 'Truyện dài',
  chinese_title: '',
  chinese_link: '',
  author: '',
  author_original: '',
  category: '',
  sub_categories: ['', '', ''],
  description: '',
};

/** Read csrf token, option lists, display name and posting rules out of the create page. */
export function parseCreateBookPage(html: string): CreateBookForm {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const form = doc.getElementById('storyForm') as HTMLFormElement | null;
  if (!form) {
    throw new Error('Không tìm thấy form đăng truyện trên trang (có thể phiên đăng nhập đã hết hạn)');
  }

  const csrfToken = (form.querySelector('input[name="_csrf"]') as HTMLInputElement | null)?.value || '';

  // PAGE_DATA is an inline script: `currentDisplayName: "..."` (a JS string literal).
  let displayName = '';
  const nameMatch = html.match(/currentDisplayName:\s*("(?:[^"\\]|\\.)*")/);
  if (nameMatch) {
    try {
      displayName = String(JSON.parse(nameMatch[1]));
    } catch {
      displayName = '';
    }
  }

  // The rules card is the only ordered list on the page.
  const rules = Array.from(doc.querySelectorAll('ol li'))
    .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return { csrfToken, options: parseBookFormOptions(form), displayName, rules };
}

export async function fetchCreateBookForm(): Promise<CreateBookForm> {
  const html = await invoke<string>('ttc_fetch_html', { path: '/dang-truyen' });
  return parseCreateBookPage(html);
}

/**
 * Multipart fields in the order of TTC's form. "Sáng Tác" stories have no Chinese
 * source: the site hides those inputs, so they are sent empty.
 */
export function buildCreateBookFields(csrfToken: string, data: CreateBookData): [string, string][] {
  const original = data.type === 'sang-tac';
  const fields: [string, string][] = [
    ['_csrf', csrfToken],
    ['title', data.title.trim()],
    ['gender', data.gender],
    ['type', data.type],
    ['story_length', data.story_length],
    ['chinese_title', original ? '' : data.chinese_title.trim()],
    ['chinese_link', original ? '' : data.chinese_link.trim()],
    ['author', data.author.trim()],
    ['author_original', original ? '' : data.author_original.trim()],
    ['category', data.category],
  ];
  data.sub_categories.forEach((sub) => {
    if (sub) fields.push(['sub_categories', sub]);
  });
  fields.push(['description', data.description.trim()]);
  return fields;
}

/** The new story's id, from the cover-upload page TTC redirects to after creating it. */
export function bookIdFromRedirect(redirectUrl: string | null | undefined): number | null {
  const m = (redirectUrl || '').match(/\/(\d+)(?:[/?#]|$)/);
  return m ? Number(m[1]) : null;
}

interface CreateStoryResponse {
  success: boolean;
  message: string | null;
  redirectUrl: string | null;
}

/**
 * Create the story. Resolves with its id (null if TTC's answer did not carry one);
 * rejects with TTC's own message when it refuses (duplicate story, banned words, ...).
 */
export async function submitCreateBook(csrfToken: string, data: CreateBookData): Promise<number | null> {
  const resp = await invoke<CreateStoryResponse>('ttc_create_story', {
    fields: buildCreateBookFields(csrfToken, data),
  });
  if (!resp.success) {
    throw new Error(resp.message || 'TTC từ chối đăng truyện (không rõ lý do)');
  }
  return bookIdFromRedirect(resp.redirectUrl);
}

/** TTC's blocklist of licensed titles, checked by Chinese title. */
export async function checkCopyright(chineseTitle: string): Promise<{ blocked: boolean; note: string }> {
  const text = await invoke<string>('ttc_fetch_html', {
    path: `/api/check-copyright?cn=${encodeURIComponent(chineseTitle.trim())}`,
  });
  const data = JSON.parse(text) as { blocked?: boolean; note?: string | null };
  return { blocked: !!data.blocked, note: data.note || '' };
}
