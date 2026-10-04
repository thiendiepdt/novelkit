import { invoke } from '@tauri-apps/api/core';
import type { AiSettings } from '@/features/settings/types';
import type { EditBookOptions } from '../types';
import type { SourceBook } from '../sources/types';
import { buildFillPrompt, parseFillResponse } from './fill';
import type { AiFillResult, FillBookType } from './fill';

/** True when the selected provider has an API key. */
export function isAiConfigured(ai: AiSettings): boolean {
  return ai[ai.provider].apiKey.trim() !== '';
}

/**
 * Ask the configured model (Gemini or any OpenAI-compatible endpoint) to fill the
 * Vietnamese fields of the create-story form. The HTTP call is made in Rust so it
 * is not subject to the webview's CORS rules.
 */
export async function aiFillBook(
  ai: AiSettings,
  book: SourceBook,
  options: EditBookOptions,
  type: FillBookType,
): Promise<AiFillResult> {
  const config = ai[ai.provider];
  const { system, user } = buildFillPrompt(book, options, type);
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
}
