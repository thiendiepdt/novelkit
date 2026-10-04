import { Clock, Trash2 } from 'lucide-react';
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
        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
          {pending && (
            <Tooltip content="Xóa truyện đang chờ duyệt khỏi TTC (không hoàn tác được)" side="top">
              <button
                onClick={() => onDelete(book)}
                className="px-3 py-1 bg-crimson/10 text-crimson border border-crimson/20 text-xs font-medium rounded-lg hover:bg-crimson/20 hover:border-crimson/30 transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <Trash2 size={12} /> Xóa
              </button>
            </Tooltip>
          )}
          <Tooltip content="Sửa thông tin truyện (tác giả, thể loại, ảnh bìa...)" side="top">
            <button
              onClick={() => onEdit(book.id)}
              className="px-3 py-1 bg-jade/10 text-jade border border-jade/20 text-xs font-medium rounded-lg hover:bg-jade/20 hover:border-jade/30 transition-colors cursor-pointer"
            >
              ✏ Sửa
            </button>
          </Tooltip>
          <Tooltip content="Mở trang đồng bộ chương từ folder trong máy lên TTC" side="top">
            <button
              onClick={() => onResync(book)}
              className="px-3 py-1 bg-gold/15 text-gold text-xs font-medium rounded-lg hover:bg-gold/25 transition-colors cursor-pointer"
            >
              Đồng bộ
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
