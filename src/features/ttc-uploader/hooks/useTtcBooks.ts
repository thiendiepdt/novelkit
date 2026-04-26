import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { DEFAULT_BOOKS_LIMIT } from '../constants';
import type { BookStatus } from '../constants';
import type { TtcStory, TtcBooksResponse } from '../types';

/**
 * Manages book list state: fetching, search, status filtering, and pagination.
 */
export function useTtcBooks(session?: string | null) {
  const [books, setBooks] = useState<TtcStory[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);

  // Search, filter & pagination
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookStatus[]>(['ongoing']);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStories, setTotalStories] = useState(0);
  
  const { settings, updateSettings } = useSettings();
  const booksLimit = settings.ttcUploader.booksLimit;
  const setBooksLimit = useCallback((v: number) => updateSettings('ttcUploader', { booksLimit: v }), [updateSettings]);
  
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch books
  const fetchBooks = useCallback(async (page = 1, keyword = '', status = 'ongoing' as string, limit = DEFAULT_BOOKS_LIMIT) => {
    setLoadingBooks(true);
    setBooksError(null);
    try {
      const resp = await invoke<TtcBooksResponse>('ttc_fetch_books', {
        page,
        limit,
        keyword: keyword || null,
        status,
      });
      setBooks(resp.stories);
      setTotalPages(resp.totalPages);
      setTotalStories(resp.totalStories);
    } catch (e) {
      setBooksError(String(e));
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  // Auto-fetch when session/filter/page changes
  useEffect(() => {
    if (session) fetchBooks(currentPage, searchKeyword, statusFilter.join(','), booksLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchBooks is stable (useCallback with []), searchKeyword triggers via debounced handleSearchChange instead
  }, [session, currentPage, statusFilter, booksLimit]);

  // Debounced search (400ms)
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchKeyword(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        setCurrentPage(1);
        fetchBooks(1, value, statusFilter.join(','), booksLimit);
      }, 400);
    },
    [fetchBooks, statusFilter, booksLimit],
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

  // Refresh books (callable from outside)
  const refreshBooks = useCallback(() => {
    fetchBooks(currentPage, searchKeyword, statusFilter.join(','), booksLimit);
  }, [fetchBooks, currentPage, searchKeyword, statusFilter, booksLimit]);

  return {
    books,
    loadingBooks,
    booksError,
    searchKeyword,
    statusFilter,
    currentPage,
    totalPages,
    totalStories,
    booksLimit,
    setCurrentPage,
    setBooksLimit,
    handleSearchChange,
    handleStatusToggle,
    fetchBooks,
    refreshBooks,
  };
}
