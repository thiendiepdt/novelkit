import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDownloadQueue } from '../context/useDownloadQueue';
import type { DownloadJob } from '../context/downloadQueueDefs';
import { isTauri } from '@/shared/utils/platform';
import { Tooltip } from './Tooltip';
import { Download, X, Folder } from 'lucide-react';

export default function DownloadQueueManager() {
  const { jobs, removeJob, cancelJob, clearDone } = useDownloadQueue();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeJobs = jobs.filter(j => j.status === 'downloading' || j.status === 'pending');
  const hasJobs = jobs.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isTauri()) return null; // Desktop only

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip content="Quản lý tiến trình tải" side="bottom">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
            activeJobs.length > 0
              ? 'bg-gold/10 text-gold hover:bg-gold/20'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          <Download size={18} />
          {activeJobs.length > 0 && (
            <span className="text-xs font-bold">{activeJobs.length}</span>
          )}
        </button>
      </Tooltip>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-bg-card border border-border-main rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-border-main flex justify-between items-center bg-bg-hover/50">
            <h3 className="text-sm font-semibold text-text-primary">Tiến trình tải</h3>
            {jobs.some(j => j.status === 'done' || j.status === 'error') && (
              <Tooltip content="Xóa các mục đã hoàn tất hoặc lỗi" side="bottom">
                <button
                  onClick={clearDone}
                  className="text-xs text-text-dim hover:text-gold transition-colors"
                >
                  Xóa mục đã xong
                </button>
              </Tooltip>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto p-2 space-y-2">
            {!hasJobs ? (
              <div className="px-4 py-8 text-center text-sm text-text-dim">
                Không có tiến trình tải nào.
              </div>
            ) : (
              jobs.map(job => (
                <JobItem key={job.id} job={job} onRemove={() => removeJob(job.id)} onCancel={() => cancelJob(job.id)} />
              ))
            )}
          </div>

          <div className="border-t border-border-main bg-bg-primary">
            <Link
              to="/downloads"
              onClick={() => setIsOpen(false)}
              className="block w-full text-center py-2 text-xs font-medium text-gold hover:bg-gold/10 transition-colors"
            >
              Xem tất cả chi tiết &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function JobItem({ job, onRemove, onCancel }: { job: DownloadJob, onRemove: () => void, onCancel: () => void }) {
  const isDone = job.status === 'done';
  const isError = job.status === 'error';
  const isDownloading = job.status === 'downloading';

  let percent = 0;
  if (job.progress && job.progress.total > 0) {
    percent = Math.floor((job.progress.current / job.progress.total) * 100);
  } else if (isDone) {
    percent = 100;
  }

  return (
    <div className="p-3 bg-bg-primary rounded-lg border border-border-main relative group">
      <div className="flex justify-between items-start mb-1.5">
        <h4 className="text-xs font-medium text-text-primary truncate pr-6" title={job.bookTitle}>
          {job.bookTitle}
        </h4>
        <Tooltip content="Xóa khỏi danh sách" side="left" className="absolute top-2.5 right-2.5">
          <button
            onClick={onRemove}
            className="text-text-dim hover:text-crimson opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </Tooltip>
      </div>

      <div className="flex justify-between items-center text-[10px] mb-1.5">
        <span className={`${isError ? 'text-crimson' : isDone ? 'text-jade' : isDownloading ? 'text-gold' : 'text-text-dim'}`}>
          {isError ? 'Lỗi' : isDone ? 'Hoàn tất' : isDownloading ? 'Đang tải...' : 'Chờ tải...'}
        </span>
        {isDownloading && job.progress && (
          <span className="text-text-dim">
            {job.progress.current} / {job.progress.total}
          </span>
        )}
      </div>

      {(isDownloading || isDone) && !isError && (
        <div className="w-full h-1.5 bg-bg-hover rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-jade' : 'bg-gold'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {isDownloading && job.progress?.current_title && (
        <p className="text-[10px] text-text-dim truncate mt-1.5">
          {job.progress.current_title}
        </p>
      )}

      {isDone && (
        <div className="mt-2 flex justify-end">
          <Tooltip content="Mở thư mục chứa file đã tải" side="top">
          <button
            onClick={async () => {
              if (!isTauri()) return;
              try {
                const { invoke } = await import('@tauri-apps/api/core');
                let dir = job.options.save_dir;
                if (job.options.mode === 'single') {
                  dir = dir.substring(0, Math.max(dir.lastIndexOf('\\'), dir.lastIndexOf('/')));
                }
                await invoke('ttc_open_folder', { path: dir });
              } catch (e) {
                console.error('Failed to open folder:', e);
              }
            }}
            className="text-[10px] text-text-dim hover:text-gold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Folder size={12} />
            Mở thư mục
          </button>
          </Tooltip>
        </div>
      )}

      {(isDownloading || job.status === 'pending') && (
        <div className="mt-2 flex justify-end">
          <Tooltip content="Hủy tiến trình tải này" side="top">
            <button
              onClick={onCancel}
              className="text-[10px] px-2 py-0.5 border border-border-main text-text-dim hover:text-crimson hover:border-crimson rounded transition-colors flex items-center gap-1 cursor-pointer"
            >
              Hủy
            </button>
          </Tooltip>
        </div>
      )}

      {isError && job.error && (
        <p className="text-[10px] text-crimson truncate mt-1">
          {job.error}
        </p>
      )}
    </div>
  );
}
