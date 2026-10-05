import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { uploadCover } from '../api';
import { aiFillBook, isAiConfigured } from '../ai/client';
import { checkCopyright, EMPTY_CREATE_BOOK, fetchCreateBookForm, submitCreateBook } from '../createBookApi';
import { fetchSourceBook, fetchSourceCover, SOURCE_LABELS } from '../sources';
import type { BookType, CreateBookData, CreateBookForm, PendingCover } from '../types';

/** Rust commands reject with a bare string, JS code with an Error: show either. */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'string' && e) return e;
  return fallback;
}

function makeCover(bytes: number[], mime: string): PendingCover {
  const previewUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
  return { bytes, mime, previewUrl };
}

export interface CreateBookResult {
  /** null when TTC's answer did not carry the new story's id. */
  bookId: number | null;
  title: string;
  /** Set when the story was created but its cover could not be uploaded. */
  coverError: string | null;
}

/**
 * State and actions of the "Đăng Truyện Mới" form: loads TTC's form config, runs the
 * AI fill (source site → model), keeps a pending cover, and submits story + cover.
 */
export function useCreateBook() {
  const { settings } = useSettings();
  const ai = settings.ai;
  const aiConfigured = isAiConfigured(ai);

  const [form, setForm] = useState<CreateBookForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [data, setData] = useState<CreateBookData>(EMPTY_CREATE_BOOK);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Non-null while the AI fill is running: the current step, shown to the user. */
  const [aiStep, setAiStep] = useState<string | null>(null);
  const [copyright, setCopyright] = useState({ blocked: false, note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateBookResult | null>(null);
  const [retryingCover, setRetryingCover] = useState(false);

  const [cover, setCover] = useState<PendingCover | null>(null);
  const [loadingCover, setLoadingCover] = useState(false);
  /** Why the source's cover could not be downloaded (the user can retry or pick a file). */
  const [coverError, setCoverError] = useState<string | null>(null);
  /** Cover candidates of the last source read, kept so the download can be retried. */
  const [sourceCoverUrls, setSourceCoverUrls] = useState<string[]>([]);
  /** Bumped per download so a slow, superseded one cannot overwrite a newer cover. */
  const coverRequest = useRef(0);
  /** Image shown in the cropper; `ownedCropUrl` marks a temporary URL this hook must revoke. */
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const ownedCropUrl = useRef<string | null>(null);
  const coverUrl = useRef<string | null>(null);

  // ─── Load form config ─────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loaded = await fetchCreateBookForm();
        if (mounted) setForm(loaded);
      } catch (e) {
        if (mounted) setLoadError(errorMessage(e, 'Không thể tải form đăng truyện'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Object URLs outlive the component unless revoked.
  useEffect(
    () => () => {
      // Invalidate any cover download still in flight so it cannot allocate a new URL.
      coverRequest.current++;
      if (coverUrl.current) URL.revokeObjectURL(coverUrl.current);
      if (ownedCropUrl.current) URL.revokeObjectURL(ownedCropUrl.current);
    },
    [],
  );

  const replaceCover = useCallback((next: PendingCover | null) => {
    if (coverUrl.current) URL.revokeObjectURL(coverUrl.current);
    coverUrl.current = next?.previewUrl ?? null;
    setCover(next);
  }, []);

  // ─── Field setters ────────────────────────────────────────
  const setField = useCallback(<K extends keyof CreateBookData>(name: K, value: CreateBookData[K]) => {
    setData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setSubCategory = useCallback((index: 0 | 1 | 2, value: string) => {
    setData((prev) => {
      const next: [string, string, string] = [...prev.sub_categories];
      next[index] = value;
      return { ...prev, sub_categories: next };
    });
  }, []);

  /** Same behaviour as the site: an original story is authored by the account itself. */
  const setType = useCallback(
    (type: BookType) => {
      const displayName = form?.displayName ?? '';
      setData((prev) => {
        if (type === 'sang-tac') return { ...prev, type, author: displayName || prev.author };
        const wasOwnName = prev.type === 'sang-tac' && prev.author === displayName;
        return { ...prev, type, author: wasOwnName ? '' : prev.author };
      });
    },
    [form],
  );

  // ─── Copyright blocklist check (debounced, like the site) ─
  const cnTitle = data.type === 'sang-tac' ? '' : data.chinese_title.trim();
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!cnTitle) {
        if (!cancelled) setCopyright({ blocked: false, note: '' });
        return;
      }
      try {
        const checked = await checkCopyright(cnTitle);
        if (!cancelled) setCopyright(checked);
      } catch {
        // The check is advisory; TTC validates again on submit.
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cnTitle]);

  // ─── Cover ────────────────────────────────────────────────
  /**
   * Download the source's cover as the pending cover. Runs in the background (the cover
   * CDNs can be slow) and reports failure through `coverError` instead of rejecting.
   */
  const loadSourceCover = useCallback(
    async (urls: string[]): Promise<void> => {
      const request = ++coverRequest.current;
      setLoadingCover(true);
      setCoverError(null);
      try {
        const image = await fetchSourceCover(urls);
        if (request === coverRequest.current) replaceCover(makeCover(image.bytes, image.mime));
      } catch (e) {
        if (request === coverRequest.current) setCoverError(errorMessage(e, 'Không tải được ảnh bìa'));
      } finally {
        if (request === coverRequest.current) setLoadingCover(false);
      }
    },
    [replaceCover],
  );

  /** Some cover hosts take 30s+: stop waiting (the download can be retried, or a file picked). */
  const skipSourceCover = useCallback(() => {
    coverRequest.current++;
    setLoadingCover(false);
    setCoverError('Đã bỏ qua ảnh bìa gốc.');
  }, []);

  const retrySourceCover = useCallback(() => {
    if (sourceCoverUrls.length) void loadSourceCover(sourceCoverUrls);
  }, [sourceCoverUrls, loadSourceCover]);

  const closeCropper = useCallback(() => {
    if (ownedCropUrl.current) {
      URL.revokeObjectURL(ownedCropUrl.current);
      ownedCropUrl.current = null;
    }
    setCropSrc(null);
  }, []);

  const pickCoverFile = useCallback(async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      });
      if (!file) return;
      const bytes = await invoke<number[]>('ttc_read_local_file', { path: file as string });
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
      ownedCropUrl.current = url;
      setCropSrc(url);
    } catch (e) {
      setError(errorMessage(e, 'Lỗi khi mở file ảnh'));
    }
  }, []);

  const recropCover = useCallback(() => {
    if (cover) setCropSrc(cover.previewUrl);
  }, [cover]);

  const handleCropComplete = useCallback(
    async (croppedBytes: number[], mimeType: string) => {
      // A cover chosen by hand wins over a source download still in flight.
      coverRequest.current++;
      setLoadingCover(false);
      setCoverError(null);
      replaceCover(makeCover(croppedBytes, mimeType));
      closeCropper();
    },
    [replaceCover, closeCropper],
  );

  const removeCover = useCallback(() => replaceCover(null), [replaceCover]);

  // ─── AI fill ──────────────────────────────────────────────
  const runAiFill = useCallback(async () => {
    if (!form || aiStep) return;
    setError(null);
    setNotice(null);
    try {
      setAiStep('Đang lấy thông tin truyện gốc...');
      const book = await fetchSourceBook(data.chinese_link);
      const sourceLabel = SOURCE_LABELS[book.source];

      // The untranslated fields are final as soon as the source answers.
      setData((prev) => ({
        ...prev,
        chinese_title: book.title,
        chinese_link: book.link,
        author_original: book.author,
      }));
      // The cover downloads in the background and reports in its own section of the form.
      setSourceCoverUrls(book.coverUrls);
      if (book.coverUrls.length) void loadSourceCover(book.coverUrls);

      if (!aiConfigured) {
        setNotice(
          `Đã lấy tên gốc và tác giả gốc từ ${sourceLabel}. Chưa cấu hình API key cho AI nên chưa dịch được tên truyện, tác giả và văn án.`,
        );
        return;
      }

      setAiStep('AI đang dịch và phân loại...');
      // The AI bar is hidden for "Sáng Tác", so the type here is always a convert or a translation.
      const filled = await aiFillBook(ai, book, form.options, data.type === 'truyen-dich' ? 'truyen-dich' : 'truyen-cv');
      setData((prev) => ({
        ...prev,
        title: filled.title,
        author: filled.author || prev.author,
        gender: filled.gender || prev.gender,
        category: filled.category || prev.category,
        sub_categories: filled.sub_categories,
        description: filled.description || prev.description,
      }));

      // All four tags are mandatory on TTC; name the ones the model failed to pick.
      const missing = [
        filled.category ? '' : 'Thể loại',
        filled.sub_categories[0] ? '' : 'Tính cách',
        filled.sub_categories[1] ? '' : 'Bối cảnh',
        filled.sub_categories[2] ? '' : 'Lưu phái',
      ].filter(Boolean);
      setNotice(
        [
          `Đã điền từ ${sourceLabel}.`,
          missing.length ? `AI chưa chọn được: ${missing.join(', ')}. Các mục này bắt buộc, hãy chọn tay.` : '',
          'Hãy kiểm tra lại trước khi đăng.',
        ]
          .filter(Boolean)
          .join(' '),
      );
    } catch (e) {
      setError(errorMessage(e, 'AI điền thất bại'));
    } finally {
      setAiStep(null);
    }
  }, [form, aiStep, data.chinese_link, data.type, ai, aiConfigured, loadSourceCover]);

  // ─── Submit ───────────────────────────────────────────────
  /** Create the story, then upload the pending cover. Resolves with null when creation failed. */
  const submit = useCallback(async (): Promise<CreateBookResult | null> => {
    if (!form || submitting) return null;
    if (copyright.blocked) {
      setError('Tên tiếng Trung này nằm trong danh sách bản quyền bị chặn của TTC.');
      return null;
    }

    setSubmitting(true);
    setError(null);
    try {
      const bookId = await submitCreateBook(form.csrfToken, data);

      let coverError: string | null = null;
      if (cover) {
        if (bookId === null) {
          coverError = 'TTC không trả về ID truyện vừa tạo';
        } else {
          try {
            await uploadCover(bookId, cover.bytes, cover.mime);
          } catch (e) {
            coverError = errorMessage(e, 'Lỗi không rõ');
          }
        }
      }

      const created: CreateBookResult = { bookId, title: data.title.trim(), coverError };
      setResult(created);
      return created;
    } catch (e) {
      setError(errorMessage(e, 'Lỗi khi đăng truyện'));
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [form, submitting, copyright.blocked, data, cover]);

  /**
   * Upload the pending cover again for the story that was just created. TTC's gateway
   * sometimes times out on the cover request (HTTP 504) after the story itself went
   * through; the image is still in memory, so only that request is repeated.
   * Resolves with the updated result on success, null otherwise.
   */
  const retryCoverUpload = useCallback(async (): Promise<CreateBookResult | null> => {
    if (!result || result.bookId === null || !cover || retryingCover) return null;
    setRetryingCover(true);
    try {
      await uploadCover(result.bookId, cover.bytes, cover.mime);
      const done: CreateBookResult = { ...result, coverError: null };
      setResult(done);
      return done;
    } catch (e) {
      setResult({ ...result, coverError: errorMessage(e, 'Lỗi không rõ') });
      return null;
    } finally {
      setRetryingCover(false);
    }
  }, [result, cover, retryingCover]);

  return {
    form,
    loading,
    loadError,
    data,
    error,
    notice,
    aiStep,
    aiConfigured,
    copyright,
    submitting,
    result,
    retryingCover,
    /** Only possible when TTC told us which story it created and the image is still held. */
    canRetryCoverUpload: !!result && result.bookId !== null && !!cover,
    cover,
    loadingCover,
    coverError,
    canRetrySourceCover: sourceCoverUrls.length > 0,
    cropSrc,
    setField,
    setSubCategory,
    setType,
    runAiFill,
    pickCoverFile,
    recropCover,
    removeCover,
    retrySourceCover,
    skipSourceCover,
    closeCropper,
    handleCropComplete,
    submit,
    retryCoverUpload,
  };
}
