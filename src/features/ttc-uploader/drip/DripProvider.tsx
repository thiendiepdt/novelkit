import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ChapterFile } from '@/features/chapter-splitter/utils/splitter';
import { useSettingsContext } from '@/features/settings/context/SettingsContext';
import { useUploadQueueContext } from '@/shared/context/UploadQueueContext';
import { storeGet, storeSet } from '@/shared/utils/persistentStore';
import { notifyUser } from '@/shared/utils/notify';
import { createChapterParser, type ChapterParser } from '../utils/chapterParser';
import { fetchAllChapters } from '../utils/ttcLists';
import { DripContext } from './dripContextDefs';
import { DRIP_STORE_KEY, DripEngine } from './dripEngine';

/**
 * Runs the "Nổi trên bảng cập nhật" scheduler for the whole app (desktop), whatever page is
 * open, for the plans of every account. Uploads go through the upload queue.
 */
export function DripProvider({ children }: { children: ReactNode }) {
  const { getSettingsForBook, bookSettings } = useSettingsContext();
  const queue = useUploadQueueContext();

  // The engine outlives renders: it reads the current settings and queue through a ref.
  const live = useRef({ getSettingsForBook, bookSettings, queue });
  useEffect(() => {
    live.current = { getSettingsForBook, bookSettings, queue };
  });

  const parserRef = useRef<ChapterParser | null>(null);
  const [engine] = useState(
    () =>
      new DripEngine({
        now: () => Date.now(),
        load: () => storeGet(DRIP_STORE_KEY),
        save: (json) => storeSet(DRIP_STORE_KEY, json),
        // Only a folder picked for this very book counts: another book's chapters must never go up here.
        folderOf: (bookId) => live.current.bookSettings[bookId]?.ttcUploader?.folderPath || '',
        settingsFor: (bookId) => live.current.getSettingsForBook(bookId),
        readFolder: (folderPath) => invoke<ChapterFile[]>('ttc_read_folder_files', { folderPath }),
        parseChapters: (files, opts) => {
          parserRef.current ??= createChapterParser();
          return parserRef.current.allChapters(files, opts);
        },
        fetchRemote: (bookId, account) => fetchAllChapters(bookId, account),
        queueBusy: () => live.current.queue.jobs.some((j) => j.status === 'pending' || j.status === 'uploading'),
        enqueue: (options, title) => live.current.queue.addJob(options, title, { silent: true }),
        waitForJob: (jobId) => live.current.queue.waitForJob(jobId),
        finishJob: (jobId) => live.current.queue.removeJob(jobId),
        cancelJob: (jobId) => live.current.queue.cancelJob(jobId),
        notify: (title, body) => void notifyUser(title, body),
        schedule: (fn, ms) => {
          const timer = setTimeout(fn, ms);
          return () => clearTimeout(timer);
        },
      }),
  );

  useEffect(() => {
    engine.start();
    return () => {
      engine.stop();
      parserRef.current?.dispose();
      parserRef.current = null;
    };
  }, [engine]);

  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return <DripContext.Provider value={{ engine, snapshot }}>{children}</DripContext.Provider>;
}
