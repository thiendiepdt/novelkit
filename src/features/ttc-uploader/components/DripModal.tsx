import { useEffect, useState } from 'react';
import { History, ListOrdered, Loader2, Pause, Play, TrendingUp, X } from 'lucide-react';
import { useDrip } from '../drip';
import type { DripPlan } from '../drip/dripEngine';
import {
  DRIP_STATUS_CLASS,
  DRIP_STATUS_LABEL,
  describePlan,
  dripTotals,
  formatClock,
  formatDuration,
  planProgress,
  remainingDrips,
} from '../drip/format';
import { DripIntervalInput } from './DripIntervalInput';
import { DripProgressBar } from './DripProgressBar';

interface DripModalProps {
  /** Username of the active account: only its stories can be opened from here. */
  account: string;
  onClose: () => void;
  onOpenBook: (bookId: number) => void;
}

const STATUS_ORDER: Record<DripPlan['status'], number> = { running: 0, error: 1, paused: 2 };

/**
 * Every "Nổi trên bảng cập nhật" plan (all accounts) and the interval they share: overall
 * progress and an estimate of the time left, what is being posted now, when the next turn
 * comes, the upload history, and pause / resume / stop per story or for all.
 */
export function DripModal({ account, onClose, onOpenBook }: DripModalProps) {
  const { engine, snapshot } = useDrip();
  const [tab, setTab] = useState<'plans' | 'history'>('plans');
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The "next turn" countdown.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  if (!engine || !snapshot) return null;

  const plans = [...snapshot.plans].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.lastPostAt ?? 0) - (b.lastPostAt ?? 0),
  );
  const running = plans.filter(p => p.status === 'running');
  const interval = snapshot.intervalMinutes;
  const totals = dripTotals(plans, interval);
  const secondsLeft = Math.ceil((snapshot.nextPostAt - now) / 1000);
  const dripping = running.filter(p => remainingDrips(p) > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" style={{ animation: 'overlayIn 0.2s ease-out' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drip-title"
        className="bg-bg-card border border-border-main rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="px-5 py-4 border-b border-border-main flex items-center gap-2 bg-bg-hover/30 rounded-t-xl">
          <TrendingUp size={18} className="text-gold" />
          <h2 id="drip-title" className="text-lg font-bold text-text-primary">
            Nổi trên bảng cập nhật
          </h2>
          <button onClick={onClose} aria-label="Đóng" className="ml-auto text-text-dim hover:text-text-primary cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-3 flex flex-col gap-3 text-sm text-text-secondary">
          <p className="text-xs">
            Mỗi truyện đăng một đợt đầu, sau đó đến lượt thì đăng 1 chương, lần lượt từng truyện (truyện lâu chưa được
            đẩy nhất đi trước). Chương cũ bị sửa được đồng bộ lại trước khi đăng tiếp. Bật cho từng truyện trong{' '}
            <strong className="text-text-primary">Quản lý chương</strong> → Cách đăng. Chỉ chạy khi NovelKit đang mở.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <DripIntervalInput />
            {dripping > 1 && (
              <span className="text-xs text-text-dim">
                → mỗi truyện được đẩy lên khoảng {formatDuration(dripping * interval)} một lần
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => engine.pauseAll()}
                disabled={running.length === 0}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-hover border border-border-main text-text-primary hover:border-gold/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Pause size={13} /> Tạm dừng tất cả
              </button>
              <button
                type="button"
                onClick={() => engine.resumeAll()}
                disabled={running.length === plans.length}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gold text-bg-primary hover:bg-gold/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Play size={13} /> Tiếp tục tất cả
              </button>
            </div>
          </div>

          {/* Overall progress */}
          {plans.length > 0 && (
            <div className="bg-bg-hover/40 border border-border-main rounded-lg p-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
                <span className="text-text-primary font-medium">
                  {totals.posted.toLocaleString('vi-VN')}/{totals.total.toLocaleString('vi-VN')} chương đã lên TTC
                  {totals.unknown > 0 && <span className="text-text-dim font-normal"> (chưa tính {totals.unknown} truyện chưa kiểm tra)</span>}
                </span>
                <span className="text-text-secondary">
                  {totals.remaining > 0
                    ? `Còn ${totals.remaining.toLocaleString('vi-VN')} chương nhỏ giọt ≈ ${formatDuration(totals.etaMinutes)} với nhịp hiện tại`
                    : running.length > 0
                      ? 'Đã đăng hết chương trong các folder'
                      : 'Không có truyện nào đang chạy'}
                </span>
              </div>
              <DripProgressBar posted={totals.posted} total={totals.total} />
              {running.length > 0 && (
                <p className="text-xs" role="status">
                  {snapshot.activity ? (
                    <span className="text-gold flex items-center gap-1.5">
                      <Loader2 size={12} className="motion-safe:animate-spin" /> {snapshot.activity.text}
                    </span>
                  ) : secondsLeft > 0 ? (
                    <span className="text-text-secondary">
                      Lượt nhỏ giọt tới: {formatClock(snapshot.nextPostAt, now)} (còn{' '}
                      {secondsLeft >= 60 ? `${Math.ceil(secondsLeft / 60)} phút` : `${secondsLeft} giây`})
                    </span>
                  ) : (
                    <span className="text-text-secondary">Lượt nhỏ giọt tới: ngay khi hàng đợi upload trống</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-border-main -mb-3">
            {(
              [
                { key: 'plans', label: `Truyện (${plans.length})`, icon: <ListOrdered size={14} /> },
                { key: 'history', label: 'Lịch sử đăng', icon: <History size={14} /> },
              ] as const
            ).map(t => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 border-b-2 -mb-px transition-colors cursor-pointer ${
                  tab === t.key ? 'border-gold text-gold' : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-3">
          {tab === 'plans' && (
            <>
              {plans.length === 0 && (
                <div className="py-8 text-center text-text-dim text-sm">
                  Chưa có truyện nào nổi bảng. Mở Quản lý chương của một truyện và chọn Cách đăng: Nổi trên bảng cập nhật.
                </div>
              )}
              <ul className="divide-y divide-border-main">
                {plans.map(plan => {
                  const active = snapshot.activity?.bookId === plan.bookId;
                  const ownAccount = plan.account === account;
                  const progress = planProgress(plan);
                  return (
                    <li
                      key={plan.bookId}
                      aria-busy={active}
                      className={`py-2.5 -mx-2 px-2 flex items-start gap-3 rounded-lg transition-colors duration-300 ${
                        active ? 'bg-gold/10 shadow-[inset_2px_0_0_var(--color-gold)]' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpenBook(plan.bookId)}
                            disabled={!ownAccount}
                            title={ownAccount ? 'Mở trang quản lý chương của truyện' : `Truyện của tài khoản ${plan.account}`}
                            className="min-w-0 text-left text-sm font-medium text-text-primary hover:text-gold disabled:hover:text-text-primary transition-colors cursor-pointer disabled:cursor-default truncate"
                          >
                            {plan.bookTitle}
                          </button>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${DRIP_STATUS_CLASS[plan.status]}`}>
                            {DRIP_STATUS_LABEL[plan.status]}
                          </span>
                          {!ownAccount && <span className="flex-shrink-0 text-[11px] text-purple truncate">@{plan.account}</span>}
                        </div>
                        {progress && (
                          <div className="flex items-center gap-2 mt-1">
                            <DripProgressBar posted={progress.posted} total={progress.total} className="flex-1" />
                            <span className="text-[11px] text-text-secondary whitespace-nowrap">
                              {progress.posted}/{progress.total}
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-text-dim mt-0.5">{describePlan(plan, now)}</p>
                        {active && (
                          <p className="text-xs text-gold mt-0.5 flex items-center gap-1.5">
                            <Loader2 size={12} className="motion-safe:animate-spin" /> {snapshot.activity?.text}
                          </p>
                        )}
                        {!active && plan.status === 'running' && plan.caughtUp && (
                          <p className="text-xs text-text-secondary mt-0.5">Đã đăng hết chương trong folder, chờ chương mới.</p>
                        )}
                        {plan.lastError && <p className="text-xs text-crimson mt-0.5 break-words">{plan.lastError}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {plan.status === 'running' ? (
                          <button
                            type="button"
                            onClick={() => engine.pause(plan.bookId)}
                            className="px-2.5 py-1 text-xs rounded-lg bg-bg-hover border border-border-main text-text-primary hover:border-gold/50 cursor-pointer flex items-center gap-1"
                          >
                            <Pause size={12} /> Dừng
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => engine.resume(plan.bookId)}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gold/15 text-gold hover:bg-gold/25 cursor-pointer flex items-center gap-1"
                          >
                            <Play size={12} /> Tiếp tục
                          </button>
                        )}
                        {confirmRemove === plan.bookId ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                engine.remove(plan.bookId);
                                setConfirmRemove(null);
                              }}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-crimson text-white hover:bg-crimson/90 cursor-pointer"
                            >
                              Bỏ nổi bảng
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(null)}
                              className="px-1.5 py-1 text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                            >
                              Thôi
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(plan.bookId)}
                            aria-label={`Bỏ nổi bảng: ${plan.bookTitle}`}
                            title="Bỏ chế độ nổi bảng của truyện này"
                            className="p-1 text-text-dim hover:text-crimson cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === 'history' && (
            <>
              {snapshot.history.length === 0 && (
                <div className="py-8 text-center text-text-dim text-sm">Chưa có lần đăng nào.</div>
              )}
              <ul className="divide-y divide-border-main">
                {snapshot.history.map(entry => (
                  <li key={`${entry.at}-${entry.bookId}`} className="py-2 flex items-start gap-3 text-xs">
                    <span className="text-text-dim whitespace-nowrap w-24 flex-shrink-0">{formatClock(entry.at, now)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary truncate">{entry.bookTitle}</p>
                      <p className={entry.error ? 'text-crimson break-words' : 'text-text-secondary'}>
                        {entry.action}
                        {entry.error && ` · lỗi: ${entry.error}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border-main flex justify-end bg-bg-hover/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
