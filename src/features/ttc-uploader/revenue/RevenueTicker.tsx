import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Flower2, Loader2 } from 'lucide-react';
import { Tooltip } from '@/shared/components/Tooltip';
import { useRevenue } from './revenueContextDefs';
import { RevenueModal } from './RevenueModal';
import { useCountUp } from './useCountUp';
import { formatHoa } from './format';
import { vnClock } from './vnTime';

interface Chip {
  id: string;
  amount: number;
}

/**
 * Today's revenue of the active TTC account, in the header: the number runs up as the
 * sync reads pages, and each new purchase found later rises as a "+90" chip.
 * Opens the revenue details.
 */
export function RevenueTicker() {
  const { snapshot } = useRevenue();
  const [open, setOpen] = useState(false);
  const hoa = snapshot?.today.hoa ?? 0;
  const shown = useCountUp(hoa);

  // A rise after the first sync is new purchases: show it as a chip (adjusted while rendering).
  const [chips, setChips] = useState<Chip[]>([]);
  const [prev, setPrev] = useState({ hoa, day: snapshot?.todayKey });
  if (prev.hoa !== hoa || prev.day !== snapshot?.todayKey) {
    setPrev({ hoa, day: snapshot?.todayKey });
    if (hoa > prev.hoa && prev.day === snapshot?.todayKey && snapshot?.lastSyncAt) {
      setChips((c) => [...c, { id: `${snapshot.todayKey}-${hoa}`, amount: hoa - prev.hoa }]);
    }
  }

  if (!snapshot) return null;

  const status = snapshot.error
    ? `Lỗi đồng bộ: ${snapshot.error}`
    : snapshot.syncing
      ? 'Đang đọc thông báo mua chương trên TTC...'
      : snapshot.lastSyncAt
        ? `Cập nhật lúc ${vnClock(snapshot.lastSyncAt)}`
        : '';

  return (
    <>
      <Tooltip content={`Doanh thu hôm nay của ${snapshot.account}${status ? ` · ${status}` : ''}`} side="bottom">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Doanh thu hôm nay: ${formatHoa(hoa)} hoa. Mở chi tiết doanh thu`}
          className="relative h-9 pl-2.5 pr-3 rounded-lg border border-gold/30 bg-gold/10 hover:bg-gold/15 hover:border-gold/50 transition-colors cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <Flower2 size={16} className="text-gold flex-shrink-0" />
          <span className="flex items-baseline gap-1.5 whitespace-nowrap" aria-hidden="true">
            <span className="text-xs text-text-secondary">Hôm nay</span>
            <span className="text-base font-bold text-gold tabular-nums">{formatHoa(shown)}</span>
            <span className="text-xs font-medium text-gold/70">hoa</span>
          </span>
          {snapshot.error ? (
            <AlertTriangle size={13} className="text-crimson flex-shrink-0" />
          ) : (
            snapshot.syncing && <Loader2 size={13} className="text-gold/70 motion-safe:animate-spin flex-shrink-0" />
          )}
          {chips.map((chip) => (
            <span
              key={chip.id}
              aria-hidden="true"
              onAnimationEnd={() => setChips((c) => c.filter((x) => x.id !== chip.id))}
              className="pointer-events-none absolute left-1/2 top-1/3 px-1.5 rounded-full bg-jade/90 text-bg-primary text-[11px] font-bold tabular-nums whitespace-nowrap"
              style={{ animation: 'floatUp 1.6s ease-out forwards' }}
            >
              +{formatHoa(chip.amount)}
            </span>
          ))}
        </button>
      </Tooltip>
      {/* To the body: the backdrop-filter of the header would make it the box of fixed children */}
      {open && createPortal(<RevenueModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
