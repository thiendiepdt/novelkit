import { useState, useCallback } from 'react';
import { useDownloadQueue } from '@/shared/context/useDownloadQueue';
import { Select } from '@/shared/components';
import type { TtcStory } from '../types';
import type { DownloadAllOptions } from '@/shared/types/download';

interface DownloadAllModalProps {
  book: TtcStory;
  onClose: () => void;
}

/**
 * Modal for configuring and starting a full-book download.
 */
export function DownloadAllModal({ book, onClose }: DownloadAllModalProps) {
  const { addJob } = useDownloadQueue();
  const [dlOptions, setDlOptions] = useState<Omit<DownloadAllOptions, 'book_id' | 'book_title' | 'save_dir'>>({
    mode: 'single',
    chunk_size: 100,
    delay_ms: 100,
    threads: 1,
  });

  const handleStart = useCallback(async () => {
    try {
      const { save, open } = await import('@tauri-apps/plugin-dialog');

      let save_dir = '';
      if (dlOptions.mode === 'single') {
        const safeName = book.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
        const path = await save({
          defaultPath: `${safeName}.txt`,
          filters: [{ name: 'Text', extensions: ['txt'] }],
          title: `Lưu truyện: ${book.title}`,
        });
        if (!path) return;
        save_dir = path;
      } else {
        const path = await open({
          directory: true,
          title: 'Chọn thư mục để lưu truyện',
        });
        if (!path) return;
        save_dir = path;
      }

      const options: DownloadAllOptions = {
        book_id: book.id,
        book_title: book.title,
        save_dir,
        mode: dlOptions.mode,
        chunk_size: dlOptions.chunk_size,
        delay_ms: dlOptions.delay_ms,
        threads: dlOptions.threads,
      };

      addJob(options);
      onClose();
    } catch (e) {
      console.error('Download all error:', e);
      alert(`Lỗi khi khởi tạo tải truyện: ${String(e)}`);
    }
  }, [book, dlOptions, addJob, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="bg-bg-card border border-border-main rounded-xl w-full max-w-md shadow-2xl" style={{ animation: 'slideUp 0.3s ease-out' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-main flex justify-between items-center">
          <h3 className="text-lg font-bold text-gold">Tải toàn bộ chương</h3>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-crimson transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-text-secondary">
            Bộ truyện <strong>{book.title}</strong> có tổng cộng <strong>{book.total_chapters}</strong> chương.
          </p>

          <div className="space-y-2">
            <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">Hình thức lưu file:</label>
            <Select
              fullWidth
              value={dlOptions.mode}
              onChange={(e) => setDlOptions(prev => ({ ...prev, mode: e.target.value as DownloadAllOptions['mode'] }))}
              className="bg-bg-hover text-sm"
            >
              <option value="single">Gộp chung thành 1 file .txt (Khuyên dùng)</option>
              <option value="chunked">Chia file theo khoảng ({dlOptions.chunk_size} chương / file)</option>
              <option value="split">Lưu mỗi chương thành 1 file riêng biệt</option>
            </Select>
          </div>

          {dlOptions.mode === 'chunked' && (
            <div className="space-y-2">
              <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">Số chương mỗi file:</label>
              <input
                type="number"
                value={dlOptions.chunk_size}
                onChange={(e) => setDlOptions(prev => ({ ...prev, chunk_size: Number(e.target.value) }))}
                min={10}
                step={10}
                className="w-full px-3 py-2 bg-bg-hover border border-border-main rounded-lg text-sm text-text-primary focus:outline-none focus:border-gold/50"
              />
            </div>
          )}

          <div className="flex gap-4">
            <div className="space-y-2 flex-1">
              <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">Delay chống ban IP (ms):</label>
              <input
                type="number"
                value={dlOptions.delay_ms}
                onChange={(e) => setDlOptions(prev => ({ ...prev, delay_ms: Number(e.target.value) }))}
                min={0}
                step={50}
                className="w-full px-3 py-2 bg-bg-hover border border-border-main rounded-lg text-sm text-text-primary focus:outline-none focus:border-gold/50"
              />
            </div>

            <div className="space-y-2 flex-1">
              <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">Số luồng tải:</label>
              <Select
                fullWidth
                value={dlOptions.threads}
                onChange={(e) => setDlOptions(prev => ({ ...prev, threads: Number(e.target.value) }))}
                className="bg-bg-hover text-sm"
              >
                {[1, 2, 3, 4, 5].map(t => (
                  <option key={t} value={t}>{t} luồng</option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-[10px] text-text-dim">Mặc định delay 100ms. Hạ xuống 0 sẽ tải nhanh hơn nhưng dễ bị server chặn kết nối. Tăng số luồng tải sẽ chia nhỏ các chương để tải đồng thời.</p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-main flex justify-end gap-3 bg-bg-hover/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-gold text-bg-primary font-bold text-sm rounded-lg hover:bg-gold/90 transition-colors cursor-pointer"
          >
            Bắt đầu tải
          </button>
        </div>
      </div>
    </div>
  );
}
