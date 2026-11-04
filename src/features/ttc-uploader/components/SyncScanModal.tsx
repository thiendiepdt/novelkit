import { useEffect, useRef, useState } from 'react';
import { ListOrdered, Loader2, RefreshCw, ScanSearch, Upload } from 'lucide-react';
import { useUploadQueueContext } from '@/shared/context/UploadQueueContext';
import type { UploadJob } from '@/shared/context/uploadQueueDefs';
import { useSyncScan, type SyncRow } from '../hooks/useSyncScan';
import type { TtcStory } from '../types';

interface SyncScanModalProps {
  /** Username of the active TTC account; the queued uploads are pinned to it. */
  account?: string | null;
  onClose: () => void;
  /** Open the sync page of a story (to look at the comparison, or pick its folder). */
  onOpenBook: (book: TtcStory) => void;
}

const JOB_BADGE: Record<UploadJob['status'], { label: string; className: string }> = {
  pending: { label: 'Đang chờ', className: 'border-border-main text-text-secondary' },
  uploading: { label: 'Đang up...', className: 'border-gold/40 bg-gold/10 text-gold' },
  done: { label: 'Đã upload', className: 'border-jade/40 bg-jade/10 text-jade' },
  error: { label: 'Lỗi', className: 'border-crimson/40 bg-crimson/10 text-crimson' },
};

type SyncFilter = 'all' | 'new' | 'changed' | 'synced' | 'invalid';

const FILTERS: { value: SyncFilter; label: string; countClass: string }[] = [
  { value: 'all', label: 'Tất cả', countClass: 'text-text-dim' },
  { value: 'new', label: 'Chương mới', countClass: 'text-gold' },
  { value: 'changed', label: 'Chưa đồng bộ', countClass: 'text-crimson/90' },
  { value: 'synced', label: 'Đã đồng bộ', countClass: 'text-jade' },
  { value: 'invalid', label: 'Lỗi', countClass: 'text-crimson/90' },
];

const hasUpload = (row: SyncRow) => row.state.kind === 'new' || row.state.kind === 'changed';
const inFilter = (row: SyncRow, filter: SyncFilter) => filter === 'all' || row.state.kind === filter;

/**
 * "Quét chương mới": every story with a folder, compared with its chapters on TTC. Stories
 * with only new chapters are preselected (append); stories where a chapter on TTC differs
 * from the folder are listed but left for the user to pick (overwrite from the first difference).
 */
export function SyncScanModal({ account, onClose, onOpenBook }: SyncScanModalProps) {
  const { rows, loadingBooks, checking, checkedCount, noFolderCount, error, jobIds, runScan, enqueue } = useSyncScan(account);
  const { jobs } = useUploadQueueContext();
  /** Explicit picks of the user; rows without one follow the default (only new chapters). */
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<SyncFilter>('all');

  useEffect(() => {
    runScan();
  }, [runScan]);

  // Keep the story being scanned in view, until the user scrolls the list themselves.
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const [followActive, setFollowActive] = useState(true);
  const activeId = rows.find(r => r.state.kind === 'checking')?.book.id;
  useEffect(() => {
    if (followActive && activeId !== undefined) activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId, followActive]);

  const jobOf = (row: SyncRow) => {
    const id = jobIds[row.book.id];
    return id ? jobs.find(j => j.id === id) : undefined;
  };
  // A failed upload can be queued again; one that is queued, running or done cannot.
  const selectable = (row: SyncRow) => {
    const job = jobOf(row);
    return hasUpload(row) && (!job || job.status === 'error');
  };
  const isSelected = (row: SyncRow) => selectable(row) && (picked[row.book.id] ?? row.state.kind === 'new');

  // The tabs only change what is shown: picks made in another tab stay and are uploaded too.
  const visibleRows = rows.filter(r => inFilter(r, filter));
  const selectedIds = rows.filter(isSelected).map(r => r.book.id);
  const visibleSelectable = visibleRows.filter(selectable);
  const allSelected = visibleSelectable.length > 0 && visibleSelectable.every(isSelected);
  const counts = Object.fromEntries(FILTERS.map(f => [f.value, rows.filter(r => inFilter(r, f.value)).length])) as Record<
    SyncFilter,
    number
  >;

  const toggleAll = () => {
    setPicked(p => ({ ...p, ...Object.fromEntries(visibleSelectable.map(r => [r.book.id, !allSelected])) }));
  };

  const handleFilter = (value: SyncFilter) => {
    setFilter(value);
    listRef.current?.scrollTo({ top: 0 });
  };

  const handleRescan = () => {
    setPicked({});
    setFollowActive(true);
    listRef.current?.scrollTo({ top: 0 });
    setNotice(null);
    runScan();
  };

  const handleUpload = () => {
    const count = enqueue(selectedIds);
    setNotice(`Đã thêm ${count} truyện vào hàng đợi upload. Các truyện được upload lần lượt, theo dõi tiến độ ở đây hoặc ở hàng đợi trên header.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" style={{ animation: 'overlayIn 0.2s ease-out' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-scan-title"
        className="bg-bg-card border border-border-main rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="px-5 py-4 border-b border-border-main flex items-center gap-2 bg-bg-hover/30 rounded-t-xl">
          <ScanSearch size={18} className="text-gold" />
          <h2 id="sync-scan-title" className="text-lg font-bold text-text-primary">
            Quét chương mới
          </h2>
        </div>

        <div className="px-5 pt-4 pb-3 flex flex-col gap-3 text-sm text-text-secondary">
          <p>
            So sánh folder trong máy của từng truyện với danh sách chương trên TTC. Truyện chỉ có chương mới được chọn sẵn và
            upload nối tiếp. Truyện có chương cũ khác với TTC không được chọn sẵn: nếu chọn, các chương từ chỗ khác đầu tiên đến
            hết folder sẽ được <strong className="text-text-primary">ghi đè</strong>.
          </p>
          {rows.length > 0 && (
            <div role="group" aria-label="Lọc kết quả quét" className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => handleFilter(f.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    filter === f.value
                      ? 'bg-gold/15 border-gold/50 text-gold font-semibold'
                      : 'bg-bg-hover border-border-main text-text-secondary hover:border-border-hover hover:text-text-primary'
                  }`}
                >
                  {f.label}
                  <span className={`tabular-nums font-semibold ${filter === f.value ? '' : f.countClass}`}>{counts[f.value]}</span>
                </button>
              ))}
            </div>
          )}
          {(noFolderCount > 0 || (checking && rows.length > 0)) && (
            <p className="text-xs text-text-dim">
              {checking && rows.length > 0 && `Đang quét ${checkedCount}/${rows.length}...`}
              {checking && rows.length > 0 && noFolderCount > 0 && ' · '}
              {noFolderCount > 0 && `${noFolderCount} truyện chưa chọn folder (bỏ qua)`}
            </p>
          )}
          {checking && rows.length > 0 && (
            <div
              role="progressbar"
              aria-label="Tiến độ quét"
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
          {loadingBooks && <div className="py-8 text-center text-text-dim text-sm">Đang tải danh sách truyện...</div>}
          {!loadingBooks && !error && rows.length === 0 && (
            <div className="py-8 text-center text-text-dim text-sm">
              Chưa có truyện nào được chọn folder. Mở Quản lý chương ở một truyện và chọn folder chương của nó.
            </div>
          )}
          {rows.length > 0 && filter !== 'synced' && filter !== 'invalid' && (
            <label className="flex items-center gap-2 py-2 text-xs text-text-secondary border-b border-border-main cursor-pointer select-none">
              <input type="checkbox" checked={allSelected} disabled={visibleSelectable.length === 0} onChange={toggleAll} className="accent-gold" />
              {filter === 'all' ? 'Chọn tất cả truyện cần upload' : 'Chọn tất cả truyện trong mục này'}
            </label>
          )}
          {rows.length > 0 && visibleRows.length === 0 && (
            <div className="py-8 text-center text-text-dim text-sm">
              {checking ? 'Chưa có truyện nào ở mục này, đang quét tiếp...' : 'Không có truyện nào ở mục này.'}
            </div>
          )}
          <ul className="divide-y divide-border-main">
            {visibleRows.map(row => {
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
                    aria-label={`Upload: ${row.book.title}`}
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
                    <p className="text-xs text-text-dim mt-0.5">{row.book.total_chapters} chương trên TTC</p>
                    {state.kind === 'waiting' && <p className="text-xs text-text-dim mt-0.5">Chờ quét</p>}
                    {active && (
                      <p className="text-xs text-gold mt-0.5 flex items-center gap-1.5">
                        <Loader2 size={12} className="motion-safe:animate-spin" /> Đang đọc folder và danh sách chương trên TTC...
                      </p>
                    )}
                    {state.kind === 'invalid' && (
                      <p className="text-xs text-crimson/90 mt-0.5 break-words" style={{ animation: 'overlayIn 0.3s ease-out' }}>
                        {state.reason}
                      </p>
                    )}
                    {state.kind === 'synced' && (
                      <p className="text-xs text-jade mt-0.5" style={{ animation: 'overlayIn 0.3s ease-out' }}>
                        Đã đồng bộ ({state.localCount} chương trong folder)
                        {state.remoteExtra > 0 && (
                          <span className="text-text-dim"> · TTC có thêm {state.remoteExtra} chương không có trong folder</span>
                        )}
                      </p>
                    )}
                    {state.kind === 'new' && (
                      <p className="text-xs text-gold font-semibold mt-0.5" style={{ animation: 'overlayIn 0.3s ease-out' }}>
                        {state.options.chapters.length} chương mới: chương {state.from}
                        {state.to !== state.from && `–${state.to}`}
                      </p>
                    )}
                    {state.kind === 'changed' && (
                      <div className="mt-0.5" style={{ animation: 'overlayIn 0.3s ease-out' }}>
                        <p className="text-xs text-crimson/90 font-semibold">
                          Khác TTC từ chương {state.fromIndex} · upload sẽ ghi đè chương {state.fromIndex}–{state.toIndex}
                          {state.newCount > 0 && ` (gồm ${state.newCount} chương mới)`}
                        </p>
                        <p className="text-xs text-text-dim break-words">
                          Folder: “{state.firstDiff.local}” · TTC: “{state.firstDiff.remote}”
                        </p>
                      </div>
                    )}
                    {job?.status === 'error' && job.error && <p className="text-xs text-crimson mt-0.5 break-words">{job.error}</p>}
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
            onClick={handleRescan}
            disabled={checking}
            className="text-sm text-text-secondary hover:text-gold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> Quét lại
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
              onClick={handleUpload}
              disabled={selectedIds.length === 0}
              className="px-5 py-2 bg-gold text-bg-primary font-bold text-sm rounded-lg hover:bg-gold/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Upload size={14} /> Upload ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
