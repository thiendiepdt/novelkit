import { useState, useRef, useEffect } from 'react';
import { useUploadQueueContext } from '../context/UploadQueueContext';
import { Tooltip } from './Tooltip';
import { Upload, X, Check, AlertCircle } from 'lucide-react';

export default function UploadQueueManager() {
  const { jobs, cancelJob, removeJob, clearDone } = useUploadQueueContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
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

  const activeCount = jobs.filter(j => j.status === 'uploading').length;
  const pendingCount = jobs.filter(j => j.status === 'pending').length;
  const totalActive = activeCount + pendingCount;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <Tooltip content="Hàng đợi Đăng chương" side="bottom">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
            totalActive > 0 ? 'bg-gold/10 text-gold hover:bg-gold/20' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          <Upload size={20} />
          {totalActive > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-crimson text-[10px] font-bold text-white shadow-sm ring-2 ring-bg-main">
              {totalActive}
            </span>
          )}
        </button>
      </Tooltip>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[380px] bg-bg-card border border-border-main rounded-xl shadow-2xl z-50 flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-main">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <Upload size={18} className="text-gold" />
              Tiến trình Đăng chương
            </h3>
            {jobs.some(j => j.status === 'done' || j.status === 'error') && (
              <Tooltip content="Xóa các mục đã xong hoặc lỗi" side="bottom">
                <button
                  onClick={clearDone}
                  className="text-xs text-text-dim hover:text-text-primary transition-colors flex items-center gap-1"
                >
                  Xóa lịch sử
                </button>
              </Tooltip>
            )}
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-text-dim text-sm">
                Không có tác vụ nào trong hàng đợi
              </div>
            ) : (
              [...jobs].reverse().map(job => (
                <div key={job.id} className="bg-bg-primary rounded-lg p-3 border border-border-main">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-text-primary truncate" title={job.bookTitle}>
                        {job.bookTitle}
                      </div>
                      <div className="text-[11px] text-text-dim mt-0.5">
                        {new Date(job.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    
                    {/* Actions based on status */}
                    {(job.status === 'pending' || job.status === 'uploading') ? (
                      <Tooltip content="Hủy tiến trình đăng" side="left">
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="p-1 text-text-dim hover:text-crimson hover:bg-crimson/10 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </Tooltip>
                    ) : (
                      <Tooltip content="Xóa khỏi danh sách" side="left">
                        <button
                          onClick={() => removeJob(job.id)}
                          className="p-1 text-text-dim hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </Tooltip>
                    )}
                  </div>

                  {/* Status Indicator & Progress Bar */}
                  {job.status === 'uploading' && job.progress && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gold animate-pulse">Đang tải lên...</span>
                        <span className="text-text-secondary">{job.progress.current} / {job.progress.total}</span>
                      </div>
                      <div className="h-1.5 w-full bg-bg-hover rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gold transition-all duration-300"
                          style={{ width: `${(job.progress.current / job.progress.total) * 100}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-text-dim truncate">
                        {job.progress.current_title}
                      </div>
                    </div>
                  )}

                  {job.status === 'pending' && (
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <div className="w-1.5 h-1.5 rounded-full bg-text-dim" />
                      Đang đợi...
                    </div>
                  )}

                  {job.status === 'done' && (
                    <div className="flex items-center gap-1.5 text-xs text-jade">
                      <Check size={12} />
                      Đã hoàn tất
                    </div>
                  )}

                  {job.status === 'error' && (
                    <div className="text-xs text-crimson">
                      <div className="flex items-center gap-1.5 font-medium mb-1">
                        <AlertCircle size={12} />
                        Lỗi đăng chương
                      </div>
                      <div className="text-[11px] opacity-80 break-words">
                        {job.error}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
