import { Loader2 } from 'lucide-react';
import { Pagination, Tooltip } from '@/shared/components';
import { BOOK_TABS, type BookTab } from '../utils/bookFilters';

interface BookListFiltersProps {
  tab: BookTab;
  counts: Record<BookTab, number>;
  onTabChange: (tab: BookTab) => void;
  /** Folder reading of the "Chưa đồng bộ" tab. */
  unsynced: { checking: boolean; done: number; total: number };
  sourceOptions: { name: string; count: number }[];
  /** Picked sources; empty = all. */
  sources: string[];
  onToggleSource: (name: string) => void;
  onClearSources: () => void;
  currentPage: number;
  totalPages: number;
  booksLimit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  disabled: boolean;
}

const CHIP = 'px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5';
const CHIP_ON = 'bg-gold/15 border-gold/50 text-gold font-semibold';
const CHIP_OFF = 'bg-bg-hover border-border-main text-text-secondary hover:border-border-hover hover:text-text-primary';

/** Tabs of the book list, the source filter (several at once) and the pages. */
export function BookListFilters({
  tab,
  counts,
  onTabChange,
  unsynced,
  sourceOptions,
  sources,
  onToggleSource,
  onClearSources,
  currentPage,
  totalPages,
  booksLimit,
  onPageChange,
  onLimitChange,
  disabled,
}: BookListFiltersProps) {
  // "Chưa đồng bộ" has a count only once its folders have been read.
  const unsyncedKnown = unsynced.done > 0 || (tab === 'unsynced' && !unsynced.checking);

  return (
    <div className="flex-shrink-0 flex flex-col gap-3 mb-3">
      <div role="group" aria-label="Xem theo" className="flex flex-wrap gap-x-1 border-b border-border-main">
        {BOOK_TABS.map((t) => {
          const active = tab === t.value;
          const showCount = t.value !== 'unsynced' || unsyncedKnown;
          return (
            <Tooltip key={t.value} content={t.hint} side="top">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onTabChange(t.value)}
                className={`-mb-px px-3 py-2 text-sm border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  active ? 'border-gold text-gold font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.label}
                {showCount && (
                  <span
                    className={`px-1.5 min-w-5 text-center rounded-full text-[11px] font-semibold tabular-nums ${
                      active ? 'bg-gold/15 text-gold' : 'bg-white/[0.07] text-text-secondary'
                    }`}
                  >
                    {counts[t.value]}
                  </span>
                )}
                {t.value === 'unsynced' && unsynced.checking && <Loader2 size={12} className="motion-safe:animate-spin" />}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {tab === 'unsynced' && unsynced.checking && (
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span className="whitespace-nowrap">
            Đang đọc folder {unsynced.done}/{unsynced.total} truyện...
          </span>
          <div
            role="progressbar"
            aria-label="Tiến độ đọc folder"
            aria-valuemin={0}
            aria-valuemax={unsynced.total}
            aria-valuenow={unsynced.done}
            className="h-1 flex-1 max-w-xs rounded-full bg-bg-hover overflow-hidden"
          >
            <div
              className="h-full bg-gold rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${unsynced.total ? (unsynced.done / unsynced.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Lọc theo nguồn" className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-text-dim mr-0.5">Nguồn:</span>
          <button type="button" aria-pressed={sources.length === 0} onClick={onClearSources} className={`${CHIP} ${sources.length === 0 ? CHIP_ON : CHIP_OFF}`}>
            Tất cả
          </button>
          {sourceOptions.map((s) => {
            const on = sources.includes(s.name);
            // None in this tab: nothing to pick (a picked one stays clickable, to unpick it).
            const empty = s.count === 0 && !on;
            return (
              <button
                key={s.name}
                type="button"
                aria-pressed={on}
                disabled={empty}
                onClick={() => onToggleSource(s.name)}
                className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF} disabled:opacity-40 disabled:cursor-default disabled:hover:border-border-main disabled:hover:text-text-secondary`}
              >
                {s.name}
                <span className={`tabular-nums ${on ? '' : 'text-text-dim'}`}>{s.count}</span>
              </button>
            );
          })}
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          disabled={disabled}
          limit={booksLimit}
          onLimitChange={onLimitChange}
        />
      </div>
    </div>
  );
}
