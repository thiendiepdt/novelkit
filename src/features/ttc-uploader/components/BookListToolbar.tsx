import { Hourglass, Plus, ScanSearch, TrendingUp } from 'lucide-react';
import { Pagination } from '@/shared/components';
import { STATUS_OPTIONS } from '../constants';
import type { BookStatus } from '../constants';

interface BookListToolbarProps {
  totalStories: number;
  loadingBooks: boolean;
  searchKeyword: string;
  statusFilter: BookStatus[];
  currentPage: number;
  totalPages: number;
  booksLimit: number;
  onSearchChange: (value: string) => void;
  onStatusToggle: (status: BookStatus) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onCheckAbandon: () => void;
  /** Open "Quét chương mới": stories whose folder is ahead of TTC. */
  onScanSync: () => void;
  onOpenDrip: () => void;
  /** Drip plans running / in total, for the button badge. */
  dripRunning: number;
  dripTotal: number;
}

/**
 * Toolbar for the book list: search input, status filter tabs, refresh, create, and pagination.
 */
export function BookListToolbar({
  totalStories,
  loadingBooks,
  searchKeyword,
  statusFilter,
  currentPage,
  totalPages,
  booksLimit,
  onSearchChange,
  onStatusToggle,
  onPageChange,
  onLimitChange,
  onRefresh,
  onCreate,
  onCheckAbandon,
  onScanSync,
  onOpenDrip,
  dripRunning,
  dripTotal,
}: BookListToolbarProps) {
  return (
    <div className="flex-shrink-0">
      {/* Compact Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4">
        {/* Left: Title + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <h2 className="text-base font-semibold text-text-primary whitespace-nowrap flex items-center">
            Truyện của bạn
            {!loadingBooks && (
              <span className="text-text-dim font-normal ml-1.5 text-sm">({totalStories})</span>
            )}
          </h2>

          <div className="w-px h-5 bg-border-main hidden sm:block"></div>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStatusToggle(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-200 cursor-pointer flex items-center ${
                  statusFilter.includes(opt.value)
                    ? 'bg-gold/15 border-gold/50 text-gold font-semibold'
                    : 'bg-bg-hover border-border-main text-text-secondary hover:border-border-hover hover:text-text-primary'
                }`}
              >
                <span className="mr-1.5 flex items-center justify-center">{opt.icon}</span>{opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search + Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-sm pointer-events-none">🔍</span>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm truyện..."
              className="w-full pl-9 pr-3 py-1.5 bg-bg-card border border-border-main rounded-lg text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-gold/50 transition-colors"
            />
            {searchKeyword && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-secondary text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 justify-between sm:justify-start">
            <button
              onClick={onRefresh}
              disabled={loadingBooks}
              className="text-xs text-text-secondary hover:text-gold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-bg-hover"
            >
              <span>↻</span> <span className="hidden sm:inline">{loadingBooks ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
            <button
              onClick={onOpenDrip}
              title="Truyện đang nổi trên bảng cập nhật: đăng nhỏ giọt từng chương, luân phiên giữa các truyện"
              className="text-xs font-medium text-gold border border-gold/40 hover:bg-gold/10 transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              <TrendingUp size={14} /> Nổi bảng
              {dripTotal > 0 && (
                <span className={`px-1.5 rounded-full text-[10px] font-bold ${dripRunning > 0 ? 'bg-jade/20 text-jade' : 'bg-bg-hover text-text-dim'}`}>
                  {dripRunning}/{dripTotal}
                </span>
              )}
            </button>
            <button
              onClick={onScanSync}
              title="Quét truyện có chương mới trong folder hoặc chương khác với TTC, rồi upload hàng loạt"
              className="text-xs font-medium text-gold border border-gold/40 hover:bg-gold/10 transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              <ScanSearch size={14} /> Quét chương mới
            </button>
            <button
              onClick={onCheckAbandon}
              title="Xem truyện đang ra sắp bị vô hố và reup chương 1 để làm mới ngày cập nhật"
              className="text-xs font-medium text-gold border border-gold/40 hover:bg-gold/10 transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              <Hourglass size={14} /> Check vô hố
            </button>
            <button
              onClick={onCreate}
              className="text-xs font-bold bg-gold text-bg-primary hover:bg-gold/90 transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              <Plus size={14} /> Đăng truyện mới
            </button>
          </div>
        </div>
      </div>

      {/* Pagination Row */}
      <div className="flex justify-end mb-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            onPageChange(page);
          }}
          disabled={loadingBooks}
          limit={booksLimit}
          onLimitChange={onLimitChange}
        />
      </div>
    </div>
  );
}
