import { Clock, ListOrdered, Pencil, Trash2 } from 'lucide-react';
import { isPendingApproval } from '../types';
import type { TtcStory } from '../types';
import ProxiedImage from './ProxiedImage';
import { Tooltip } from '@/shared/components';

interface BookCardProps {
  book: TtcStory;
  onEdit: (bookId: number) => void;
  onResync: (book: TtcStory) => void;
  /** Offered only for stories still waiting for approval. */
  onDelete: (book: TtcStory) => void;
}

/** Shared shape of the card actions: large enough to hit without aiming. */
const ACTION_CLASS =
  'h-9 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2';

/**
 * Compact book card showing poster, metadata, and action buttons.
 */
export function BookCard({ book, onEdit, onResync, onDelete }: BookCardProps) {
  const pending = isPendingApproval(book);

  return (
    <div className="bg-bg-card border border-border-main rounded-xl p-3 transition-all duration-200 hover:border-border-hover">
      <div className="flex items-start gap-3">
        <ProxiedImage
          path={book.poster}
          alt={book.title}
          className="w-10 h-14 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {book.title}
            </h3>
            {pending && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/40 bg-gold/10 text-gold text-[11px] font-semibold whitespace-nowrap">
                <Clock size={11} /> Chờ duyệt
              </span>
            )}
          </div>
          <p className="text-xs text-text-dim mt-0.5">
            {book.author} · {book.category} · {book.total_chapters} chương
          </p>
          {book.latest_chapter_title && (
            <p className="text-xs text-text-dim mt-0.5 truncate">
              Mới nhất: {book.latest_chapter_title}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0 self-center">
          {pending && (
            <Tooltip content="Xóa truyện đang chờ duyệt khỏi TTC (không hoàn tác được)" side="top">
              <button
                type="button"
                onClick={() => onDelete(book)}
                className={`${ACTION_CLASS} mr-2 border border-crimson/30 bg-crimson/10 text-crimson hover:bg-crimson/20 hover:border-crimson/50 focus-visible:ring-crimson/60`}
              >
                <Trash2 size={16} /> Xóa
              </button>
            </Tooltip>
          )}
          <Tooltip
            content={
              pending
                ? 'Sửa thông tin truyện: đang chờ duyệt nên sửa được tất cả, kể cả tên truyện, loại truyện, nguồn tiếng Trung'
                : 'Sửa thông tin truyện (tác giả, thể loại, ảnh bìa...)'
            }
            side="top"
          >
            <button
              type="button"
              onClick={() => onEdit(book.id)}
              className={`${ACTION_CLASS} border border-border-main bg-bg-hover text-text-primary hover:border-jade/50 hover:text-jade focus-visible:ring-jade/60`}
            >
              <Pencil size={16} /> Sửa
            </button>
          </Tooltip>
          <Tooltip content="Danh sách chương trên TTC: upload, so sánh với folder trong máy, tải về" side="top">
            <button
              type="button"
              onClick={() => onResync(book)}
              className={`${ACTION_CLASS} bg-gold text-bg-primary font-semibold shadow-sm hover:bg-gold/90 focus-visible:ring-gold/60`}
            >
              <ListOrdered size={16} /> Quản lý chương
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
