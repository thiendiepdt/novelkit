// ─── Download All Types (shared with DownloadQueueContext) ──

export interface DownloadAllOptions {
  book_id: number;
  book_title: string;
  save_dir: string;
  mode: 'single' | 'chunked' | 'split';
  chunk_size?: number;
  delay_ms?: number;
  threads?: number;
}

export interface DownloadAllProgressEvent {
  current: number;
  total: number;
  current_title: string;
  success: number;
  failed: number;
  status: 'idle' | 'fetching_list' | 'downloading' | 'done' | 'error';
  message?: string;
}
