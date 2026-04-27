import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettings } from '@/features/settings/hooks/useSettings';
import type { LocalSortMode, UnlockTimer } from '@/features/settings/types';
import { useUploadQueueContext } from '@/shared/context/UploadQueueContext';
import { splitMultipleChapters } from '@/features/chapter-splitter/utils/splitter';
import { DEFAULT_CHAPTERS_LIMIT } from '../constants';
import type {
  TtcStory,
  TtcChapter,
  TtcChaptersResponse,
  ParsedChapter,
  UploadProgress,
  UploadOptions,
  SyncMode,
  DownloadedChapter,
} from '../types';

const INITIAL_PROGRESS: UploadProgress = {
  current: 0,
  total: 0,
  current_title: '',
  success: 0,
  failed: 0,
  status: 'idle',
};

/**
 * Manages chapter operations for a selected book:
 * remote chapter listing, local folder parsing, upload, and single-chapter download.
 */
export function useTtcChapters(selectedBook: TtcStory | null) {
  // Remote chapter list (paginated, for the ChapterTable view)
  const [remoteChapters, setRemoteChapters] = useState<TtcChapter[]>([]);
  const [remoteChapPage, setRemoteChapPage] = useState(1);
  const [remoteChapTotalPages, setRemoteChapTotalPages] = useState(1);
  const [remoteChapTotal, setRemoteChapTotal] = useState(0);
  const [loadingRemoteChaps, setLoadingRemoteChaps] = useState(false);

  const { settings, updateSettings } = useSettings(selectedBook?.id);
  const chaptersLimit = settings.ttcUploader.chaptersLimit;
  const setChaptersLimit = useCallback((v: number) => updateSettings('ttcUploader', { chaptersLimit: v }), [updateSettings]);

  // All remote chapters (for comparison tab)
  const [allRemoteChapters, setAllRemoteChapters] = useState<TtcChapter[]>([]);
  const [loadingAllRemote, setLoadingAllRemote] = useState(false);

  // Local chapters (from folder)
  const [chapters, setChapters] = useState<ParsedChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [rawFolderText, setRawFolderText] = useState<string>('');

  // Chapter Splitter Settings
  const { maxWords, minWords, roundUp } = settings.splitter;
  const { enableSplit, splitFromChapter, uploadDelayMs: delayMs, localSortMode, folderPath, chapterPrice, unlockTimer, vipNewChaptersOnly } = settings.ttcUploader;

  const setEnableSplit = useCallback((v: boolean) => updateSettings('ttcUploader', { enableSplit: v }), [updateSettings]);
  const setSplitFromChapter = useCallback((v: number) => updateSettings('ttcUploader', { splitFromChapter: v }), [updateSettings]);
  const setVipNewChaptersOnly = useCallback((v: boolean) => updateSettings('ttcUploader', { vipNewChaptersOnly: v }), [updateSettings]);
  const setMaxWords = useCallback((v: number) => updateSettings('splitter', { maxWords: v }), [updateSettings]);
  const setMinWords = useCallback((v: number) => updateSettings('splitter', { minWords: v }), [updateSettings]);
  const setRoundUp = useCallback((v: boolean) => updateSettings('splitter', { roundUp: v }), [updateSettings]);
  const setDelayMs = useCallback((v: number) => updateSettings('ttcUploader', { uploadDelayMs: v }), [updateSettings]);
  const setLocalSortMode = useCallback((v: LocalSortMode) => updateSettings('ttcUploader', { localSortMode: v }), [updateSettings]);
  const setChapterPrice = useCallback((v: number) => updateSettings('ttcUploader', { chapterPrice: v }), [updateSettings]);
  const setUnlockTimer = useCallback((v: UnlockTimer) => updateSettings('ttcUploader', { unlockTimer: v }), [updateSettings]);

  // Upload settings & progress
  const [syncMode, setSyncMode] = useState<SyncMode>('all');
  const [fromIndex, setFromIndex] = useState(1);
  const [toIndex, setToIndex] = useState(999);

  // Derive progress from the upload queue
  const { addJob, getJobForBook, cancelJob, removeJob } = useUploadQueueContext();
  const currentJob = selectedBook ? getJobForBook(selectedBook.id) : undefined;
  
  const progress: UploadProgress = currentJob
    ? {
        ...(currentJob.progress || INITIAL_PROGRESS),
        status: (currentJob.status === 'error'
          ? 'error'
          : (currentJob.progress?.status || currentJob.status)) as UploadProgress['status'],
        message: currentJob.status === 'error' 
          ? currentJob.error 
          : (currentJob.progress?.message || (currentJob.status === 'pending' ? 'Đang đợi trong hàng...' : '')),
      }
    : INITIAL_PROGRESS;

  // Fetch remote chapters (paginated)
  const fetchRemoteChapters = useCallback(async (bookId: number, page = 1, limit = DEFAULT_CHAPTERS_LIMIT) => {
    setLoadingRemoteChaps(true);
    try {
      const resp = await invoke<TtcChaptersResponse>('ttc_fetch_chapters', {
        bookId,
        page,
        limit,
      });
      setRemoteChapters(resp.chapters);
      setRemoteChapTotalPages(resp.totalPages);
      setRemoteChapTotal(resp.totalChapters);
      setRemoteChapPage(page);
    } catch (e) {
      console.error('Fetch chapters error:', e);
      setRemoteChapters([]);
    } finally {
      setLoadingRemoteChaps(false);
    }
  }, []);

  // Auto-refetch remote chapters when upload completes
  const prevUploadStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentStatus = currentJob?.status;
    if (prevUploadStatusRef.current === 'running' && currentStatus === 'done' && selectedBook) {
      fetchRemoteChapters(selectedBook.id, 1, chaptersLimit);
    }
    prevUploadStatusRef.current = currentStatus;
  }, [currentJob?.status, selectedBook, fetchRemoteChapters, chaptersLimit]);

  // Fetch ALL remote chapters for comparison
  const fetchAllRemoteChapters = useCallback(async (bookId: number) => {
    setLoadingAllRemote(true);
    setAllRemoteChapters([]);
    const limit = 1000;
    try {
      const first = await invoke<TtcChaptersResponse>('ttc_fetch_chapters', { bookId, page: 1, limit });
      const allChapters: TtcChapter[] = [...first.chapters];

      // Fetch remaining pages if total > 1000
      if (first.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: first.totalPages - 1 }, (_, i) =>
            invoke<TtcChaptersResponse>('ttc_fetch_chapters', { bookId, page: i + 2, limit })
          )
        );
        rest.forEach(r => allChapters.push(...r.chapters));
      }

      allChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
      setAllRemoteChapters(allChapters);
    } catch (e) {
      console.error('Fetch all chapters error:', e);
    } finally {
      setLoadingAllRemote(false);
    }
  }, []);

  // Load folder text from a given path
  const loadFolder = useCallback(async (path: string) => {
    setLoadingChapters(true);
    try {
      const rawText = await invoke<string>('ttc_read_folder_text', {
        folderPath: path,
      });
      setRawFolderText(rawText);
    } catch (e) {
      console.error('Parse error:', e);
      setRawFolderText('');
    } finally {
      setLoadingChapters(false);
    }
  }, []);

  // Pick folder and parse local .txt files
  const handlePickFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      title: 'Chọn folder chứa file chương (.txt)',
    });
    if (selected) {
      updateSettings('ttcUploader', { folderPath: selected });
      await loadFolder(selected);
    }
  }, [loadFolder, updateSettings]);

  // Reload current folder
  const handleReloadFolder = useCallback(async () => {
    if (folderPath) {
      await loadFolder(folderPath);
    }
  }, [folderPath, loadFolder]);

  // Auto-load saved folder when book is selected
  const autoLoadedRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedBook && folderPath && autoLoadedRef.current !== selectedBook.id) {
      autoLoadedRef.current = selectedBook.id;
      loadFolder(folderPath);
    }
  }, [selectedBook, folderPath, loadFolder]);

  // Process raw text into chapters whenever settings or text changes (debounced)
  const [processingChapters, setProcessingChapters] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  /**
   * Natural sort comparator for chapter titles.
   * Extracts leading number from "Chương X" pattern for numeric comparison,
   * falls back to locale string comparison for non-numeric titles.
   */
  const naturalTitleSort = useCallback((a: ParsedChapter, b: ParsedChapter) => {
    const numRegex = /chương\s+(\d+)/i;
    const matchA = a.title.match(numRegex);
    const matchB = b.title.match(numRegex);
    if (matchA && matchB) {
      const numA = parseInt(matchA[1], 10);
      const numB = parseInt(matchB[1], 10);
      if (numA !== numB) return numA - numB;
      // Same chapter number — compare full title (e.g., part suffixes)
      return a.title.localeCompare(b.title, 'vi');
    }
    // Chapters with numbers come first
    if (matchA) return -1;
    if (matchB) return 1;
    return a.title.localeCompare(b.title, 'vi');
  }, []);
  
  useEffect(() => {
    if (!rawFolderText) {
      setChapters([]);
      setProcessingChapters(false);
      return;
    }

    setProcessingChapters(true);
    clearTimeout(debounceTimerRef.current);
    
    debounceTimerRef.current = setTimeout(() => {
      const actualMaxWords = enableSplit ? maxWords : Number.MAX_SAFE_INTEGER;
      const actualMinWords = enableSplit ? minWords : 0;

      // splitMultipleChapters now handles duplicate title removal internally
      const result = splitMultipleChapters(rawFolderText, actualMaxWords, roundUp, actualMinWords, splitFromChapter);

      let parsedChapters: ParsedChapter[] = result.parts.map((part, index) => {
        return {
          index: index + 1,
          title: part.title || `Chương ${index + 1}`,
          content: part.content || part.text,
          word_count: part.wordCount,
          file_name: 'local_folder',
        };
      });

      // Sort by chapter title (natural sort) if mode is 'name'
      if (localSortMode === 'name') {
        parsedChapters.sort(naturalTitleSort);
        // Re-index after sorting
        parsedChapters = parsedChapters.map((ch, i) => ({ ...ch, index: i + 1 }));
      }
      
      setChapters(parsedChapters);
      setProcessingChapters(false);
      if (parsedChapters.length > 0) {
        setToIndex(parsedChapters.length);
      }
    }, 400);

    return () => clearTimeout(debounceTimerRef.current);
  }, [rawFolderText, maxWords, minWords, roundUp, enableSplit, splitFromChapter, localSortMode, naturalTitleSort]);

  // Start chapter upload
  const handleUpload = useCallback(async () => {
    if (!selectedBook || !folderPath) return;

    let chaptersToUpload: ParsedChapter[] = [];
    if (syncMode === 'all') {
      chaptersToUpload = chapters;
    } else if (syncMode === 'range') {
      chaptersToUpload = chapters.filter(c => c.index >= fromIndex && c.index <= toIndex);
    } else if (syncMode === 'append') {
      const startIndex = allRemoteChapters.length > 0
        ? allRemoteChapters[allRemoteChapters.length - 1].chapterNumber + 1
        : 1;
      chaptersToUpload = chapters.filter(c => c.index >= startIndex);
    }

    if (chaptersToUpload.length === 0) {
      alert('Không có chương nào để upload. Kiểm tra lại folder hoặc chế độ đồng bộ.');
      return;
    }

    const latestRemote = allRemoteChapters.length > 0
      ? allRemoteChapters[allRemoteChapters.length - 1].chapterNumber
      : 0;

    let finalChaptersToUpload = chaptersToUpload;
    if (vipNewChaptersOnly && chapterPrice > 0) {
      finalChaptersToUpload = chaptersToUpload.map(c => {
        if (c.index <= latestRemote) {
          return { ...c, price: 0 }; // Remove price for old chapters
        }
        return { ...c, price: chapterPrice };
      });
    }

    const options: UploadOptions = {
      book_id: selectedBook.id,
      chapters: finalChaptersToUpload,
      delay_ms: delayMs,
      price: chapterPrice,
      unlock_timer: unlockTimer || undefined,
    };

    addJob(options, selectedBook.title);

  }, [selectedBook, folderPath, syncMode, fromIndex, toIndex, delayMs, chapterPrice, unlockTimer, vipNewChaptersOnly, chapters, allRemoteChapters, addJob]);

  // Cancel the ongoing upload job for the current book
  const handleCancelUpload = useCallback(() => {
    if (currentJob) {
      cancelJob(currentJob.id);
    }
  }, [currentJob, cancelJob]);

  // Remove the job from the queue (closes the progress bar)
  const handleRemoveJob = useCallback(() => {
    if (currentJob) {
      removeJob(currentJob.id);
    }
  }, [currentJob, removeJob]);

  // Download a single chapter content
  const handleDownloadChapter = useCallback(async (ch: TtcChapter) => {
    if (!selectedBook) return;
    try {
      const result = await invoke<DownloadedChapter>('ttc_download_chapter', {
        bookId: selectedBook.id,
        chapterNumber: ch.chapterNumber,
      });

      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');

      const safeName = ch.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
      const savePath = await save({
        defaultPath: `${safeName}.txt`,
        filters: [{ name: 'Text', extensions: ['txt'] }],
        title: `Lưu chương: ${ch.title}`,
      });

      if (savePath) {
        const fileContent = `${result.title}\n\n${result.content}`;
        await writeTextFile(savePath, fileContent);
      }
    } catch (e) {
      console.error('Download chapter error:', e);
      alert(`Tải chương thất bại: ${String(e)}`);
    }
  }, [selectedBook]);

  // Reset state when book changes
  const resetState = useCallback(() => {
    setChapters([]);
    setRawFolderText('');
    setRemoteChapters([]);
    setAllRemoteChapters([]);
    setRemoteChapPage(1);
    autoLoadedRef.current = null;
  }, []);

  return {
    // Remote chapters
    remoteChapters,
    remoteChapPage,
    remoteChapTotalPages,
    remoteChapTotal,
    loadingRemoteChaps,
    chaptersLimit,
    setChaptersLimit,
    fetchRemoteChapters,
    allRemoteChapters,
    loadingAllRemote,
    fetchAllRemoteChapters,
    // Local chapters
    folderPath,
    chapters,
    loadingChapters: loadingChapters || processingChapters,
    handlePickFolder,
    handleReloadFolder,
    // Settings
    enableSplit,
    setEnableSplit,
    splitFromChapter,
    setSplitFromChapter,
    localSortMode,
    setLocalSortMode,
    maxWords,
    setMaxWords,
    minWords,
    setMinWords,
    roundUp,
    setRoundUp,
    // Upload
    syncMode,
    setSyncMode,
    fromIndex,
    setFromIndex,
    toIndex,
    setToIndex,
    delayMs,
    setDelayMs,
    chapterPrice,
    setChapterPrice,
    unlockTimer,
    setUnlockTimer,
    vipNewChaptersOnly,
    setVipNewChaptersOnly,
    progress,
    handleUpload,
    handleCancelUpload,
    handleRemoveJob,
    // Download
    handleDownloadChapter,
    // Reset
    resetState,
  };
}
