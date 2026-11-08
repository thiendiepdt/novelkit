import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '@/features/settings/hooks/useSettings';
import type { BookStatus } from '../constants';
import type { TtcStory } from '../types';
import { fetchAllBooks } from '../utils/ttcLists';

/**
 * The whole book list for the status filter and the search (TTC's own search), in TTC's
 * order. Tabs, source filter and pages work on it locally (`useBookTabs`, the page).
 */
export function useTtcBooks(session?: string | null) {
  const [allBooks, setAllBooks] = useState<TtcStory[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookStatus[]>(['ongoing']);
  const [currentPage, setCurrentPage] = useState(1);

  const { settings, updateSettings } = useSettings();
  const booksLimit = settings.ttcUploader.booksLimit;
  const setBooksLimit = useCallback((v: number) => updateSettings('ttcUploader', { booksLimit: v }), [updateSettings]);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Only the latest request may fill the list (typing sends several). */
  const requestRef = useRef(0);

  const fetchBooks = useCallback(async (keyword: string, status: string) => {
    const request = ++requestRef.current;
    setLoadingBooks(true);
    setBooksError(null);
    try {
      const books = await fetchAllBooks(status, keyword);
      if (request === requestRef.current) setAllBooks(books);
    } catch (e) {
      if (request === requestRef.current) setBooksError(String(e));
    } finally {
      if (request === requestRef.current) setLoadingBooks(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchBooks(searchKeyword, statusFilter.join(','));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchKeyword triggers via the debounced handleSearchChange instead
  }, [session, statusFilter, fetchBooks]);

  useEffect(() => () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  // Debounced search (400ms)
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchKeyword(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        setCurrentPage(1);
        fetchBooks(value, statusFilter.join(','));
      }, 400);
    },
    [fetchBooks, statusFilter],
  );

  // Toggle status filter chip
  const handleStatusToggle = useCallback((status: BookStatus) => {
    setStatusFilter((prev) => {
      const isSelected = prev.includes(status);
      if (isSelected && prev.length === 1) return prev; // Prevent deselecting last
      return isSelected ? prev.filter((s) => s !== status) : [...prev, status];
    });
    setCurrentPage(1);
  }, []);

  /** Reload the list, keeping the page (callable from outside). */
  const refreshBooks = useCallback(() => {
    fetchBooks(searchKeyword, statusFilter.join(','));
  }, [fetchBooks, searchKeyword, statusFilter]);

  return {
    allBooks,
    loadingBooks,
    booksError,
    searchKeyword,
    statusFilter,
    currentPage,
    booksLimit,
    setCurrentPage,
    setBooksLimit,
    handleSearchChange,
    handleStatusToggle,
    refreshBooks,
  };
}
