import type { SyncMode, UploadProgress, ParsedChapter } from '../types';
import { SYNC_MODE_LABELS } from '../types';
import type { LocalSortMode, UnlockTimer } from '@/features/settings/types';
import Select from '@/shared/components/Select';
import { Tooltip } from '@/shared/components';
import { useState, useEffect } from 'react';
import { Folder, RefreshCw, Upload, Coins, Unlock, Check, X } from 'lucide-react';

const SYNC_MODE_TOOLTIPS: Record<SyncMode, string> = {
  all: 'Đăng lại toàn bộ chương, ghi đè nội dung đã có trên web',
  append: 'Chỉ đăng các chương trong máy chưa có trên web',
  range: 'Chỉ đăng các chương trong khoảng số thứ tự đã chọn',
};

/**
 * A number input that buffers keystrokes and only calls onChange 500ms after typing stops,
 * or on blur/enter. This prevents heavy global state/localStorage updates on every keystroke.
 */
function BufferedNumberInput({
  value,
  onChange,
  className,
  min,
  max,
  step,
  title,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  title?: string;
}) {
  const [localValue, setLocalValue] = useState<string>(value.toString());

  // Sync when external value changes
  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  // Debounce typing
  useEffect(() => {
    const timer = setTimeout(() => {
      const num = Number(localValue);
      if (!isNaN(num) && num !== value) {
        onChange(num);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  const handleBlur = () => {
    const num = Number(localValue);
    if (!isNaN(num) && num !== value) {
      onChange(num);
    } else if (isNaN(num)) {
      setLocalValue(value.toString()); // Revert if invalid
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      min={min}
      max={max}
      step={step}
      title={title}
    />
  );
}

interface UploadToolbarProps {
  folderPath: string;
  chapters: ParsedChapter[];
  loadingChapters: boolean;
  syncMode: SyncMode;
  fromIndex: number;
  toIndex: number;
  delayMs: number;
  progress: UploadProgress;
  enableSplit: boolean;
  splitFromChapter: number;
  maxWords: number;
  minWords: number;
  roundUp: boolean;
  localSortMode: LocalSortMode;
  chapterPrice: number;
  unlockTimer: UnlockTimer;
  vipNewChaptersOnly: boolean;
  skipChapters: number;
  onPickFolder: () => void;
  onReloadFolder: () => void;
  onSyncModeChange: (mode: SyncMode) => void;
  onFromIndexChange: (value: number) => void;
  onToIndexChange: (value: number) => void;
  onDelayChange: (value: number) => void;
  onEnableSplitChange: (value: boolean) => void;
  onSplitFromChapterChange: (value: number) => void;
  onMaxWordsChange: (value: number) => void;
  onMinWordsChange: (value: number) => void;
  onRoundUpChange: (value: boolean) => void;
  onLocalSortModeChange: (value: LocalSortMode) => void;
  onChapterPriceChange: (value: number) => void;
  onUnlockTimerChange: (value: UnlockTimer) => void;
  onVipNewChaptersOnlyChange: (value: boolean) => void;
  onSkipChaptersChange: (value: number) => void;
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
  splitFromChapter,
  maxWords,
  minWords,
  roundUp,
  localSortMode,
  chapterPrice,
  unlockTimer,
  vipNewChaptersOnly,
  skipChapters,
  onPickFolder,
  onReloadFolder,
  onSyncModeChange,
  onFromIndexChange,
  onToIndexChange,
  onDelayChange,
  onEnableSplitChange,
  onSplitFromChapterChange,
  onMaxWordsChange,
  onMinWordsChange,
  onRoundUpChange,
  onLocalSortModeChange,
  onChapterPriceChange,
  onUnlockTimerChange,
  onVipNewChaptersOnlyChange,
  onSkipChaptersChange,
  onUpload,
  onCancelUpload,
  onRemoveJob,
}: UploadToolbarProps) {
  return (
    <div
      className="bg-bg-card border border-border-main rounded-xl p-3 flex flex-col gap-2.5"
      style={{ animation: 'slideUp 0.3s ease-out' }}
    >
      {/* Row 1: Source — Folder, Sort, Split */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Folder Picker */}
        <div className="flex items-center gap-2">
          <Tooltip content="Chọn folder chứa file chương (.txt) trên máy để upload" side="bottom">
            <button
              onClick={onPickFolder}
              className="px-3 py-1.5 bg-bg-hover border border-border-main rounded-lg text-xs font-medium text-text-primary hover:border-gold/50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Folder size={14} /> Chọn Folder
            </button>
          </Tooltip>
          {folderPath && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-text-dim font-mono max-w-[150px] truncate" title={folderPath}>
                {folderPath.split(/[/\\]/).pop()}
              </span>
              <Tooltip content="Đọc lại các file chương từ folder đã chọn" side="bottom">
                <button
                  onClick={onReloadFolder}
                  className="p-1 hover:bg-bg-hover text-text-dim hover:text-gold rounded transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} />
                </button>
              </Tooltip>
            </div>
          )}
          {loadingChapters ? (
            <span className="text-[10px] text-text-dim">Đang đọc file...</span>
          ) : chapters.length > 0 ? (
            <span className="text-[10px] text-gold font-medium">({chapters.length} chương)</span>
          ) : null}
        </div>

        {chapters.length > 0 && (
          <>
            <div className="h-5 w-px bg-border-main"></div>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-text-dim">Sắp xếp:</label>
              <Tooltip content="Thứ tự sắp xếp chương: theo số trong tên hoặc theo tên file" side="bottom">
                <Select
                  value={localSortMode}
                  onChange={(e) => onLocalSortModeChange(e.target.value as LocalSortMode)}
                  className="text-xs !py-1 !pl-2 !pr-7"
                >
                  <option value="name">📝 Tên chương</option>
                  <option value="file">📁 Thứ tự file</option>
                </Select>
              </Tooltip>
            </div>

            <div className="h-5 w-px bg-border-main"></div>

            {/* Skip Chapters (Bỏ qua N chương) */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-text-dim">Bỏ qua:</label>
              <Tooltip content="Bỏ qua N chương đầu trên web; chương trong máy đầu khớp chương N+1" side="bottom">
                <BufferedNumberInput
                  value={skipChapters}
                  onChange={onSkipChaptersChange}
                  min={0}
                  className="w-16 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
                />
              </Tooltip>
              <span className="text-[10px] text-text-dim">chương</span>
            </div>

            <div className="h-5 w-px bg-border-main"></div>

            {/* Split Toggle + Settings */}
            <div className="flex items-center gap-3">
              <Tooltip content="Tự động chia nhỏ chương dài hoặc gộp chương ngắn theo số chữ" side="bottom">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSplit}
                    onChange={(e) => onEnableSplitChange(e.target.checked)}
                    className="rounded border-border-main text-gold focus:ring-gold bg-bg-hover"
                  />
                  <span className="text-[11px] font-medium text-gold">Tự động chia</span>
                </label>
              </Tooltip>
              
              {enableSplit && (
                <>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-text-dim">Max:</label>
                    <Tooltip content="Số chữ tối đa mỗi chương; chương dài hơn sẽ bị chia nhỏ" side="bottom">
                      <BufferedNumberInput
                        value={maxWords}
                        onChange={onMaxWordsChange}
                        className="w-[72px] px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
                      />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-text-dim">Min:</label>
                    <Tooltip content="Số chữ tối thiểu mỗi chương; chương ngắn hơn sẽ được gộp lại" side="bottom">
                      <BufferedNumberInput
                        value={minWords}
                        onChange={onMinWordsChange}
                        className="w-[72px] px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
                      />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-text-dim">Từ chương:</label>
                    <Tooltip content="Chỉ chia từ chương số này trở đi (1 = chia tất cả)" side="bottom">
                      <BufferedNumberInput
                        value={splitFromChapter}
                        onChange={onSplitFromChapterChange}
                        min={1}
                        className="w-[72px] px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
                      />
                    </Tooltip>
                  </div>
                  <Tooltip content="Làm tròn lên số phần khi chia chương để các phần đều chữ hơn" side="bottom">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roundUp}
                        onChange={(e) => onRoundUpChange(e.target.checked)}
                        className="rounded border-border-main text-gold focus:ring-gold bg-bg-hover"
                      />
                      <span className="text-[11px] text-text-dim">Round Up</span>
                    </label>
                  </Tooltip>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Row 2: Upload — Sync mode, Delay, VIP, Upload button */}
      {chapters.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-border-main/50">
          {/* Sync Mode */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-text-dim">Chế độ:</label>
            <div className="flex gap-0.5">
              {(Object.keys(SYNC_MODE_LABELS) as SyncMode[]).map((mode) => (
                <Tooltip key={mode} content={SYNC_MODE_TOOLTIPS[mode]} side="bottom">
                  <button
                    onClick={() => onSyncModeChange(mode)}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                      syncMode === mode
                        ? 'bg-gold/20 border-gold text-gold font-medium'
                        : 'bg-bg-hover border-border-main text-text-secondary hover:border-border-hover'
                    }`}
                  >
                    {SYNC_MODE_LABELS[mode]}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Range inputs (conditional) */}
          {syncMode === 'range' && (
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-text-dim">Từ:</label>
              <Tooltip content="Chương bắt đầu của khoảng cần upload" side="bottom">
                <BufferedNumberInput
                  value={fromIndex}
                  onChange={onFromIndexChange}
                  min={1}
                  max={chapters.length}
                  className="w-16 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
                />
              </Tooltip>
              <label className="text-[11px] text-text-dim">Đến:</label>
              <Tooltip content="Chương kết thúc của khoảng cần upload" side="bottom">
                <BufferedNumberInput
                  value={toIndex}
                  onChange={onToIndexChange}
                  min={1}
                  max={chapters.length}
                  className="w-16 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
                />
              </Tooltip>
            </div>
          )}

          <div className="h-5 w-px bg-border-main"></div>

          {/* Delay */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-text-dim whitespace-nowrap">Delay:</label>
            <Tooltip content="Thời gian chờ giữa mỗi lần đăng chương (ms) để tránh bị chặn" side="bottom">
              <BufferedNumberInput
                value={delayMs}
                onChange={onDelayChange}
                min={100}
                step={100}
                className="w-20 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
              />
            </Tooltip>
            <span className="text-[10px] text-text-dim">ms</span>
          </div>

          {/* VIP */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-text-dim whitespace-nowrap"><Coins size={12} className="inline mr-1 text-gold" /> VIP:</label>
            <Tooltip content="Giá mở khóa chương tính bằng hoa (0 = miễn phí)" side="bottom">
              <BufferedNumberInput
                value={chapterPrice}
                onChange={onChapterPriceChange}
                min={0}
                step={1}
                className="w-20 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
              />
            </Tooltip>
          </div>

          {chapterPrice > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-text-dim whitespace-nowrap"><Unlock size={12} className="inline" /></label>
                <Tooltip content="Thời gian sau đó chương VIP tự động mở khóa miễn phí" side="bottom">
                  <Select
                    value={unlockTimer}
                    onChange={(e) => onUnlockTimerChange(e.target.value as UnlockTimer)}
                    className="text-xs !py-1 !pl-2 !pr-7"
                  >
                    <option value="">Không mở khóa</option>
                    <option value="8h">8 giờ</option>
                    <option value="1d">1 ngày</option>
                    <option value="3d">3 ngày</option>
                    <option value="7d">7 ngày</option>
                  </Select>
                </Tooltip>
              </div>
              <Tooltip content="Chỉ đặt giá/khóa cho các chương chưa có trên web" side="bottom" className="ml-1">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vipNewChaptersOnly}
                    onChange={(e) => onVipNewChaptersOnlyChange(e.target.checked)}
                    className="rounded border-border-main text-gold focus:ring-gold bg-bg-hover"
                  />
                  <span className="text-[11px] text-text-dim whitespace-nowrap">Chỉ VIP chương mới</span>
                </label>
              </Tooltip>
            </>
          )}

          {/* Upload Button / Progress */}
          <div className="ml-auto flex items-center min-w-[140px]">
            {progress.status === 'idle' ? (
              <button
                onClick={onUpload}
                className="w-full px-4 py-1.5 bg-gold text-bg-primary font-bold text-xs rounded-lg hover:bg-gold/90 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span><Upload size={14} /></span> Upload
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
                    {progress.success > 0 && <span className="text-jade"><Check size={10} className="inline mr-0.5 -mt-0.5" /> {progress.success}</span>}
                    {progress.failed > 0 && <span className="text-crimson"><X size={10} className="inline mr-0.5 -mt-0.5" /> {progress.failed}</span>}
                  </div>
                )}
                {(progress.status === 'done' || progress.status === 'error') ? (
                  <Tooltip content="Đóng và xóa kết quả tiến trình upload" side="top" className="mt-1.5 w-full">
                    <button
                      onClick={onRemoveJob}
                      className="w-full py-1 text-[10px] font-medium bg-bg-hover text-text-secondary hover:text-text-primary rounded"
                    >
                      Đóng
                    </button>
                  </Tooltip>
                ) : (
                  <Tooltip content="Dừng tiến trình upload đang chạy" side="top" className="mt-1.5 w-full">
                    <button
                      onClick={onCancelUpload}
                      className="w-full py-1 text-[10px] font-medium bg-crimson/10 text-crimson hover:bg-crimson/20 rounded"
                    >
                      Hủy tiến trình
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
