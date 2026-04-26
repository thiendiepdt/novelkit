import { useMemo } from 'react';
import { useSettingsContext } from '../context/SettingsContext';
import type { AppSettings } from '../types';

/**
 * Hook for consuming settings.
 * If `bookId` is provided, it returns the merged settings for that book (Global overridden by Per-Book).
 * If no `bookId` is provided, it returns the Global settings.
 */
export function useSettings(bookId?: number) {
  const { getSettingsForBook, updateGlobalSettings, updateBookSettings, resetGlobalSettings } = useSettingsContext();

  const settings = useMemo(() => getSettingsForBook(bookId), [getSettingsForBook, bookId]);

  const updateSettings = <K extends keyof AppSettings>(section: K, overrides: Partial<AppSettings[K]>) => {
    if (bookId) {
      updateBookSettings(bookId, section, overrides);
    } else {
      updateGlobalSettings(section, overrides);
    }
  };

  return {
    settings,
    updateSettings,
    resetGlobalSettings,
  };
}
