import type { TtcStory } from '../types';
import ProxiedImage from './ProxiedImage';

interface BookCardProps {
  book: TtcStory;
  onEdit: (bookId: number) => void;
  onResync: (book: TtcStory) => void;
}

/**
 * Compact book card showing poster, metadata, and action buttons.
 */
export function BookCard({ book, onEdit, onResync }: BookCardProps) {
  return (
    <div className="bg-bg-card border border-border-main rounded-xl p-3 transition-all duration-200 hover:border-border-hover">
      <div className="flex items-start gap-3">
        <ProxiedImage
          path={book.poster}
          alt={book.title}
          className="w-10 h-14 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {book.title}
          </h3>
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
          <button
            onClick={() => onEdit(book.id)}
            className="px-3 py-1 bg-jade/10 text-jade border border-jade/20 text-xs font-medium rounded-lg hover:bg-jade/20 hover:border-jade/30 transition-colors cursor-pointer"
          >
            ✏ Sửa
          </button>
          <button
            onClick={() => onResync(book)}
            className="px-3 py-1 bg-gold/15 text-gold text-xs font-medium rounded-lg hover:bg-gold/25 transition-colors cursor-pointer"
          >
            Resync
          </button>
        </div>
      </div>
    </div>
  );
}
