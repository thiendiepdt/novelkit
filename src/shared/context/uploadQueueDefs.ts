import type { UploadOptions, UploadProgressEvent } from '@/features/ttc-uploader/types';

export interface UploadJob {
  id: string;
  bookTitle: string;
  options: UploadOptions;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: UploadProgressEvent | null;
  error?: string;
  timestamp: number;
}
