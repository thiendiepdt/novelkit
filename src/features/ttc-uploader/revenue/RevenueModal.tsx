import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Flower2, RefreshCw, X } from 'lucide-react';
import { HourChart } from './HourChart';
import { useRevenue } from './revenueContextDefs';
import { dayCoverage, type DayStats } from './ledger';
import { formatHoa } from './format';
import { addDays, DAY_MS, shortDate, vnClock, vnDayStart, vnHour } from './vnTime';

interface RevenueModalProps {
  onClose: () => void;
}

const WEEK = 7;
/** Stories shown before "Xem thêm": a busy day can have dozens. */
const TOP_STORIES = 10;
const EMPTY_HOURS: number[] = Array(24).fill(0);

/** The missing parts of a day, as "00:00–16:03" (24:00 for the end of the day). */
function describeMissing(spans: { from: number; to: number }[], dayStart: number): string {
  return spans
    .map((s) => `${vnClock(s.from)}–${s.to - dayStart >= DAY_MS ? '24:00' : vnClock(s.to)}`)
    .join(', ');
}

/**
 * Revenue of the active account by day: total (sales and gifts) with its parts, hours,
 * the top stories, and the last 7 days to jump between. The height is fixed, so changing
 * day moves nothing. Says plainly when a day is not fully counted.
 */
export function RevenueModal({ onClose }: RevenueModalProps) {
  const { engine, snapshot } = useRevenue();
  const todayKey = snapshot?.todayKey ?? '';
  const [picked, setPicked] = useState<string | null>(null);
  const dayKey = picked ?? todayKey;
  const isToday = dayKey === todayKey;

  // Days other than today come from the files: loaded per selection.
  const [loaded, setLoaded] = useState<{ key: string; stats: DayStats | null } | null>(null);
  const [week, setWeek] = useState<{ key: string; stats: (DayStats | null)[] } | null>(null);
  const dataVersion = snapshot?.lastSyncAt;

  useEffect(() => {
    if (!engine || isToday) return;
    let cancelled = false;
    engine.loadDay(dayKey).then((stats) => !cancelled && setLoaded({ key: dayKey, stats })).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [engine, dayKey, isToday, dataVersion]);

  useEffect(() => {
    if (!engine || !todayKey) return;
    let cancelled = false;
    const keys = Array.from({ length: WEEK }, (_, i) => addDays(todayKey, i - (WEEK - 1)));
    Promise.all(keys.map((k) => engine.loadDay(k)))
      .then((stats) => !cancelled && setWeek({ key: todayKey, stats }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [engine, todayKey, dataVersion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Days of the loaded months are at hand: changing day shows them at once, without a blank frame.
  const stats: DayStats | null | undefined = isToday
    ? snapshot?.today
    : (snapshot?.days[dayKey] ?? (loaded?.key === dayKey ? loaded.stats : undefined));
  const loading = stats === undefined;

  const { missing, nothing } = useMemo(
    () => (snapshot ? dayCoverage(snapshot.covered, dayKey, isToday) : { missing: [], nothing: false }),
    [snapshot, dayKey, isToday],
  );

  const stories = useMemo(
    () => (stats ? Object.entries(stats.stories).sort((a, b) => b[1].hoa - a[1].hoa) : []),
    [stats],
  );
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const expanded = expandedDay === dayKey;
  const shownStories = expanded ? stories : stories.slice(0, TOP_STORIES);
  const hiddenStories = stories.slice(TOP_STORIES);
  const weekKeys = Array.from({ length: WEEK }, (_, i) => addDays(todayKey, i - (WEEK - 1)));
  const weekStats = week?.key === todayKey ? week.stats.map((s, i) => (weekKeys[i] === todayKey ? snapshot?.today ?? s : s)) : [];
  const weekMax = Math.max(1, ...weekStats.map((s) => s?.hoa ?? 0));
  // The hour of the last sync is the current one (as far as the data goes).
  const nowHour = snapshot?.lastSyncAt ? vnHour(snapshot.lastSyncAt) : -1;

  if (!snapshot || !engine) return null;

  const hoaText = (hoa: number) => `${formatHoa(hoa)} hoa`;
  const singleHoa = stats ? stats.hoa - stats.bulk.hoa - stats.gifts.hoa : 0;
  const cards = [
    { label: 'Tổng hoa', value: stats ? formatHoa(stats.hoa) : '–', detail: stats ? `${formatHoa(stats.count)} lượt mua` : '', accent: true },
    { label: 'Mua lẻ', value: stats ? formatHoa(stats.count - stats.bulk.count) : '–', detail: stats ? hoaText(singleHoa) : '' },
    { label: 'Mua combo', value: stats ? formatHoa(stats.bulk.count) : '–', detail: stats ? hoaText(stats.bulk.hoa) : '' },
    { label: 'Quà tặng', value: stats ? formatHoa(stats.gifts.count) : '–', detail: stats ? hoaText(stats.gifts.hoa) : '' },
    { label: 'Truyện', value: stats ? formatHoa(stories.length) : '–', detail: 'có doanh thu' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" style={{ animation: 'overlayIn 0.2s ease-out' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revenue-title"
        className="bg-bg-card border border-border-main rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="px-5 py-4 border-b border-border-main flex items-center gap-2 bg-bg-hover/30 rounded-t-xl">
          <Flower2 size={18} className="text-gold" />
          <h2 id="revenue-title" className="text-lg font-bold text-text-primary">
            Doanh thu
          </h2>
          <span className="text-sm text-text-dim">@{snapshot.account}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="ml-auto text-text-dim hover:text-crimson transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-bg-hover cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pinned: the way to change day stays in place while the content below scrolls */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3 flex flex-col gap-3 border-b border-border-main">
          {/* 7 ngày gần nhất */}
          <div role="group" aria-label="7 ngày gần nhất" className="grid grid-cols-7 gap-1.5">
            {weekKeys.map((key, i) => {
              const s = weekStats[i];
              const active = key === dayKey;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPicked(key === todayKey ? null : key)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 pt-2 pb-1.5 transition-colors cursor-pointer ${
                    active ? 'border-gold/60 bg-gold/10' : 'border-border-main bg-bg-hover/40 hover:border-border-hover'
                  }`}
                >
                  <span className="h-10 w-full flex items-end justify-center">
                    <span
                      className={`w-3 rounded-t ${active ? 'bg-gold' : 'bg-gold/40'}`}
                      style={{ height: `${Math.max(4, ((s?.hoa ?? 0) / weekMax) * 100)}%` }}
                    />
                  </span>
                  <span className={`text-[11px] ${active ? 'text-gold font-semibold' : 'text-text-dim'}`}>
                    {key === todayKey ? 'Hôm nay' : shortDate(key)}
                  </span>
                  <span className="text-[11px] tabular-nums text-text-secondary">{s ? formatHoa(s.hoa) : '–'}</span>
                </button>
              );
            })}
          </div>

          {/* Chọn ngày */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPicked(addDays(dayKey, -1))}
              aria-label="Ngày trước"
              className="h-9 w-9 rounded-lg border border-border-main bg-bg-hover hover:border-border-hover text-text-secondary flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={dayKey}
              max={todayKey}
              onChange={(e) => e.target.value && setPicked(e.target.value >= todayKey ? null : e.target.value)}
              aria-label="Chọn ngày"
              className="h-9 px-3 bg-bg-hover border border-border-main rounded-lg text-sm text-text-primary focus:outline-none focus:border-gold/50 [color-scheme:dark]"
            />
            <button
              type="button"
              onClick={() => {
                const next = addDays(dayKey, 1);
                setPicked(next >= todayKey ? null : next);
              }}
              disabled={isToday}
              aria-label="Ngày sau"
              className="h-9 w-9 rounded-lg border border-border-main bg-bg-hover hover:border-border-hover text-text-secondary flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              <ChevronRight size={16} />
            </button>
            {!isToday && (
              <button type="button" onClick={() => setPicked(null)} className="text-sm text-gold hover:underline cursor-pointer">
                Hôm nay
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] p-5 flex flex-col gap-5">
          {/* Độ đầy đủ của dữ liệu: two lines reserved, so the content does not jump between days */}
          <div className="min-h-8 -mb-2">
          {!loading &&
            (missing.length === 0 ? (
              <p className="text-xs text-jade flex items-center gap-1.5">
                <Check size={13} />
                {isToday
                  ? `Đủ dữ liệu từ 00:00${snapshot.lastSyncAt ? ` đến ${vnClock(snapshot.lastSyncAt)}` : ''}`
                  : 'Đủ dữ liệu cả ngày'}
              </p>
            ) : nothing ? (
              <p role="status" className="text-xs text-text-dim flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-gold" />
                Chưa có dữ liệu ngày này. TTC chỉ giữ khoảng 7 ngày thông báo gần nhất, ngày cũ hơn chỉ có nếu app đã đồng bộ kịp.
              </p>
            ) : (
              <p role="status" className="text-xs text-gold flex items-center gap-1.5">
                <AlertTriangle size={13} />
                Thiếu dữ liệu {describeMissing(missing, vnDayStart(dayKey))}. Phần còn trên TTC được bù ở lần đồng bộ sau;
                phần đã cũ hơn khoảng 7 ngày thì không lấy lại được.
              </p>
            ))}
          </div>

          {/* Tổng */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cards.map((card) => (
              <div key={card.label} className="rounded-lg border border-border-main bg-bg-hover/40 p-3 min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-text-dim truncate">{card.label}</div>
                <div className={`text-xl font-bold tabular-nums mt-1 ${card.accent ? 'text-gold' : 'text-text-primary'}`}>{card.value}</div>
                <div className="text-xs text-text-dim tabular-nums mt-0.5 truncate">{card.detail}</div>
              </div>
            ))}
          </div>

          {/* Theo giờ */}
          <HourChart hours={stats?.hours ?? EMPTY_HOURS} currentHour={isToday ? nowHour : -1} />

          {/* Theo truyện */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-text-dim mb-2">Theo truyện</h3>
            {stories.length === 0 ? (
              <p className="text-sm text-text-dim py-4 text-center">{loading ? '' : 'Không có doanh thu.'}</p>
            ) : (
              <ul className="divide-y divide-border-main">
                {shownStories.map(([id, s]) => (
                  <li key={id} className="py-2 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{s.title}</div>
                      <div className="mt-1 h-1 rounded-full bg-bg-hover overflow-hidden">
                        <div className="h-full bg-gold/60 rounded-full" style={{ width: `${(s.hoa / (stats?.hoa || 1)) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-text-dim tabular-nums whitespace-nowrap">{s.count ? `${formatHoa(s.count)} lượt` : 'Quà tặng'}</span>
                    <span className="text-sm font-semibold text-text-primary tabular-nums whitespace-nowrap w-28 text-right">
                      {formatHoa(s.hoa)} hoa
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {hiddenStories.length > 0 && (
              <button
                type="button"
                onClick={() => setExpandedDay(expanded ? null : dayKey)}
                aria-expanded={expanded}
                className="mt-2 w-full h-9 rounded-lg border border-border-main bg-bg-hover/40 hover:border-border-hover text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                {expanded
                  ? 'Thu gọn'
                  : `Xem thêm ${hiddenStories.length} truyện · ${formatHoa(hiddenStories.reduce((sum, [, s]) => sum + s.hoa, 0))} hoa`}
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border-main flex items-center justify-between gap-3 bg-bg-hover/50 rounded-b-xl text-xs text-text-dim">
          <span className="min-w-0 break-words">
            {snapshot.error ? (
              <span className="text-crimson">Lỗi đồng bộ: {snapshot.error}</span>
            ) : snapshot.syncing ? (
              'Đang đọc thông báo mua chương trên TTC...'
            ) : snapshot.lastSyncAt ? (
              `Đồng bộ lúc ${vnClock(snapshot.lastSyncAt)} · tự cập nhật mỗi 2 phút`
            ) : (
              ''
            )}
          </span>
          <button
            type="button"
            onClick={() => void engine.refresh()}
            disabled={snapshot.syncing}
            className="text-sm text-text-secondary hover:text-gold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw size={14} className={snapshot.syncing ? 'motion-safe:animate-spin' : ''} /> Làm mới
          </button>
        </div>
      </div>
    </div>
  );
}
