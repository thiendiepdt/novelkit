import { useDownloadQueue } from '@/shared/context/useDownloadQueue';
import { isTauri } from '@/shared/utils/platform';
import { invoke } from '@tauri-apps/api/core';
import { Download, Package, Folder } from 'lucide-react';

export default function DownloadsPage() {
  const { jobs, removeJob, cancelJob, clearDone } = useDownloadQueue();

  if (!isTauri()) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-dim p-8">
        Tính năng này chỉ hỗ trợ trên phiên bản Desktop.
      </div>
    );
  }

  const activeJobs = jobs.filter(j => j.status === 'downloading' || j.status === 'pending');
  const completedJobs = jobs.filter(j => j.status === 'done' || j.status === 'error');

  const handleOpenFolder = async (dir: string) => {
    try {
      await invoke('ttc_open_folder', { path: dir });
    } catch (e) {
      console.error('Failed to open folder:', e);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center text-gold"><Download size={28} /></span>
          <h1 className="text-xl md:text-2xl font-bold text-gold">Quản lý Tải xuống</h1>
        </div>
        {completedJobs.length > 0 && (
          <button 
            onClick={clearDone}
            className="px-4 py-2 bg-bg-hover text-text-secondary text-sm font-medium rounded-lg hover:bg-bg-card hover:text-text-primary border border-border-main transition-colors cursor-pointer"
          >
            Xóa lịch sử hoàn tất
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="bg-bg-card border border-border-main rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-bg-hover flex items-center justify-center mb-4 text-text-dim">
            <Package size={32} />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Chưa có dữ liệu tải xuống</h3>
          <p className="text-sm text-text-dim max-w-sm">
            Các tiến trình tải truyện từ TTC Uploader sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Jobs */}
          {activeJobs.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Đang xử lý ({activeJobs.length})</h2>
              <div className="grid gap-3">
                {activeJobs.map(job => {
                  const isDownloading = job.status === 'downloading';
                  let percent = 0;
                  if (job.progress && job.progress.total > 0) {
                    percent = Math.floor((job.progress.current / job.progress.total) * 100);
                  }

                  return (
                    <div key={job.id} className={`bg-bg-card border ${isDownloading ? 'border-gold/30 shadow-[0_0_15px_rgba(201,169,110,0.1)]' : 'border-border-main'} rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 transition-all`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="text-base font-bold text-text-primary truncate" title={job.bookTitle}>
                            {job.bookTitle}
                          </h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDownloading ? 'bg-gold/15 text-gold' : 'bg-bg-hover text-text-dim'}`}>
                            {isDownloading ? 'Đang tải' : 'Chờ xử lý'}
                          </span>
                        </div>
                        
                        {isDownloading && job.progress ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-text-dim">
                              <span className="truncate pr-4">{job.progress.current_title}</span>
                              <span className="flex-shrink-0 font-medium">{job.progress.current} / {job.progress.total}</span>
                            </div>
                            <div className="w-full h-2 bg-bg-hover rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gold rounded-full transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-dim">Đang xếp hàng đợi...</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 md:w-auto w-full justify-end flex-shrink-0 border-t md:border-t-0 border-border-main pt-3 md:pt-0">
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="px-4 py-2 border border-border-main text-text-dim text-sm font-medium rounded-lg hover:border-crimson hover:text-crimson hover:bg-crimson/5 transition-colors cursor-pointer"
                        >
                          Hủy tải
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Đã hoàn tất ({completedJobs.length})</h2>
              <div className="grid gap-3">
                {completedJobs.map(job => {
                  const isDone = job.status === 'done';
                  const isError = job.status === 'error';

                  return (
                    <div key={job.id} className="bg-bg-primary border border-border-main rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-text-primary truncate" title={job.bookTitle}>
                            {job.bookTitle}
                          </h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDone ? 'bg-jade/15 text-jade' : 'bg-crimson/15 text-crimson'}`}>
                            {isDone ? 'Thành công' : 'Thất bại'}
                          </span>
                        </div>
                        {isError && job.error ? (
                          <p className="text-xs text-crimson truncate" title={job.error}>{job.error}</p>
                        ) : (
                          <p className="text-xs text-text-dim truncate">Đã lưu: {job.options.save_dir}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 md:w-auto w-full justify-end flex-shrink-0 border-t md:border-t-0 border-border-main pt-3 md:pt-0">
                        {isDone && (
                          <button
                            onClick={() => {
                              let dir = job.options.save_dir;
                              if (job.options.mode === 'single') {
                                dir = dir.substring(0, Math.max(dir.lastIndexOf('\\'), dir.lastIndexOf('/')));
                              }
                              handleOpenFolder(dir);
                            }}
                            className="px-3 py-1.5 bg-bg-hover text-text-primary text-xs font-medium rounded-lg hover:bg-gold/20 hover:text-gold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Folder size={14} />
                            Mở thư mục
                          </button>
                        )}
                        <button
                          onClick={() => removeJob(job.id)}
                          className="px-3 py-1.5 border border-border-main text-text-dim text-xs font-medium rounded-lg hover:border-text-primary hover:text-text-primary transition-colors cursor-pointer"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
