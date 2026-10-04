/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useLocalStorage } from '@/shared/hooks/useLocalStorage';
import type { AppSettings, BookSettingsSection, PerBookSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

interface SettingsContextValue {
  globalSettings: AppSettings;
  updateGlobalSettings: <K extends keyof AppSettings>(section: K, overrides: Partial<AppSettings[K]>) => void;
  resetGlobalSettings: () => void;

  bookSettings: Record<number, PerBookSettings>;
  updateBookSettings: <K extends BookSettingsSection>(bookId: number, section: K, overrides: Partial<AppSettings[K]>) => void;
  clearBookSettings: (bookId: number) => void;

  getSettingsForBook: (bookId?: number) => AppSettings;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [globalSettings, setGlobalSettings] = useLocalStorage<AppSettings>('nk_global_settings', DEFAULT_SETTINGS);
  const [bookSettings, setBookSettings] = useLocalStorage<Record<number, PerBookSettings>>('nk_book_settings', {});

  const updateGlobalSettings = useCallback(<K extends keyof AppSettings>(section: K, overrides: Partial<AppSettings[K]>) => {
    setGlobalSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...overrides,
      }
    }));
  }, [setGlobalSettings]);

  const updateBookSettings = useCallback(<K extends BookSettingsSection>(bookId: number, section: K, overrides: Partial<AppSettings[K]>) => {
    setBookSettings(prev => {
      const currentBookSettings = prev[bookId] || {};
      const currentSection = currentBookSettings[section] || {};
      
      return {
        ...prev,
        [bookId]: {
          ...currentBookSettings,
          [section]: {
            ...currentSection,
            ...overrides,
          }
        }
      };
    });
  }, [setBookSettings]);

  const resetGlobalSettings = useCallback(() => {
    setGlobalSettings(DEFAULT_SETTINGS);
  }, [setGlobalSettings]);

  const clearBookSettings = useCallback((bookId: number) => {
    setBookSettings(prev => {
      const next = { ...prev };
      delete next[bookId];
      return next;
    });
  }, [setBookSettings]);

  const value = useMemo(() => {
    const mergedGlobalSettings: AppSettings = {
      splitter: { ...DEFAULT_SETTINGS.splitter, ...(globalSettings?.splitter || {}) },
      ttcUploader: { ...DEFAULT_SETTINGS.ttcUploader, ...(globalSettings?.ttcUploader || {}) },
      // Settings saved before the AI section existed have no `ai` key: merge each level with defaults.
      ai: {
        provider: globalSettings?.ai?.provider ?? DEFAULT_SETTINGS.ai.provider,
        gemini: { ...DEFAULT_SETTINGS.ai.gemini, ...(globalSettings?.ai?.gemini || {}) },
        openai: { ...DEFAULT_SETTINGS.ai.openai, ...(globalSettings?.ai?.openai || {}) },
      },
    };

    const getSettingsForBookMerged = (bookId?: number): AppSettings => {
      if (!bookId || !bookSettings[bookId]) {
        return mergedGlobalSettings;
      }
      const specific = bookSettings[bookId];
      return {
        splitter: {
          ...mergedGlobalSettings.splitter,
          ...(specific.splitter || {}),
        },
        ttcUploader: {
          ...mergedGlobalSettings.ttcUploader,
          ...(specific.ttcUploader || {}),
        },
        ai: mergedGlobalSettings.ai,
      };
    };

    return {
      globalSettings: mergedGlobalSettings,
      updateGlobalSettings,
      resetGlobalSettings,
      bookSettings,
      updateBookSettings,
      clearBookSettings,
      getSettingsForBook: getSettingsForBookMerged,
    };
  }, [globalSettings, updateGlobalSettings, resetGlobalSettings, bookSettings, updateBookSettings, clearBookSettings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
}

