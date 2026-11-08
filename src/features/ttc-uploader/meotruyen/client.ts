import { invoke } from '@tauri-apps/api/core';
import { MeoApiError } from './types';
import type { MeoDuplicate, MeoGenre, MeoImportOpenInput, MeoImportOpened, MeoImportResult } from './types';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Rust rejects with `{ status, code, message, details }`; anything else is a bare failure. */
function toApiError(e: unknown): MeoApiError {
  if (e instanceof MeoApiError) return e;
  if (isRecord(e) && typeof e.message === 'string') {
    return new MeoApiError(
      typeof e.status === 'number' ? e.status : 0,
      typeof e.code === 'string' ? e.code : 'unknown',
      e.message,
      e.details,
    );
  }
  return new MeoApiError(0, 'unknown', e instanceof Error ? e.message : typeof e === 'string' ? e : 'Lỗi không rõ.');
}

async function call<T>(command: string, args: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    throw toApiError(e);
  }
}

export type TokenSource = 'settings' | 'env' | 'none';

/** Where the token of the next call comes from: the settings field, or MEOTRUYEN_TOKEN. */
export const tokenSource = (token: string) => call<TokenSource>('meotruyen_token_source', { token });

export const fetchGenres = () => call<MeoGenre[]>('meotruyen_genres', {});

export const openImport = (token: string, input: MeoImportOpenInput) =>
  call<MeoImportOpened>('meotruyen_import_open', { token, input });

export const sendChapters = (token: string, jobId: string, chapters: { number: number; text: string }[]) =>
  call<{ received: number }>('meotruyen_import_send', { token, jobId, chapters });

export const finalizeImport = (token: string, jobId: string) =>
  call<MeoImportResult>('meotruyen_import_finalize', { token, jobId });

/** Network failures and 5xx are worth another try; a 4xx is the site's answer. */
export const retriable = (e: unknown) => !(e instanceof MeoApiError) || e.status === 0 || e.status >= 500;

/** The books an open job collided with (409 `duplicate_book`). */
export function duplicatesOf(e: unknown): MeoDuplicate[] | null {
  if (!(e instanceof MeoApiError) || e.code !== 'duplicate_book') return null;
  const matches = isRecord(e.details) ? e.details.matches : undefined;
  return Array.isArray(matches) ? (matches as MeoDuplicate[]) : [];
}

/**
 * A finalize that answers 409 `import_closed` with status `done`: an earlier attempt already
 * created the book and only its reply was lost.
 */
export const alreadyFinalized = (e: unknown) =>
  e instanceof MeoApiError && e.code === 'import_closed' && isRecord(e.details) && e.details.status === 'done';

/** Every problem of a 400 (the site lists them all in `details.problems`). */
export function problemLines(e: MeoApiError): string[] {
  const problems = isRecord(e.details) ? e.details.problems : undefined;
  const lines = (Array.isArray(problems) ? problems : []).flatMap((p: unknown) =>
    isRecord(p) && typeof p.message === 'string' ? [p.message] : [],
  );
  return lines.length > 0 ? lines : [e.message];
}

/** A failure in words the user can act on. */
export function describeError(e: unknown): string {
  const err = toApiError(e);
  // The site answers a bad token with a plain 404, as if the route did not exist; its own
  // 404s (a job or a book gone) carry a code of their own.
  const ownNotFound = ['import_not_found', 'book_not_found'].includes(err.code);
  if ((err.status === 404 && !ownNotFound) || err.status === 401 || err.status === 403) {
    return 'Mèo Truyện không nhận token này (sai, hết hạn, đã thu hồi, hoặc người tạo token không còn quyền nạp truyện). Tạo token mới ở trang "Token nạp truyện" của khu quản trị.';
  }
  if (err.status === 400) return `Mèo Truyện từ chối dữ liệu nạp: ${problemLines(err).join(' · ')}`;
  return err.message;
}
