import { useCallback, useRef, useState } from 'react';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { aiFillBook, isAiConfigured } from '../ai/client';
import type { AiFillOutcome } from '../ai/client';
import { fetchSourceBook, fetchSourceCover, SOURCE_LABELS } from '../sources';
import type { SourceBook } from '../sources';
import type { EditBookOptions } from '../types';

/** Rust commands reject with a bare string, JS code with an Error: show either. */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'string' && e) return e;
  return fallback;
}

export interface SourceCoverImage {
  bytes: number[];
  mime: string;
  source: SourceBook['source'];
}

/**
 * Re-read an existing story's source site (its "Link gốc") for the edit form: run the AI
 * fill again on it, or download its cover again. The source page is read once per link
 * and shared by both actions. Results are returned to the caller, which decides what to
 * do with them; nothing here touches the form or TTC.
 */
export function useSourceRefill(link: string, options: EditBookOptions | null, type: string) {
  const { settings } = useSettings();
  const ai = settings.ai;
  const aiConfigured = isAiConfigured(ai);

  /** Non-null while an action runs: the current step, shown to the user. */
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<{ link: string; book: SourceBook } | null>(null);

  /** "Sáng Tác" stories have no source; a story without a link has nothing to read. */
  const canUseSource = link.trim() !== '' && type !== 'sang-tac';

  const readSource = useCallback(async (): Promise<SourceBook> => {
    if (cache.current?.link === link) return cache.current.book;
    const book = await fetchSourceBook(link);
    cache.current = { link, book };
    return book;
  }, [link]);

  /** Read the source and ask the model again. Resolves with null when it failed (error is set). */
  const aiRefill = useCallback(async (): Promise<{ filled: AiFillOutcome; book: SourceBook } | null> => {
    if (!options || step) return null;
    setError(null);
    try {
      setStep('Đang đọc trang gốc...');
      const book = await readSource();
      setStep('AI đang dịch và phân loại...');
      const filled = await aiFillBook(ai, book, options, type === 'truyen-dich' ? 'truyen-dich' : 'truyen-cv');
      return { filled, book };
    } catch (e) {
      setError(errorMessage(e, 'AI điền thất bại'));
      return null;
    } finally {
      setStep(null);
    }
  }, [options, step, readSource, ai, type]);

  /** Read the source and download its cover. Resolves with null when it failed (error is set). */
  const downloadCover = useCallback(async (): Promise<SourceCoverImage | null> => {
    if (step) return null;
    setError(null);
    try {
      setStep('Đang đọc trang gốc...');
      const book = await readSource();
      if (!book.coverUrls.length) {
        throw new Error(`${SOURCE_LABELS[book.source]} không có ảnh bìa cho truyện này`);
      }
      setStep('Đang tải ảnh bìa từ trang gốc...');
      const image = await fetchSourceCover(book.coverUrls);
      return { ...image, source: book.source };
    } catch (e) {
      setError(errorMessage(e, 'Không tải được ảnh bìa từ trang gốc'));
      return null;
    } finally {
      setStep(null);
    }
  }, [step, readSource]);

  const clearError = useCallback(() => setError(null), []);

  return { canUseSource, aiConfigured, step, error, clearError, aiRefill, downloadCover };
}
