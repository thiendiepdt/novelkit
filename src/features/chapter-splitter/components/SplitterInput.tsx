import type { RefObject } from 'react';
import { useDragDrop } from '@/shared/hooks/useDragDrop';
import MiniMapTextarea from '@/shared/components/MiniMapTextarea';
import { Tooltip } from '@/shared/components';
import { Library, BookOpen, Maximize2, FolderOpen, FileText, AlertTriangle, DownloadCloud, Clipboard } from 'lucide-react';

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
            <DownloadCloud size={14} className="inline mr-1 -mt-0.5" /> Nội dung gốc
          </label>
          {input.trim() && (
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-all ${
                isMultiChapter
                  ? 'bg-purple/15 text-purple border border-purple/30'
                  : 'bg-jade/15 text-jade border border-jade/30'
              }`}
            >
              {isMultiChapter ? <><Library size={12} className="inline mr-1" /> {chapterBoundaryCount} chương</> : <><BookOpen size={12} className="inline mr-1" /> 1 chương</>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Xem nội dung gốc ở chế độ toàn màn hình" side="bottom">
            <button
              onClick={onShowFullscreen}
              disabled={!input.trim()}
              className="text-xs font-medium text-text-primary bg-bg-card border border-border-main hover:border-border-gold hover:text-gold transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Maximize2 size={14} /> Toàn màn
            </button>
          </Tooltip>
          <Tooltip content="Chọn file .txt từ máy để tải nội dung lên" side="bottom">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-medium text-purple bg-purple/10 border border-purple/25 hover:bg-purple/20 transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95 flex items-center gap-1"
            >
              <FolderOpen size={14} className="inline mr-1" /> Upload .txt
            </button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={onFileInputChange}
            className="hidden"
          />
          {input && (
            <Tooltip content="Xóa toàn bộ nội dung gốc" side="bottom">
              <button
                onClick={onClear}
                className="text-xs font-medium text-crimson bg-crimson/10 border border-crimson/25 hover:bg-crimson/20 transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95"
              >
                ✕ Xóa
              </button>
            </Tooltip>
          )}
          <Tooltip content="Dán nội dung từ clipboard vào ô nhập" side="bottom">
            <button
              onClick={onPaste}
              className="text-xs font-medium text-gold bg-gold-glow/50 border border-border-gold hover:bg-gold-glow transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95"
            >
              <Clipboard size={12} className="inline mr-1" /> Dán
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="relative">
        {/* Drag & drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-20 bg-purple/10 border-2 border-dashed border-purple/50 rounded-xl flex items-center justify-center backdrop-blur-sm pointer-events-none">
            <div className="text-center">
              <div className="flex justify-center mb-2"><FolderOpen size={36} className="text-purple" /></div>
              <span className="text-sm font-medium text-purple">Thả file .txt vào đây</span>
            </div>
          </div>
        )}
        {isLargeInput && inputStats ? (
          <div className="bg-bg-card border border-border-main rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <FileText size={24} className="text-text-dim" />
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
          <Tooltip content="Nhập, dán hoặc kéo thả văn bản chương truyện vào đây" side="top" className="w-full">
            <MiniMapTextarea
              id="input-text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={'Chương 1: Bắt đầu\n\nĐoạn văn đầu tiên...\n\nChương 2: Tiếp theo\n\nĐoạn văn chương 2...\n\n— Paste, upload hoặc kéo thả file .txt vào đây —'}
              className="w-full bg-bg-card border border-border-main rounded-xl p-4 text-sm leading-relaxed text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-border-gold focus:ring-1 focus:ring-border-gold/30 transition-all duration-300 resize-none"
              rows={9}
              style={{ minHeight: '160px' }}
            />
          </Tooltip>
        )}
      </div>
      {!isValidInput && (
        <p className="text-xs text-crimson mt-2 flex items-center gap-1.5" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <AlertTriangle size={14} /> Văn bản phải bắt đầu bằng chữ "Chương" (dòng đầu làm tiêu đề).
        </p>
      )}
    </div>
  );
}
