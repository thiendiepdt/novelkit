import type { SyncMode, UploadProgress, ParsedChapter } from '../types';
import { SYNC_MODE_LABELS } from '../types';

interface UploadToolbarProps {
  folderPath: string | null;
  chapters: ParsedChapter[];
  loadingChapters: boolean;
  syncMode: SyncMode;
  fromIndex: number;
  toIndex: number;
  delayMs: number;
  progress: UploadProgress;
  enableSplit: boolean;
  maxWords: number;
  minWords: number;
  roundUp: boolean;
  onPickFolder: () => void;
  onSyncModeChange: (mode: SyncMode) => void;
  onFromIndexChange: (value: number) => void;
  onToIndexChange: (value: number) => void;
  onDelayChange: (value: number) => void;
  onEnableSplitChange: (value: boolean) => void;
  onMaxWordsChange: (value: number) => void;
  onMinWordsChange: (value: number) => void;
  onRoundUpChange: (value: boolean) => void;
  onUpload: () => void;
  onCancelUpload: () => void;
  onRemoveJob: () => void;
}

/**
 * Upload toolbar: folder picker, sync mode selector, delay input, upload button + progress bar.
 */
export function UploadToolbar({
  folderPath,
  chapters,
  loadingChapters,
  syncMode,
  fromIndex,
  toIndex,
  delayMs,
  progress,
  enableSplit,
  maxWords,
  minWords,
  roundUp,
  onPickFolder,
  onSyncModeChange,
  onFromIndexChange,
  onToIndexChange,
  onDelayChange,
  onEnableSplitChange,
  onMaxWordsChange,
  onMinWordsChange,
  onRoundUpChange,
  onUpload,
  onCancelUpload,
  onRemoveJob,
}: UploadToolbarProps) {
  return (
    <div
      className="bg-bg-card border border-border-main rounded-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-3"
      style={{ animation: 'slideUp 0.3s ease-out' }}
    >
      {/* Step 1: Folder Picker */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={onPickFolder}
            className="px-3 py-1.5 bg-bg-hover border border-border-main rounded-lg text-xs font-medium text-text-primary hover:border-gold/50 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Chọn folder chứa file chương (.txt)"
          >
            <span>📁</span> Chọn Folder
          </button>
          {folderPath && (
            <span className="text-[11px] text-text-dim font-mono max-w-[150px] truncate" title={folderPath}>
              {folderPath.split(/[/\\]/).pop()}
            </span>
          )}
        </div>
        {loadingChapters ? (
          <span className="text-[10px] text-text-dim">Đang đọc file...</span>
        ) : chapters.length > 0 ? (
          <span className="text-[10px] text-gold font-medium">Tìm thấy {chapters.length} file txt</span>
        ) : null}
      </div>

      {/* Vertical divider */}
      {chapters.length > 0 && <div className="h-8 w-px bg-border-main hidden sm:block"></div>}

      {/* Split Settings */}
      {chapters.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enableSplit}
              onChange={(e) => onEnableSplitChange(e.target.checked)}
              className="rounded border-border-main text-gold focus:ring-gold bg-bg-hover"
            />
            <span className="text-[11px] font-medium text-gold" title="Tự động chia nhỏ chương dài hoặc gộp chương ngắn">Tự động chia</span>
          </label>
          
          {enableSplit && (
            <>
              <div className="h-4 w-px bg-border-main"></div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-text-dim" title="Cắt file nếu dài hơn số chữ này">Max chữ:</label>
                <input
                  type="number"
                  value={maxWords}
                  onChange={(e) => onMaxWordsChange(Number(e.target.value))}
                  className="w-16 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-text-dim" title="Gộp vào chương trước nếu ngắn hơn số chữ này">Min chữ:</label>
                <input
                  type="number"
                  value={minWords}
                  onChange={(e) => onMinWordsChange(Number(e.target.value))}
                  className="w-14 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
                />
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roundUp}
                  onChange={(e) => onRoundUpChange(e.target.checked)}
                  className="rounded border-border-main text-gold focus:ring-gold bg-bg-hover"
                />
                <span className="text-[11px] text-text-dim" title="Cố gắng không cắt giữa chừng đoạn văn">Round Up</span>
              </label>
            </>
          )}
        </div>
      )}

      {/* Vertical divider */}
      {chapters.length > 0 && <div className="h-8 w-px bg-border-main hidden md:block"></div>}

      {/* Step 2 & 3: Sync Settings & Upload Button */}
      {chapters.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-text-dim font-medium uppercase tracking-wider">Chế độ:</label>
            <div className="flex gap-1">
              {(Object.keys(SYNC_MODE_LABELS) as SyncMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onSyncModeChange(mode)}
                  className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                    syncMode === mode
                      ? 'bg-gold/20 border-gold text-gold font-medium'
                      : 'bg-bg-hover border-border-main text-text-secondary hover:border-border-hover'
                  }`}
                >
                  {SYNC_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>

          {syncMode === 'range' && (
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-text-dim">Từ:</label>
              <input
                type="number"
                value={fromIndex}
                onChange={(e) => onFromIndexChange(Number(e.target.value))}
                min={1}
                max={chapters.length}
                className="w-14 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
              />
              <label className="text-[11px] text-text-dim ml-1">Đến:</label>
              <input
                type="number"
                value={toIndex}
                onChange={(e) => onToIndexChange(Number(e.target.value))}
                min={1}
                max={chapters.length}
                className="w-14 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
              />
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-text-dim whitespace-nowrap" title="Delay giữa mỗi request">Delay (ms):</label>
            <input
              type="number"
              value={delayMs}
              onChange={(e) => onDelayChange(Number(e.target.value))}
              min={100}
              step={100}
              className="w-16 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
            />
          </div>

          <div className="ml-auto flex items-center min-w-[140px]">
            {progress.status === 'idle' ? (
              <button
                onClick={onUpload}
                className="w-full px-4 py-1.5 bg-gold text-bg-primary font-bold text-xs rounded-lg hover:bg-gold/90 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🚀</span> Upload
              </button>
            ) : (
              <div className="w-full flex flex-col justify-center">
                <div className="flex justify-between items-center text-[10px] text-text-dim mb-1 font-medium gap-2">
                  <span className="truncate flex-1" title={progress.current_title}>
                    {progress.status === 'done' || progress.status === 'error'
                      ? (progress.status === 'error' ? (progress.message || 'Lỗi/Đã hủy') : (progress.failed > 0 ? 'Xong (Có lỗi)' : 'Hoàn tất')) 
                      : (progress.current_title || 'Đang tải...')}
                  </span>
                  <span className="shrink-0">{progress.current}/{progress.total}</span>
                </div>
                <div className="w-full h-1.5 bg-bg-hover rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${(progress.failed > 0 && progress.status === 'done') || progress.status === 'error' ? 'bg-crimson' : 'bg-gold'}`}
                    style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                  />
                </div>
                {(progress.success > 0 || progress.failed > 0) && (
                  <div className="flex gap-2 text-[10px] mt-1 justify-end">
                    {progress.success > 0 && <span className="text-jade">✓ {progress.success}</span>}
                    {progress.failed > 0 && <span className="text-crimson">✗ {progress.failed}</span>}
                  </div>
                )}
                {(progress.status === 'done' || progress.status === 'error') ? (
                  <button
                    onClick={onRemoveJob}
                    className="mt-1.5 w-full py-1 text-[10px] font-medium bg-bg-hover text-text-secondary hover:text-text-primary rounded"
                  >
                    Đóng
                  </button>
                ) : (
                  <button
                    onClick={onCancelUpload}
                    className="mt-1.5 w-full py-1 text-[10px] font-medium bg-crimson/10 text-crimson hover:bg-crimson/20 rounded"
                  >
                    Hủy tiến trình
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
