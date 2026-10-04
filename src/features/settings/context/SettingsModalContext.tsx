/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { SettingsCategory } from '../components/SettingsSidebar';

interface SettingsModalContextValue {
  isOpen: boolean;
  bookId: number | undefined;
  bookTitle: string | undefined;
  /** Category to show when the panel opens (undefined = the panel's default). */
  category: SettingsCategory | undefined;
  openSettings: (bookId?: number, bookTitle?: string, category?: SettingsCategory) => void;
  closeSettings: () => void;
}

const SettingsModalContext = createContext<SettingsModalContextValue | null>(null);

export function SettingsModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [bookId, setBookId] = useState<number | undefined>(undefined);
  const [bookTitle, setBookTitle] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<SettingsCategory | undefined>(undefined);

  const openSettings = useCallback((id?: number, title?: string, cat?: SettingsCategory) => {
    setBookId(id);
    setBookTitle(title);
    setCategory(cat);
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(() => ({
    isOpen,
    bookId,
    bookTitle,
    category,
    openSettings,
    closeSettings,
  }), [isOpen, bookId, bookTitle, category, openSettings, closeSettings]);

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
    </SettingsModalContext.Provider>
  );
}

export function useSettingsModal() {
  const context = useContext(SettingsModalContext);
  if (!context) {
    throw new Error('useSettingsModal must be used within a SettingsModalProvider');
  }
  return context;
}
