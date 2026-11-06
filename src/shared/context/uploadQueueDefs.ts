import type { UploadOptions, UploadProgressEvent } from '@/features/ttc-uploader/types';

export interface UploadJob {
  id: string;
  bookTitle: string;
  options: UploadOptions;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: UploadProgressEvent | null;
  error?: string;
  timestamp: number;
  /** No desktop notification when it ends (see `addJob`). */
  silent?: boolean;
}

/** How a job ended, as `waitForJob` reports it. */
export type UploadJobOutcome = { status: 'done' } | { status: 'error'; error: string };
