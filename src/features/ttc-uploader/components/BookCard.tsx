import type { ReactNode } from 'react';
import { Cat, Check, Clock, ListOrdered, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { isPendingApproval } from '../types';
import type { TtcStory } from '../types';
import type { DripStatus } from '../drip/dripEngine';
import { isFemaleStory } from '../meotruyen/buildImport';
import type { MeoLink } from '../meotruyen/types';
import ProxiedImage from './ProxiedImage';
import { SourceLink } from './SourceLink';
import { Tooltip } from '@/shared/components';

interface BookCardProps {
  book: TtcStory;
  onEdit: (bookId: number) => void;
  onResync: (book: TtcStory) => void;
  /** Offered only for stories still waiting for approval. */
  onDelete: (book: TtcStory) => void;
  /** Status of the story's "Nổi bảng" plan, if it has one. */
  dripStatus?: DripStatus;
  /** A line under the details, e.g. how the folder differs from TTC. */
  note?: ReactNode;
  /** "Mèo Truyện": offered for female stories only. */
  onMeoTruyen?: (book: TtcStory) => void;
  /** The Mèo Truyện book this story was imported as, if it was. */
  meoLink?: MeoLink;
}

/** Shared shape of the card actions: large enough to hit without aiming. */
const ACTION_CLASS =
  'h-9 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2';

/**
 * Compact book card showing poster, metadata, and action buttons.
 */
export function BookCard({ book, onEdit, onResync, onDelete, dripStatus, note, onMeoTruyen, meoLink }: BookCardProps) {
  const pending = isPendingApproval(book);

  return (
    <div className="bg-bg-card border border-border-main rounded-xl p-3 transition-all duration-200 hover:border-border-hover">
      {/* In a narrow window the actions move under the details instead of squeezing them */}
      <div className="flex flex-wrap items-start gap-3">
        <ProxiedImage
          path={book.poster}
          alt={book.title}
          className="w-10 h-14 flex-shrink-0"
        />
        <div className="flex-1 min-w-72">
          {/* The badges go to the next line before the title is cut short */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate min-w-0 max-w-full">
              {book.title}
            </h3>
            {pending && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/40 bg-gold/10 text-gold text-[11px] font-semibold whitespace-nowrap">
                <Clock size={11} /> Chờ duyệt
              </span>
            )}
            {dripStatus && (
              <span
                title={dripStatus === 'running' ? 'Đang đăng nhỏ giọt để nổi trên bảng cập nhật' : 'Chế độ nổi bảng đang dừng'}
                className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
                  dripStatus === 'running'
                    ? 'border-jade/40 bg-jade/10 text-jade'
                    : dripStatus === 'error'
                      ? 'border-crimson/40 bg-crimson/10 text-crimson'
                      : 'border-border-main bg-bg-hover text-text-secondary'
                }`}
              >
                <TrendingUp size={11} /> {dripStatus === 'running' ? 'Nổi bảng' : 'Nổi bảng · dừng'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
            <p className="text-xs text-text-dim">
              {book.author} · {book.category} ·{' '}
              <span className="font-semibold text-text-secondary tabular-nums">{book.total_chapters} chương</span>
            </p>
            <SourceLink book={book} />
          </div>
          {book.latest_chapter_title && (
            <p className="text-xs text-text-dim mt-0.5 truncate">
              Mới nhất: {book.latest_chapter_title}
            </p>
          )}
          {note && <div className="text-xs mt-1">{note}</div>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 ml-auto self-center">
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
          {onMeoTruyen && isFemaleStory(book) && (
            <Tooltip
              content={
                meoLink
                  ? `Đã nạp lên Mèo Truyện (${meoLink.chapters} chương). Bấm để cập nhật: chương mới được thêm, chương trùng số được thay`
                  : 'Nạp truyện và các chương trong folder lên meotruyen.com thành bản nháp (AI chọn thể loại, chủ đề)'
              }
              side="top"
            >
              <button
                type="button"
                onClick={() => onMeoTruyen(book)}
                className={`${ACTION_CLASS} border border-purple/40 bg-purple/10 text-purple hover:bg-purple/20 hover:border-purple/60 focus-visible:ring-purple/60`}
              >
                <Cat size={16} /> Mèo Truyện
                {meoLink && <Check size={14} className="text-jade" aria-label="Đã nạp" />}
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
