import { useDrip } from '../drip';
import { MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from '../drip/dripEngine';
import { formatInterval } from '../drip/format';

/**
 * The drip interval, shared by every story: "cứ [5] phút đăng 1 chương". Applied on blur or
 * Enter, and at once: the next turn is recomputed with it.
 */
export function DripIntervalInput({ className = '' }: { className?: string }) {
  const { engine, snapshot } = useDrip();
  if (!engine || !snapshot) return null;
  const interval = snapshot.intervalMinutes;

  return (
    <label className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${className}`}>
      Cứ
      <input
        type="number"
        min={MIN_INTERVAL_MINUTES}
        max={MAX_INTERVAL_MINUTES}
        step={0.5}
        // Remount on outside changes (the other input, a clamp) so the box shows the saved value.
        key={interval}
        defaultValue={interval}
        aria-label="Số phút giữa hai lần đăng, chung cho mọi truyện"
        onBlur={(e) => {
          const value = Number(e.target.value);
          if (value !== interval) engine.setIntervalMinutes(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-16 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center focus:outline-none focus:border-gold/50"
      />
      phút đăng 1 chương{interval < 1 && <span className="text-text-dim">({formatInterval(interval)})</span>}
    </label>
  );
}
