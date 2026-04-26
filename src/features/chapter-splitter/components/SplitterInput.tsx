import type { RefObject } from 'react';
import { useDragDrop } from '@/shared/hooks/useDragDrop';
import MiniMapTextarea from '@/shared/components/MiniMapTextarea';

interface SplitterInputProps {
  input: string;
  setInput: (v: string) => void;
  isMultiChapter: boolean;
  chapterBoundaryCount: number;
  isLargeInput: boolean;
  inputStats: { lines: number; words: number; chars: number } | null;
  isValidInput: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileUpload: (file: File) => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onPaste: () => void;
  onShowFullscreen: () => void;
}

export default function SplitterInput({
  input,
  setInput,
  isMultiChapter,
  chapterBoundaryCount,
  isLargeInput,
  inputStats,
  isValidInput,
  fileInputRef,
  onFileUpload,
  onFileInputChange,
  onClear,
  onPaste,
  onShowFullscreen,
}: SplitterInputProps) {
  const { isDragOver, dragHandlers } = useDragDrop({
    accept: '.txt',
    onFile: onFileUpload,
  });

  return (
    <div className="mb-4" style={{ animation: 'fadeIn 0.4s ease-out 0.1s both' }} {...dragHandlers}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <label htmlFor="input-text" className="text-sm font-medium text-text-secondary">
            📥 Nội dung gốc
          </label>
          {input.trim() && (
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-all ${
                isMultiChapter
                  ? 'bg-purple/15 text-purple border border-purple/30'
                  : 'bg-jade/15 text-jade border border-jade/30'
              }`}
            >
              {isMultiChapter ? `📚 ${chapterBoundaryCount} chương` : '📖 1 chương'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onShowFullscreen}
            disabled={!input.trim()}
            className="text-xs font-medium text-text-primary bg-bg-card border border-border-main hover:border-border-gold hover:text-gold transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <span>⛶</span> Toàn màn
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-medium text-purple bg-purple/10 border border-purple/25 hover:bg-purple/20 transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95 flex items-center gap-1"
          >
            📂 Upload .txt
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={onFileInputChange}
            className="hidden"
          />
          {input && (
            <button
              onClick={onClear}
              className="text-xs font-medium text-crimson bg-crimson/10 border border-crimson/25 hover:bg-crimson/20 transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95"
            >
              ✕ Xóa
            </button>
          )}
          <button
            onClick={onPaste}
            className="text-xs font-medium text-gold bg-gold-glow/50 border border-border-gold hover:bg-gold-glow transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95"
          >
            📋 Dán
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Drag & drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-20 bg-purple/10 border-2 border-dashed border-purple/50 rounded-xl flex items-center justify-center backdrop-blur-sm pointer-events-none">
            <div className="text-center">
              <span className="text-3xl block mb-2">📂</span>
              <span className="text-sm font-medium text-purple">Thả file .txt vào đây</span>
            </div>
          </div>
        )}
        {isLargeInput && inputStats ? (
          <div className="bg-bg-card border border-border-main rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📄</span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Nội dung đã tải</p>
                <p className="text-xs text-text-dim mt-0.5">Quá lớn để hiển thị — sẽ xử lý khi bấm Chia</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-text-dim">Ký tự:</span>
                <span className="font-mono font-semibold text-text-primary">
                  {new Intl.NumberFormat('en-US').format(inputStats.chars)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-text-dim">Số chữ:</span>
                <span className="font-mono font-semibold text-gold">
                  {new Intl.NumberFormat('en-US').format(inputStats.words)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-text-dim">Đoạn văn:</span>
                <span className="font-mono font-semibold text-text-primary">
                  {new Intl.NumberFormat('en-US').format(inputStats.lines)}
                </span>
              </div>
              {isMultiChapter && (
                <div className="flex items-center gap-1.5">
                  <span className="text-text-dim">Chương:</span>
                  <span className="font-mono font-semibold text-purple">{chapterBoundaryCount}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <MiniMapTextarea
            id="input-text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'Chương 1: Bắt đầu\n\nĐoạn văn đầu tiên...\n\nChương 2: Tiếp theo\n\nĐoạn văn chương 2...\n\n— Paste, upload hoặc kéo thả file .txt vào đây —'}
            className="w-full bg-bg-card border border-border-main rounded-xl p-4 text-sm leading-relaxed text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-border-gold focus:ring-1 focus:ring-border-gold/30 transition-all duration-300 resize-none"
            rows={9}
            style={{ minHeight: '160px' }}
          />
        )}
      </div>
      {!isValidInput && (
        <p className="text-xs text-crimson mt-2 flex items-center gap-1.5" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <span>⚠️</span> Văn bản phải bắt đầu bằng chữ "Chương" (dòng đầu làm tiêu đề).
        </p>
      )}
    </div>
  );
}
