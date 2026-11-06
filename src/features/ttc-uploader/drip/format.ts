import type { DripPlan, DripStatus } from './dripEngine';

export const DRIP_STATUS_LABEL: Record<DripStatus, string> = {
  running: 'Đang chạy',
  paused: 'Tạm dừng',
  error: 'Đã dừng do lỗi',
};

export const DRIP_STATUS_CLASS: Record<DripStatus, string> = {
  running: 'border-jade/40 bg-jade/10 text-jade',
  paused: 'border-border-main bg-bg-hover text-text-secondary',
  error: 'border-crimson/40 bg-crimson/10 text-crimson',
};

/** "14:05", or "06/11 14:05" when not today. */
export function formatClock(ts: number, now = Date.now()): string {
  const date = new Date(ts);
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (new Date(now).toDateString() === date.toDateString()) return time;
  return `${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${time}`;
}

/** Where a plan stands, in one line under its title. */
export function describePlan(plan: DripPlan, now = Date.now()): string {
  const parts: string[] = [];
  // With the folder size known, the progress bar already says this.
  if (plan.ttcChapters !== undefined && plan.localChapters === undefined) parts.push(`TTC có ${plan.ttcChapters} chương`);
  parts.push(plan.initialBatch > 0 ? `đợt đầu ${plan.initialBatch} chương` : 'không có đợt đầu');
  if (plan.lastAction && plan.lastPostAt) parts.push(`gần nhất: ${plan.lastAction} lúc ${formatClock(plan.lastPostAt, now)}`);
  return parts.join(' · ');
}

/** Chapters of the folder already on TTC, or null before the first look at the story. */
export function planProgress(plan: DripPlan): { posted: number; total: number } | null {
  if (plan.localChapters === undefined || plan.ttcChapters === undefined) return null;
  return { posted: Math.min(plan.ttcChapters, plan.localChapters), total: plan.localChapters };
}

/** Chapters the plan still has to drip one by one (the initial batch goes up at once). */
export function remainingDrips(plan: DripPlan): number {
  if (plan.localChapters === undefined) return 0;
  return Math.max(0, plan.localChapters - Math.max(plan.ttcChapters ?? 0, plan.initialBatch));
}

export interface DripTotals {
  posted: number;
  total: number;
  /** Chapters left to drip over the running plans. */
  remaining: number;
  /** One chapter per interval for all stories together: remaining × interval. */
  etaMinutes: number;
  /** Plans not looked at yet: their counts are missing from the totals. */
  unknown: number;
}

export function dripTotals(plans: DripPlan[], intervalMinutes: number): DripTotals {
  const totals: DripTotals = { posted: 0, total: 0, remaining: 0, etaMinutes: 0, unknown: 0 };
  for (const plan of plans) {
    const progress = planProgress(plan);
    if (!progress) totals.unknown++;
    else {
      totals.posted += progress.posted;
      totals.total += progress.total;
    }
    if (plan.status === 'running') totals.remaining += remainingDrips(plan);
  }
  totals.etaMinutes = totals.remaining * intervalMinutes;
  return totals;
}

/** "45 phút", "3 giờ 20 phút", "2 ngày 4 giờ". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  if (hours > 0) return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  return `${mins} phút`;
}

/** "5 phút", "30 giây", "1,5 phút". */
export function formatInterval(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} giây`;
  return `${minutes.toLocaleString('vi-VN')} phút`;
}
