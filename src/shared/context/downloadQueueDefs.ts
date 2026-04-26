import { createContext } from 'react';
import type { DownloadAllOptions, DownloadAllProgressEvent } from '@/shared/types/download';

// ─── Types ────────────────────────────────────────────────

export type DownloadJobStatus = 'pending' | 'downloading' | 'done' | 'error';

export interface DownloadJob {
  id: string;
  bookTitle: string;
  options: DownloadAllOptions;
  status: DownloadJobStatus;
  progress: DownloadAllProgressEvent | null;
  error?: string;
  timestamp: number;
}

export interface DownloadQueueContextType {
  jobs: DownloadJob[];
  addJob: (options: DownloadAllOptions) => void;
  removeJob: (id: string) => void;
  cancelJob: (id: string) => Promise<void>;
  clearDone: () => void;
  activeJob: DownloadJob | undefined;
}

// ─── Context ──────────────────────────────────────────────

export const DownloadQueueContext = createContext<DownloadQueueContextType | undefined>(undefined);
