import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { deleteBook } from '../api';
import type { TtcStory } from '../types';

interface DeleteBookModalProps {
  book: TtcStory;
  onClose: () => void;
  /** Called after TTC accepted the request; `message` is its confirmation, or null if it gave none. */
  onDeleted: (book: TtcStory, message: string | null) => void;
}

/** Rust commands reject with a bare string, JS code with an Error: show either. */
function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  return 'Lỗi khi xóa truyện';
}

/**
 * Confirmation before deleting a story that is still waiting for approval.
 * Deleting is irreversible, so nothing is sent until the user confirms here.
 */
export function DeleteBookModal({ book, onClose, onDeleted }: DeleteBookModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const message = await deleteBook(book.id);
      onDeleted(book, message);
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" style={{ animation: 'overlayIn 0.2s ease-out' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-book-title"
        className="bg-bg-card border border-border-main rounded-xl w-full max-w-md shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="px-5 py-4 border-b border-border-main flex items-center gap-2 bg-bg-hover/30 rounded-t-xl">
          <AlertTriangle size={18} className="text-crimson" />
          <h2 id="delete-book-title" className="text-lg font-bold text-text-primary">
            Xóa truyện chờ duyệt
          </h2>
        </div>

        <div className="p-5 flex flex-col gap-3 text-sm text-text-secondary">
          <p>Bạn sắp xóa truyện này khỏi TiemTruyenChu:</p>
          <p className="font-semibold text-text-primary break-words">“{book.title}”</p>
          <p>
            {book.total_chapters > 0 ? `Truyện đang có ${book.total_chapters} chương. ` : ''}
            Thao tác này <strong className="text-crimson">không hoàn tác được</strong>.
          </p>
          {error && (
            <div role="alert" className="p-3 bg-crimson/10 border border-crimson/30 rounded-lg text-crimson break-words">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border-main flex justify-end gap-3 bg-bg-hover/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2 bg-crimson text-white font-bold text-sm rounded-lg hover:bg-crimson/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {deleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Đang xóa...
              </>
            ) : (
              <>
                <Trash2 size={14} /> Xóa truyện
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
