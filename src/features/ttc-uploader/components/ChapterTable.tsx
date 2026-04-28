import { Pagination } from '@/shared/components';
import type { TtcChapter, TtcStory } from '../types';
import { ClipboardList, Download, RefreshCw, Lock } from 'lucide-react';

interface ChapterTableProps {
  selectedBook: TtcStory;
  chapters: TtcChapter[];
  currentPage: number;
  totalPages: number;
  totalChapters: number;
  loading: boolean;
  chaptersLimit: number;
  onPageChange: (bookId: number, page: number, limit: number) => void;
  onLimitChange: (newLimit: number) => void;
  onRefresh: () => void;
  onDownloadChapter: (ch: TtcChapter) => void;
  onDownloadAll: () => void;
}

/**
 * Remote chapter table with sticky header, pagination, download buttons.
 */
export function ChapterTable({
  selectedBook,
  chapters,
  currentPage,
  totalPages,
  totalChapters,
  loading,
  chaptersLimit,
  onPageChange,
  onLimitChange,
  onRefresh,
  onDownloadChapter,
  onDownloadAll,
}: ChapterTableProps) {
  return (
    <div className="bg-bg-card border border-border-main rounded-xl overflow-hidden mt-4 flex flex-col flex-1 min-h-0" style={{ animation: 'slideUp 0.3s ease-out 0.1s both' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-bg-hover/50 border-b border-border-main flex justify-between items-center z-10">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <ClipboardList size={18} /> Danh sách chương trên TTC
          <span className="text-xs font-normal text-text-dim bg-bg-primary px-2 py-0.5 rounded-full">
            {totalChapters || selectedBook.total_chapters} chương
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onDownloadAll}
            className="text-xs px-2.5 py-1 bg-gold/10 border border-gold/30 text-gold rounded hover:bg-gold/20 hover:border-gold/50 transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
            title="Tải toàn bộ chương truyện về máy"
          >
            <Download size={14} /> Tải Cả Bộ
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-xs text-text-dim hover:text-gold transition-colors cursor-pointer disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <RefreshCw size={14} className="inline mr-1 -mt-0.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex-shrink-0 px-4 py-2.5 bg-bg-card border-b border-border-main flex justify-end">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            onPageChange(selectedBook.id, page, chaptersLimit);
          }}
          disabled={loading}
          limit={chaptersLimit}
          onLimitChange={onLimitChange}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto relative min-h-[300px]">
        {loading && chapters.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-dim bg-bg-card/50 backdrop-blur-sm z-20">
            Đang tải danh sách chương...
          </div>
        ) : chapters.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-dim">
            Không có chương nào.
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg-hover/80 backdrop-blur-md sticky top-0 z-10 text-xs text-text-secondary shadow-sm">
              <tr>
                <th className="px-4 py-2 font-medium w-16 text-center border-b border-border-main">STT</th>
                <th className="px-4 py-2 font-medium border-b border-border-main">Tên chương</th>
                <th className="px-4 py-2 font-medium w-24 text-right border-b border-border-main">Số chữ</th>
                <th className="px-4 py-2 font-medium w-24 text-right border-b border-border-main">Lượt xem</th>
                <th className="px-4 py-2 font-medium w-24 text-center border-b border-border-main">Mua/Click</th>
                <th className="px-4 py-2 font-medium w-28 text-center border-b border-border-main">Trạng thái</th>
                <th className="px-4 py-2 font-medium w-32 text-center border-b border-border-main">Cập nhật</th>
                <th className="px-4 py-2 font-medium w-20 text-center border-b border-border-main">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {chapters.map((ch) => (
                <ChapterRow key={ch.chapterNumber} chapter={ch} onDownload={onDownloadChapter} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Chapter Row ──────────────────────────────────────────

function ChapterRow({ chapter: ch, onDownload }: { chapter: TtcChapter; onDownload: (ch: TtcChapter) => void }) {
  return (
    <tr className="hover:bg-bg-hover/50 transition-colors text-text-primary">
      <td className="px-4 py-2.5 text-center text-text-dim text-xs font-mono">{ch.chapterNumber}</td>
      <td className="px-4 py-2.5 max-w-[200px] md:max-w-[400px]" title={ch.title}>
        <div className="flex items-center gap-2">
          <span className="truncate">{ch.title}</span>
          {ch.chapter_price > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 bg-[#d32f2f] text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold shadow-sm">
              <Lock size={10} /> VIP • {ch.chapter_price} 🌸
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right text-text-dim text-xs font-mono">
        {ch.wordCount > 0 ? ch.wordCount.toLocaleString() : '-'}
      </td>
      <td className="px-4 py-2.5 text-right text-text-dim text-xs font-mono">
        {ch.views.toLocaleString()}
      </td>
      <td className="px-4 py-2.5 text-center text-text-dim text-xs font-mono">
        {ch.chapter_price > 0
          ? (ch.buy_count?.toLocaleString() || '0')
          : (ch.unlock_link ? (ch.link_click_count?.toLocaleString() || '0') : '—')}
      </td>
      <td className="px-4 py-2.5 text-center">
        <ChapterStatusBadge status={ch.status} />
      </td>
      <td className="px-4 py-2.5 text-center text-text-dim text-xs">
        {ch.last_chap_updated ? new Date(ch.last_chap_updated).toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
      </td>
      <td className="px-4 py-2.5 text-center">
        <button
          onClick={() => onDownload(ch)}
          className="px-2 py-1 text-[10px] font-medium rounded border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:border-gold/50 transition-colors cursor-pointer"
          title={`Tải nội dung chương ${ch.chapterNumber}`}
        >
          <Download size={10} className="inline mr-0.5 -mt-0.5" /> Tải
        </button>
      </td>
    </tr>
  );
}

// ─── Chapter Status Badge ─────────────────────────────────

function ChapterStatusBadge({ status }: { status: string | null }) {
  if (status === 'published') {
    return (
      <span className="inline-block px-2 py-0.5 bg-jade/10 border border-jade/20 text-jade rounded text-[10px] uppercase font-semibold tracking-wider">
        Xuất bản
      </span>
    );
  }
  if (status === 'draft') {
    return (
      <span className="inline-block px-2 py-0.5 bg-gold/10 border border-gold/20 text-gold rounded text-[10px] uppercase font-semibold tracking-wider">
        Bản nháp
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 bg-bg-hover border border-border-main text-text-dim rounded text-[10px] uppercase font-semibold tracking-wider">
      {status || 'N/A'}
    </span>
  );
}
