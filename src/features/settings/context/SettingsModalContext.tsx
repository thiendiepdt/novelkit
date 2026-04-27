/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface SettingsModalContextValue {
  isOpen: boolean;
  bookId: number | undefined;
  bookTitle: string | undefined;
  openSettings: (bookId?: number, bookTitle?: string) => void;
  closeSettings: () => void;
}

const SettingsModalContext = createContext<SettingsModalContextValue | null>(null);

export function SettingsModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [bookId, setBookId] = useState<number | undefined>(undefined);
  const [bookTitle, setBookTitle] = useState<string | undefined>(undefined);

  const openSettings = useCallback((id?: number, title?: string) => {
    setBookId(id);
    setBookTitle(title);
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(() => ({
    isOpen,
    bookId,
    bookTitle,
    openSettings,
    closeSettings,
  }), [isOpen, bookId, bookTitle, openSettings, closeSettings]);

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
