import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsContext } from '@/features/settings/context/SettingsContext';
import type { ChapterFile } from '@/features/chapter-splitter/utils/splitter';
import type { TtcStory } from '../types';
import { createChapterParser, type ChapterParser } from '../utils/chapterParser';
import { folderVerdict, type FolderSyncStatus } from '../utils/folderSync';
import { parseOptionsFromSettings } from '../utils/localChapters';

const errorMessage = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));

/**
 * Folder against TTC for every story with a folder (see `folderVerdict`), read only while
 * `active` (the "Chưa đồng bộ" tab is open): one folder at a time in the parser worker.
 * A result is kept until the folder, the parse settings or the story on TTC change.
 */
export function useFolderSyncStatus(books: TtcStory[], active: boolean) {
  const { bookSettings, getSettingsForBook } = useSettingsContext();
  const [results, setResults] = useState<Record<number, { key: string; status: FolderSyncStatus }>>({});
  // Read by the reading loop, which must not restart each time a result comes in.
  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const folderOf = useCallback((bookId: number) => bookSettings[bookId]?.ttcUploader?.folderPath || '', [bookSettings]);

  /** What a result depends on: when this changes, the folder is read again. */
  const keys = useMemo(() => {
    const out = new Map<number, string>();
    for (const b of books) {
      const folder = folderOf(b.id);
      if (!folder) continue;
      const opts = parseOptionsFromSettings(getSettingsForBook(b.id));
      out.set(b.id, JSON.stringify([folder, b.total_chapters, b.latest_chapter_title, opts]));
    }
    return out;
  }, [books, folderOf, getSettingsForBook]);

  const parserRef = useRef<ChapterParser | null>(null);
  useEffect(
    () => () => {
      parserRef.current?.dispose();
      parserRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!active) return;
    const todo = books.filter((b) => keys.has(b.id) && resultsRef.current[b.id]?.key !== keys.get(b.id));
    if (todo.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const book of todo) {
        if (cancelled) return;
        const key = keys.get(book.id)!;
        let status: FolderSyncStatus;
        try {
          const files = await invoke<ChapterFile[]>('ttc_read_folder_files', { folderPath: folderOf(book.id) });
          if (files.length === 0) {
            status = { kind: 'error', reason: 'Folder không có file .txt' };
          } else {
            parserRef.current ??= createChapterParser();
            const local = await parserRef.current.allChapters(files, parseOptionsFromSettings(getSettingsForBook(book.id)));
            status = folderVerdict(local, book);
          }
        } catch (e) {
          status = { kind: 'error', reason: `Không đọc được folder: ${errorMessage(e)}` };
        }
        if (cancelled) return;
        setResults((prev) => ({ ...prev, [book.id]: { key, status } }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, books, keys, folderOf, getSettingsForBook]);

  /** The current result of a story, or undefined while it is not read (again) yet. */
  const statusOf = useCallback(
    (bookId: number) => {
      const r = results[bookId];
      return r && r.key === keys.get(bookId) ? r.status : undefined;
    },
    [results, keys],
  );

  const total = keys.size;
  const done = [...keys].filter(([id, key]) => results[id]?.key === key).length;
  return { statusOf, total, done, checking: active && done < total };
}
