import type { TtcStory } from '../types';
import ProxiedImage from './ProxiedImage';
import { useSettingsModal } from '@/features/settings/context/SettingsModalContext';

interface BookDetailHeaderProps {
  book: TtcStory;
  onBack: () => void;
}

/**
 * Header bar for the book detail/resync view: back button, poster, title, author.
 */
export function BookDetailHeader({ book, onBack }: BookDetailHeaderProps) {
  const { openSettings } = useSettingsModal();

  return (
    <div className="flex items-start gap-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <button
        onClick={onBack}
        className="mt-1 px-3 py-1.5 bg-bg-hover border border-border-main rounded-lg text-xs font-medium text-text-secondary hover:text-gold hover:border-gold/50 transition-colors cursor-pointer flex-shrink-0"
      >
        ← Quay lại
      </button>
      <ProxiedImage
        path={book.poster}
        alt={book.title}
        className="w-12 h-16 rounded object-cover shadow-sm flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-gold truncate">
          {book.title}
        </h1>
        <p className="text-xs text-text-secondary mt-0.5">
          {book.author} · {book.category}
        </p>
      </div>
      <button
        onClick={() => openSettings(book.id, book.title)}
        className="mt-1 px-3 py-1.5 bg-bg-hover border border-border-main rounded-lg text-xs font-medium text-text-secondary hover:text-gold hover:border-gold/50 transition-colors cursor-pointer flex-shrink-0 flex items-center gap-1.5"
        title="Cấu hình riêng cho truyện này"
      >
        <span>⚙️</span>
        <span className="hidden sm:inline">Cấu hình</span>
      </button>
    </div>
  );
}
