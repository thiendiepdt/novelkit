import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsContext } from '@/features/settings/context/SettingsContext';
import type { ChapterFile } from '@/features/chapter-splitter/utils/splitter';
import type { ParsedChapter, TtcStory } from '../types';
import { isAiConfigured } from '../ai/client';
import { createChapterParser } from '../utils/chapterParser';
import { parseOptionsFromSettings } from '../utils/localChapters';
import { aiPickMeo } from './ai';
import { buildMeoImport, orderPicks, type MeoPicks } from './buildImport';
import {
  alreadyFinalized,
  describeError,
  duplicatesOf,
  fetchGenres,
  finalizeImport,
  openImport,
  retriable,
  sendChapters,
  tokenSource,
  type TokenSource,
} from './client';
import { buildMeoCover, type MeoCover } from './cover';
import { chapterBatches } from './rules';
import type { MeoDuplicate, MeoGenre, MeoImportResult, MeoLink } from './types';

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

const errorText = (e: unknown) => (e instanceof Error && e.message ? e.message : typeof e === 'string' ? e : 'Lỗi không rõ.');

/** A step that loads once when the modal opens. */
type Load<T> = { state: 'loading' } | { state: 'ok'; value: T } | { state: 'error'; message: string };

export type MeoPhase = 'ready' | 'duplicate' | 'sending' | 'done';

export interface MeoProgress {
  step: 'open' | 'send' | 'finalize';
  sent: number;
  total: number;
}

async function withRetries<T>(run: () => Promise<T>, stopped: () => boolean): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (e) {
      if (attempt >= ATTEMPTS || !retriable(e) || stopped()) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

/**
 * One story to Mèo Truyện: reads the folder, the site's genres and the TTC poster when it
 * opens, lets the model pick genres, tags and the editor's note (unless an earlier import
 * left picks to reuse), then sends the import job. A story imported before is overwritten
 * without asking as long as that loses nothing; any other duplicate is put to the user.
 */
export function useMeoTruyenUpload(story: TtcStory, link: MeoLink | undefined, onImported: (link: MeoLink) => void) {
  const { globalSettings, bookSettings, getSettingsForBook } = useSettingsContext();
  const token = globalSettings.meoTruyen.token;
  const ai = globalSettings.ai;
  const folder = bookSettings[story.id]?.ttcUploader?.folderPath || '';
  // The folder is read once per opening, with the split settings of that moment.
  const parseOpts = useRef(parseOptionsFromSettings(getSettingsForBook(story.id)));

  const [genres, setGenres] = useState<Load<MeoGenre[]>>({ state: 'loading' });
  const [chapters, setChapters] = useState<Load<ParsedChapter[]>>(
    folder ? { state: 'loading' } : { state: 'error', message: 'Truyện chưa chọn folder: mở "Quản lý chương" để chọn folder chương.' },
  );
  const [cover, setCover] = useState<Load<MeoCover | null>>(story.poster ? { state: 'loading' } : { state: 'ok', value: null });
  const [source, setSource] = useState<TokenSource | null>(null);

  const [picks, setPicks] = useState<MeoPicks>({ genres: link?.genres ?? [], editorNote: link?.editorNote ?? '' });
  const [aiState, setAiState] = useState<{ running: boolean; error: string | null }>({ running: false, error: null });

  const [phase, setPhase] = useState<MeoPhase>('ready');
  const [progress, setProgress] = useState<MeoProgress | null>(null);
  const [duplicates, setDuplicates] = useState<MeoDuplicate[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<{ book: MeoImportResult | null; overwrote: boolean } | null>(null);

  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

  // ─── Loads ───────────────────────────────────────────────
  useEffect(() => {
    tokenSource(token).then(setSource, () => setSource(null));
  }, [token]);

  const runAi = useCallback(
    async (known: MeoGenre[]) => {
      setAiState({ running: true, error: null });
      try {
        const picked = await aiPickMeo(ai, story, known);
        if (closedRef.current) return;
        setPicks({ genres: [...picked.genres, ...picked.tags], editorNote: picked.editorNote });
        setAiState({ running: false, error: null });
      } catch (e) {
        if (!closedRef.current) setAiState({ running: false, error: errorText(e) });
      }
    },
    [ai, story],
  );

  const aiReady = isAiConfigured(ai);
  // Picks of an earlier import are kept; the model is asked only for a story without them.
  const askAiFirst = useRef(!link && aiReady);
  useEffect(() => {
    let cancelled = false;
    fetchGenres().then(
      (list) => {
        if (cancelled) return;
        setGenres({ state: 'ok', value: list });
        if (askAiFirst.current) {
          askAiFirst.current = false;
          void runAi(list);
        }
      },
      (e) => !cancelled && setGenres({ state: 'error', message: `Không tải được thể loại của Mèo Truyện: ${describeError(e)}` }),
    );
    return () => {
      cancelled = true;
    };
  }, [runAi]);

  useEffect(() => {
    if (!folder) return;
    let cancelled = false;
    const parser = createChapterParser();
    (async () => {
      try {
        const files = await invoke<ChapterFile[]>('ttc_read_folder_files', { folderPath: folder });
        const list = await parser.allChapters(files, parseOpts.current);
        if (!cancelled) setChapters({ state: 'ok', value: list });
      } catch (e) {
        if (!cancelled) setChapters({ state: 'error', message: `Không đọc được folder: ${errorText(e)}` });
      } finally {
        parser.dispose();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folder]);

  useEffect(() => {
    if (!story.poster) return;
    let cancelled = false;
    buildMeoCover(story.poster).then(
      (value) => !cancelled && setCover({ state: 'ok', value }),
      (e) => !cancelled && setCover({ state: 'error', message: `Không lấy được ảnh bìa: ${errorText(e)}` }),
    );
    return () => {
      cancelled = true;
    };
  }, [story.poster]);

  // ─── Build ───────────────────────────────────────────────
  const known = genres.state === 'ok' ? genres.value : null;
  const parsed = chapters.state === 'ok' ? chapters.value : null;
  const build = useMemo(() => (known && parsed ? buildMeoImport(story, parsed, picks, known) : null), [story, parsed, picks, known]);
  const loading = genres.state === 'loading' || chapters.state === 'loading' || cover.state === 'loading';
  const canSend =
    phase === 'ready' && !loading && !aiState.running && source !== 'none' && !!build && build.problems.length === 0;

  const togglePick = useCallback(
    (slug: string) =>
      setPicks((prev) => ({
        ...prev,
        genres: prev.genres.includes(slug) ? prev.genres.filter((s) => s !== slug) : [...prev.genres, slug],
      })),
    [],
  );
  const setEditorNote = useCallback((editorNote: string) => setPicks((prev) => ({ ...prev, editorNote })), []);
  const rerunAi = useCallback(() => {
    if (known) void runAi(known);
  }, [known, runAi]);

  // ─── Send ────────────────────────────────────────────────
  const send = useCallback(
    async (overwriteBookId?: number) => {
      if (!build || build.problems.length > 0 || !known) return;
      const stopped = () => closedRef.current;
      setPhase('sending');
      setSendError(null);
      setDuplicates([]);
      const total = build.texts.length;
      setProgress({ step: 'open', sent: 0, total });
      const coverValue = cover.state === 'ok' && cover.value ? { full: cover.value.full, thumb: cover.value.thumb } : null;
      let target = overwriteBookId;
      let jobId: string | null = null;
      while (jobId === null) {
        const input = { ...build.open, cover: coverValue, ...(target ? { overwriteBookId: target } : {}) };
        try {
          jobId = (await openImport(token, input)).jobId;
        } catch (e) {
          if (stopped()) return;
          const matches = duplicatesOf(e);
          // The book this story was imported as, and nothing of it would be lost: just update it.
          const own = matches && link ? matches.find((m) => m.id === link.bookId) : undefined;
          if (own && own.chaptersDeleted === 0 && target === undefined) {
            target = own.id;
            continue;
          }
          if (matches) {
            setDuplicates(matches);
            setPhase('duplicate');
          } else {
            setSendError(describeError(e));
            setPhase('ready');
          }
          setProgress(null);
          return;
        }
      }
      const opened = jobId;
      setProgress({ step: 'send', sent: 0, total });

      try {
        const byNumber = new Map(build.texts.map((t) => [t.number, t]));
        let sent = 0;
        for (const batch of chapterBatches(build.texts)) {
          if (stopped()) return;
          const body = batch.map((n) => ({ number: n, text: byNumber.get(n)!.text }));
          await withRetries(() => sendChapters(token, opened, body), stopped);
          sent += batch.length;
          if (!stopped()) setProgress({ step: 'send', sent, total });
        }
        if (stopped()) return;
        setProgress({ step: 'finalize', sent, total });
        let book: MeoImportResult | null;
        try {
          book = await withRetries(() => finalizeImport(token, opened), stopped);
        } catch (e) {
          if (!alreadyFinalized(e)) throw e;
          // The book exists: an earlier attempt finalized and only its reply was lost.
          book = null;
        }
        if (stopped()) return;
        const bookId = book?.id ?? target;
        if (bookId) {
          onImported({
            bookId,
            slug: book?.slug ?? link?.slug ?? '',
            genres: orderPicks(picks.genres, known),
            editorNote: picks.editorNote.trim(),
            chapters: total,
            at: Date.now(),
          });
        }
        setResult({ book: book ?? (bookId ? { id: bookId, slug: link?.slug ?? '' } : null), overwrote: !!target });
        setPhase('done');
        setProgress(null);
      } catch (e) {
        if (stopped()) return;
        setSendError(`${describeError(e)} (phiên nạp chưa chốt, truyện trên Mèo Truyện chưa đổi gì; bấm gửi lại để nạp từ đầu)`);
        setPhase('ready');
        setProgress(null);
      }
    },
    [build, known, cover, token, link, onImported, picks],
  );

  const backFromDuplicate = useCallback(() => {
    setDuplicates([]);
    setPhase('ready');
  }, []);

  return {
    tokenSource: source,
    genres,
    chapters,
    cover,
    picks,
    togglePick,
    setEditorNote,
    aiReady,
    aiState,
    rerunAi,
    build,
    loading,
    canSend,
    phase,
    progress,
    duplicates,
    sendError,
    result,
    send,
    backFromDuplicate,
  };
}
