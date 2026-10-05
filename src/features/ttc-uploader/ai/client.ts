import { invoke } from '@tauri-apps/api/core';
import type { AiSettings } from '@/features/settings/types';
import type { EditBookOptions } from '../types';
import type { SourceBook } from '../sources/types';
import { AiContentBlockedError, buildFillPrompt, isContentBlock, parseFillResponse } from './fill';
import type { AiFillResult, FillBookType } from './fill';

/** True when the selected provider has an API key. */
export function isAiConfigured(ai: AiSettings): boolean {
  return ai[ai.provider].apiKey.trim() !== '';
}

export interface AiFillOutcome extends AiFillResult {
  /**
   * The provider's content filter rejected the synopsis, so the fields were filled from the
   * title, category and tags only and `description` is empty.
   */
  synopsisBlocked: boolean;
}

/** Shown when the provider refuses the book even without its synopsis. */
export const AI_BLOCKED_MESSAGE =
  'Nhà cung cấp AI từ chối truyện này vì bộ lọc nội dung của họ (bộ lọc này không tắt được từ app). ' +
  'Hãy điền tay, hoặc đổi sang nhà cung cấp / model khác trong Cài đặt → AI.';

/** Rust commands reject with a bare string, JS code with an Error. */
const messageOf = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : '');

const isBlocked = (e: unknown) => e instanceof AiContentBlockedError || isContentBlock(messageOf(e));

/**
 * Ask the configured model (Gemini or any OpenAI-compatible endpoint) to fill the
 * Vietnamese fields of the create-story form. The HTTP call is made in Rust so it
 * is not subject to the webview's CORS rules.
 *
 * Content filters are the one failure worth working around: romance synopses in
 * particular trip Google's non-configurable filters. When the full prompt is refused,
 * the request is repeated once without the synopsis, so everything but the description
 * still gets filled.
 */
export async function aiFillBook(
  ai: AiSettings,
  book: SourceBook,
  options: EditBookOptions,
  type: FillBookType,
): Promise<AiFillOutcome> {
  const config = ai[ai.provider];

  const ask = async (omitSynopsis: boolean): Promise<AiFillResult> => {
    const { system, user } = buildFillPrompt(book, options, type, omitSynopsis);
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
    return parseFillResponse(reply, options);
  };

  try {
    return { ...(await ask(false)), synopsisBlocked: false };
  } catch (e) {
    if (!isBlocked(e)) throw e;
    // Nothing left to take out of the prompt.
    if (!book.intro) throw new Error(AI_BLOCKED_MESSAGE);
  }

  try {
    return { ...(await ask(true)), description: '', synopsisBlocked: true };
  } catch (e) {
    if (isBlocked(e)) throw new Error(AI_BLOCKED_MESSAGE);
    throw e;
  }
}
