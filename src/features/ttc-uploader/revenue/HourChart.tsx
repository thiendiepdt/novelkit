import { Tooltip } from '@/shared/components/Tooltip';
import { formatHoa, niceTicks } from './format';

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

interface HourChartProps {
  /** Hoa per hour, 24 entries. */
  hours: number[];
  /** The hour still running (brighter), or -1. */
  currentHour: number;
}

/**
 * Hoa per hour: one series, so one color, on a value axis with recessive grid lines. The
 * peak is named in the heading, so the chart can be read without hovering.
 */
export function HourChart({ hours, currentHour }: HourChartProps) {
  const ticks = niceTicks(Math.max(...hours));
  const top = ticks[ticks.length - 1] || 1;
  const peak = hours.indexOf(Math.max(...hours));
  const peakText = hours[peak] > 0 ? `Cao nhất ${hourLabel(peak)}–${hourLabel(peak + 1)}: ${formatHoa(hours[peak])} hoa` : 'Không có doanh thu';
  const at = (value: number) => `${(value / top) * 100}%`;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-3">
        <h3 className="text-xs uppercase tracking-wider text-text-dim">Theo giờ</h3>
        <span className="text-xs text-text-secondary tabular-nums">{peakText}</span>
      </div>
      <div className="flex gap-2" role="img" aria-label={`Doanh thu theo giờ. ${peakText}`}>
        <div className="relative w-12 h-36 flex-shrink-0">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 text-[10px] leading-none text-text-dim tabular-nums"
              style={{ bottom: at(t) }}
            >
              {formatHoa(t)}
            </span>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-36">
            {ticks.map((t) => (
              <div
                key={t}
                className={`absolute inset-x-0 border-t ${t === 0 ? 'border-border-hover' : 'border-border-main/60'}`}
                style={{ bottom: at(t) }}
              />
            ))}
            <div className="relative h-full flex items-end gap-0.5">
              {hours.map((value, h) => (
                // The whole column reacts to the mouse; the tooltip sits on top of the bar.
                <Tooltip
                  key={h}
                  delay={0}
                  className="group flex-1 min-w-0 h-full flex-col justify-end hover:bg-gold/5 rounded-t"
                  content={
                    <span className="flex flex-col items-center gap-0.5 whitespace-nowrap">
                      <span className="text-[11px] text-text-dim tabular-nums">
                        {hourLabel(h)}–{hourLabel(h + 1)}
                      </span>
                      <span className="text-sm font-bold text-text-primary tabular-nums">{formatHoa(value)} hoa</span>
                    </span>
                  }
                >
                  <div
                    className={`rounded-t transition-colors group-hover:bg-gold ${h === currentHour ? 'bg-gold' : 'bg-gold/65'}`}
                    style={{ height: value ? `max(2px, ${at(value)})` : 0 }}
                  />
                </Tooltip>
              ))}
            </div>
          </div>
          <div className="flex gap-0.5 mt-1.5">
            {hours.map((_, h) => (
              <span key={h} className="flex-1 min-w-0 text-center text-[10px] text-text-dim tabular-nums">
                {h % 3 === 0 ? h : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
