import { useEffect, useRef, useState } from 'react';
import { Hourglass, ListOrdered, Loader2, RefreshCw, Upload } from 'lucide-react';
import { useUploadQueueContext } from '@/shared/context/UploadQueueContext';
import { usePersistentState } from '@/shared/hooks/usePersistentState';
import type { UploadJob } from '@/shared/context/uploadQueueDefs';
import { useAbandonCheck, type AbandonRow } from '../hooks/useAbandonCheck';
import { ABANDON_DAYS, DEFAULT_REUP_FROM_DAYS, abandonRisk, type AbandonRisk } from '../utils/abandon';
import type { TtcStory } from '../types';

interface AbandonCheckModalProps {
  /** Username of the active TTC account; the queued re-uploads are pinned to it. */
  account?: string | null;
  onClose: () => void;
  /** Open the sync page of a story (e.g. to pick its folder). */
  onOpenBook: (book: TtcStory) => void;
}

const RISK_CLASS: Record<AbandonRisk, string> = {
  overdue: 'text-crimson font-semibold',
  soon: 'text-gold font-semibold',
  safe: 'text-jade',
  unknown: 'text-text-dim',
};

function describeDays(days: number | null): string {
  if (days === null) return 'Chưa rõ ngày cập nhật';
  const since = days === 0 ? 'Cập nhật hôm nay' : `Cập nhật ${days} ngày trước`;
  const left = ABANDON_DAYS - days;
  return left > 0 ? `${since} · còn ${left} ngày` : `${since} · đã quá hạn`;
}

const JOB_BADGE: Record<UploadJob['status'], { label: string; className: string }> = {
  pending: { label: 'Đang chờ', className: 'border-border-main text-text-secondary' },
  uploading: { label: 'Đang up...', className: 'border-gold/40 bg-gold/10 text-gold' },
  done: { label: 'Đã reup', className: 'border-jade/40 bg-jade/10 text-jade' },
  error: { label: 'Lỗi', className: 'border-crimson/40 bg-crimson/10 text-crimson' },
};

/**
 * "Check vô hố": every ongoing story with the days since its last chapter. Stories whose
 * folder yields chapter 1 can be re-uploaded in one go, which resets the date on TTC.
 */
export function AbandonCheckModal({ account, onClose, onOpenBook }: AbandonCheckModalProps) {
  const { rows, loadingBooks, checking, checkedCount, error, jobIds, runCheck, enqueueReup } = useAbandonCheck(account);
  const { jobs } = useUploadQueueContext();
  /** Explicit picks of the user; rows without one follow the default (ready, no warning, due for a reup). */
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [reupFromDays, setReupFromDays] = usePersistentState('nk_ttc_reup_from_days', DEFAULT_REUP_FROM_DAYS);
  const isDue = (row: AbandonRow) => row.days === null || row.days >= reupFromDays;
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  // Keep the story being checked in view, until the user scrolls the list themselves.
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const [followActive, setFollowActive] = useState(true);
  const activeId = rows.find(r => r.state.kind === 'checking')?.book.id;
  useEffect(() => {
    if (followActive && activeId !== undefined) activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId, followActive]);

  const jobOf = (row: AbandonRow) => {
    const id = jobIds[row.book.id];
    return id ? jobs.find(j => j.id === id) : undefined;
  };
  // A failed reup can be queued again; one that is queued, running or done cannot.
  const selectable = (row: AbandonRow) => {
    const job = jobOf(row);
    return row.state.kind === 'ready' && (!job || job.status === 'error');
  };
  const isSelected = (row: AbandonRow) =>
    selectable(row) && (picked[row.book.id] ?? (row.state.kind === 'ready' && !row.state.warning && isDue(row)));

  const selectableRows = rows.filter(selectable);
  const selectedIds = rows.filter(isSelected).map(r => r.book.id);
  const allSelected = selectableRows.length > 0 && selectedIds.length === selectableRows.length;
  const due = rows.filter(isDue).length;
  const invalid = rows.filter(r => r.state.kind === 'invalid').length;

  const toggleAll = () => {
    setPicked(Object.fromEntries(selectableRows.map(r => [r.book.id, !allSelected])));
  };

  const handleRecheck = () => {
    setPicked({});
    setFollowActive(true);
    listRef.current?.scrollTo({ top: 0 });
    setNotice(null);
    runCheck();
  };

  const handleReup = () => {
    const count = enqueueReup(selectedIds);
    setNotice(`Đã thêm ${count} truyện vào hàng đợi upload. Các truyện được reup lần lượt, theo dõi tiến độ ở đây hoặc ở hàng đợi trên header.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" style={{ animation: 'overlayIn 0.2s ease-out' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="abandon-check-title"
        className="bg-bg-card border border-border-main rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="px-5 py-4 border-b border-border-main flex items-center gap-2 bg-bg-hover/30 rounded-t-xl">
          <Hourglass size={18} className="text-gold" />
          <h2 id="abandon-check-title" className="text-lg font-bold text-text-primary">
            Check vô hố
          </h2>
        </div>

        <div className="px-5 pt-4 pb-3 flex flex-col gap-3 text-sm text-text-secondary">
          <p>
            Truyện <strong className="text-text-primary">Đang ra</strong> quá {ABANDON_DAYS} ngày không có chương mới sẽ bị vô hố.
            Reup chương 1 từ folder trong máy sẽ làm mới ngày cập nhật.
          </p>
          <label className="flex items-center gap-2 text-xs">
            Chọn sẵn truyện từ
            <input
              type="number"
              min={0}
              max={ABANDON_DAYS}
              value={reupFromDays}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                setReupFromDays(Number.isNaN(v) ? 0 : Math.min(ABANDON_DAYS, Math.max(0, v)));
                setPicked({});
              }}
              className="w-14 px-2 py-1 bg-bg-primary border border-border-main rounded text-text-primary text-center focus:outline-none focus:border-gold/50"
            />
            ngày không có chương mới trở lên
          </label>
          {rows.length > 0 && (
            <p className="text-xs text-text-dim">
              {rows.length} truyện đang ra · <span className="text-gold">{due} cần reup</span>
              {' '}· {invalid} không reup được
              {checking && ` · đang kiểm tra ${checkedCount}/${rows.length}...`}
            </p>
          )}
          {checking && rows.length > 0 && (
            <div
              role="progressbar"
              aria-label="Tiến độ kiểm tra"
              aria-valuemin={0}
              aria-valuemax={rows.length}
              aria-valuenow={checkedCount}
              className="h-1 rounded-full bg-bg-hover overflow-hidden"
            >
              <div
                className="h-full bg-gold rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${(checkedCount / rows.length) * 100}%` }}
              />
            </div>
          )}
          {error && (
            <div role="alert" className="p-3 bg-crimson/10 border border-crimson/30 rounded-lg text-crimson break-words">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="p-3 bg-jade/10 border border-jade/30 rounded-lg text-jade">
              {notice}
            </div>
          )}
        </div>

        <div
          ref={listRef}
          onWheel={() => setFollowActive(false)}
          onTouchMove={() => setFollowActive(false)}
          className="flex-1 min-h-0 overflow-y-auto px-5"
        >
          {loadingBooks && (
            <div className="py-8 text-center text-text-dim text-sm">Đang tải danh sách truyện đang ra...</div>
          )}
          {!loadingBooks && !error && rows.length === 0 && (
            <div className="py-8 text-center text-text-dim text-sm">Không có truyện nào đang ra.</div>
          )}
          {rows.length > 0 && (
            <label className="flex items-center gap-2 py-2 text-xs text-text-secondary border-b border-border-main cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={selectableRows.length === 0}
                onChange={toggleAll}
                className="accent-gold"
              />
              Chọn tất cả truyện reup được
            </label>
          )}
          <ul className="divide-y divide-border-main">
            {rows.map(row => {
              const job = jobOf(row);
              const { state } = row;
              const active = state.kind === 'checking';
              return (
                <li
                  key={row.book.id}
                  ref={active ? activeRef : undefined}
                  aria-busy={active}
                  className={`py-2.5 -mx-2 px-2 flex items-start gap-3 rounded-lg transition-colors duration-300 ${
                    active ? 'bg-gold/10 shadow-[inset_2px_0_0_var(--color-gold)]' : ''
                  } ${state.kind === 'waiting' ? 'opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Reup chương 1: ${row.book.title}`}
                    checked={isSelected(row)}
                    disabled={!selectable(row)}
                    onChange={e => setPicked(p => ({ ...p, [row.book.id]: e.target.checked }))}
                    className="accent-gold mt-1 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenBook(row.book)}
                      title="Mở trang quản lý chương của truyện"
                      className="block max-w-full text-left text-sm font-medium text-text-primary hover:text-gold transition-colors cursor-pointer truncate"
                    >
                      {row.book.title}
                    </button>
                    <p className={`text-xs mt-0.5 ${RISK_CLASS[abandonRisk(row.days, reupFromDays)]}`}>{describeDays(row.days)}</p>
                    {state.kind === 'waiting' && <p className="text-xs text-text-dim mt-0.5">Chờ kiểm tra</p>}
                    {active && (
                      <p className="text-xs text-gold mt-0.5 flex items-center gap-1.5">
                        <Loader2 size={12} className="motion-safe:animate-spin" /> Đang kiểm tra folder và chương 1 trên web...
                      </p>
                    )}
                    {state.kind === 'invalid' && (
                      <p className="text-xs text-crimson/90 mt-0.5 break-words" style={{ animation: 'overlayIn 0.3s ease-out' }}>{state.reason}</p>
                    )}
                    {state.kind === 'ready' && (
                      <p className="text-xs text-text-dim mt-0.5 truncate" style={{ animation: 'overlayIn 0.3s ease-out' }}>
                        Reup: {state.chapter.title} ({state.chapter.word_count} chữ{state.chapter.price ? `, ${state.chapter.price} xu` : ''})
                      </p>
                    )}
                    {state.kind === 'ready' && state.warning && (
                      <p className="text-xs text-gold mt-0.5 break-words">⚠ {state.warning}</p>
                    )}
                    {job?.status === 'error' && job.error && (
                      <p className="text-xs text-crimson mt-0.5 break-words">{job.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {job && (
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${JOB_BADGE[job.status].className}`}>
                        {JOB_BADGE[job.status].label}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenBook(row.book)}
                      title="Mở trang quản lý chương của truyện"
                      className="px-2.5 py-1 bg-gold/15 text-gold text-xs font-medium rounded-lg hover:bg-gold/25 transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <ListOrdered size={12} /> Quản lý chương
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="px-5 py-4 border-t border-border-main flex flex-wrap items-center justify-between gap-3 bg-bg-hover/50 rounded-b-xl">
          <button
            type="button"
            onClick={handleRecheck}
            disabled={checking}
            className="text-sm text-text-secondary hover:text-gold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> Kiểm tra lại
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleReup}
              disabled={selectedIds.length === 0}
              className="px-5 py-2 bg-gold text-bg-primary font-bold text-sm rounded-lg hover:bg-gold/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Upload size={14} /> Reup chương 1 ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
