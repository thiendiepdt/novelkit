import { useCallback, useMemo, useState } from 'react';
import { useSettingsContext } from '@/features/settings/context/SettingsContext';
import type { TtcStory } from '../types';
import { BOOK_TABS, filterBySources, inTab, sourceCounts, type BookTab, type TabContext } from '../utils/bookFilters';
import { useFolderSyncStatus } from './useFolderSyncStatus';

/**
 * Tabs and source filter over the full book list (`useTtcBooks`), both local. The counts of
 * a tab follow the source filter, and the counts of a source follow the open tab (not the
 * source filter, so picking a source never hides the others). "Chưa đồng bộ" reads the
 * folders while it is open, and counts only what is read.
 */
export function useBookTabs(allBooks: TtcStory[]) {
  const { bookSettings } = useSettingsContext();
  const [tab, setTab] = useState<BookTab>('all');
  const [sources, setSources] = useState<string[]>([]);
  const folderSync = useFolderSyncStatus(allBooks, tab === 'unsynced');

  const ctx: TabContext = useMemo(
    () => ({
      hasFolder: (id) => !!bookSettings[id]?.ttcUploader?.folderPath,
      folderStatus: folderSync.statusOf,
    }),
    [bookSettings, folderSync.statusOf],
  );

  const bySource = useMemo(() => filterBySources(allBooks, sources), [allBooks, sources]);
  const counts = useMemo(
    () => Object.fromEntries(BOOK_TABS.map((t) => [t.value, bySource.filter((b) => inTab(b, t.value, ctx)).length])) as Record<BookTab, number>,
    [bySource, ctx],
  );
  const visible = useMemo(() => bySource.filter((b) => inTab(b, tab, ctx)), [bySource, tab, ctx]);
  // Every source of the list, in a fixed order (they do not jump around between tabs).
  const sourceOptions = useMemo(() => {
    const inThisTab = sourceCounts(allBooks.filter((b) => inTab(b, tab, ctx)));
    return sourceCounts(allBooks).map(({ name }) => ({ name, count: inThisTab.find((s) => s.name === name)?.count ?? 0 }));
  }, [allBooks, tab, ctx]);

  const toggleSource = useCallback(
    (name: string) => setSources((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name])),
    [],
  );
  const clearSources = useCallback(() => setSources([]), []);

  return { tab, setTab, sources, toggleSource, clearSources, sourceOptions, counts, visible, folderSync };
}
