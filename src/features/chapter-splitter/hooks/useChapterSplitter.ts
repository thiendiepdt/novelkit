import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSettings } from '@/features/settings/hooks/useSettings';
import {
  splitChapter,
  splitMultipleChapters,
  countChapterBoundaries,
  getWordCount,
  type SplitResult,
} from '../utils/splitter';
import type { MiniMapMarker } from '@/shared/components/MiniMapTextarea';
import { DEFAULTS } from '../constants';

export function useChapterSplitter() {
  // --- Input state ---
  const [input, setInput] = useState('');
  const [result, setResult] = useState<SplitResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showInputFullscreen, setShowInputFullscreen] = useState(false);
  const [previewPartIndex, setPreviewPartIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Settings ---
  const { settings, updateSettings } = useSettings();
  const { maxWords, minWords, roundUp } = settings.splitter;

  const setMaxWords = useCallback((v: number) => updateSettings('splitter', { maxWords: v }), [updateSettings]);
  const setMinWords = useCallback((v: number) => updateSettings('splitter', { minWords: v }), [updateSettings]);
  const setRoundUp = useCallback((v: boolean) => updateSettings('splitter', { roundUp: v }), [updateSettings]);

  // --- Debounced chapter boundary detection ---
  const [chapterBoundaryCount, setChapterBoundaryCount] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setChapterBoundaryCount(countChapterBoundaries(input));
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);
  const isMultiChapter = chapterBoundaryCount >= 2;

  // --- Merged text for "Một File" tab ---
  const mergedText = useMemo(() => {
    if (!result) return '';
    return result.parts.map(p => p.text).join('\n\n');
  }, [result]);

  // --- Markers for part boundaries in merged text ---
  const mergedMarkers = useMemo<MiniMapMarker[]>(() => {
    if (!result || result.parts.length <= 1) return [];
    const markers: MiniMapMarker[] = [];
    let offset = 0;
    result.parts.forEach((part, i) => {
      if (i > 0) offset += 2; // '\n\n' separator
      markers.push({ charOffset: offset, label: isMultiChapter ? `C${i + 1}` : `P${i + 1}` });
      offset += part.text.length;
    });
    return markers;
  }, [result, isMultiChapter]);

  // --- Pagination for large outputs ---
  const [listPage, setListPage] = useState(0);
  const isLargeOutput = (result?.totalWords ?? 0) >= DEFAULTS.LARGE_OUTPUT_WORD_THRESHOLD;
  const totalPages = result ? Math.ceil(result.parts.length / DEFAULTS.ITEMS_PER_PAGE) : 0;
  const paginatedParts = useMemo(() => {
    if (!result) return [];
    const start = listPage * DEFAULTS.ITEMS_PER_PAGE;
    return result.parts.slice(start, start + DEFAULTS.ITEMS_PER_PAGE).map((part, i) => ({
      part,
      globalIndex: start + i,
    }));
  }, [result, listPage]);

  // --- Validation ---
  const isValidInput = input.trim() === '' || /^chương/i.test(input.trim());

  // --- Large input detection ---
  const inputStats = useMemo(() => {
    if (input.length < DEFAULTS.LARGE_INPUT_CHAR_THRESHOLD) return null;
    const lines = input.split('\n').filter(l => l.trim()).length;
    const words = getWordCount(input);
    return { lines, words, chars: input.length };
  }, [input]);
  const isLargeInput = (inputStats?.words ?? 0) >= DEFAULTS.LARGE_OUTPUT_WORD_THRESHOLD;

  // --- Actions ---
  const handleSplit = useCallback(() => {
    if (!input.trim()) return;
    const splitData = isMultiChapter
      ? splitMultipleChapters(input, maxWords, roundUp, minWords)
      : splitChapter(input, maxWords, roundUp, minWords);
    setResult(splitData);
    setCopiedIndex(null);
    setActiveTab(-1);
    setListPage(0);
  }, [input, maxWords, roundUp, minWords, isMultiChapter]);

  const handleClear = useCallback(() => {
    setInput('');
    setResult(null);
    setCopiedIndex(null);
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch {
      // Fallback manual paste
    }
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.endsWith('.txt')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setInput(text);
        setResult(null);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      e.target.value = '';
    },
    [handleFileUpload],
  );

  const showTabs = !isMultiChapter || !result?.chapterCount;

  return {
    // State
    input,
    setInput,
    result,
    copiedIndex,
    setCopiedIndex,
    activeTab,
    setActiveTab,
    showFullscreen,
    setShowFullscreen,
    showInputFullscreen,
    setShowInputFullscreen,
    previewPartIndex,
    setPreviewPartIndex,
    fileInputRef,

    // Settings
    maxWords,
    setMaxWords,
    roundUp,
    setRoundUp,
    minWords,
    setMinWords,

    // Computed
    isMultiChapter,
    chapterBoundaryCount,
    mergedText,
    mergedMarkers,
    isLargeOutput,
    isLargeInput,
    inputStats,
    isValidInput,
    showTabs,

    // Pagination
    listPage,
    setListPage,
    totalPages,
    paginatedParts,

    // Actions
    handleSplit,
    handleClear,
    handlePaste,
    handleFileUpload,
    handleFileInputChange,
  };
}
