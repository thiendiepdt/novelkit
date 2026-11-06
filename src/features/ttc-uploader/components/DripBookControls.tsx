import { useState } from 'react';
import { Loader2, Pause, Play, Square, TrendingUp } from 'lucide-react';
import { Tooltip } from '@/shared/components';
import { useDrip } from '../drip';
import { DEFAULT_INITIAL_BATCH } from '../drip/dripEngine';
import { DRIP_STATUS_CLASS, DRIP_STATUS_LABEL, describePlan, planProgress } from '../drip/format';
import { DripIntervalInput } from './DripIntervalInput';
import { DripProgressBar } from './DripProgressBar';
import type { TtcStory } from '../types';

const BATCH_PRESETS = [100, 200];

interface DripBookControlsProps {
  book: TtcStory;
  /** Username of the account the story belongs to. */
  account: string;
  /** A normal upload of this story is queued or running: drip cannot start meanwhile. */
  normalUploadBusy: boolean;
}

/**
 * "Nổi trên bảng cập nhật" for the open story: choose the initial batch and start, or follow,
 * pause, resume and stop its plan. The interval is shared by all stories (see DripModal).
 */
export function DripBookControls({ book, account, normalUploadBusy }: DripBookControlsProps) {
  const { engine, snapshot } = useDrip();
  const plan = snapshot?.plans.find(p => p.bookId === book.id);
  const [batch, setBatch] = useState(plan?.initialBatch ?? DEFAULT_INITIAL_BATCH);
  const [custom, setCustom] = useState(!BATCH_PRESETS.includes(plan?.initialBatch ?? DEFAULT_INITIAL_BATCH));
  const [confirmStop, setConfirmStop] = useState(false);

  if (!engine || !snapshot) return null;

  const activity = snapshot.activity?.bookId === book.id ? snapshot.activity.text : null;

  const chooseBatch = (value: number) => {
    setBatch(value);
    if (plan) engine.setInitialBatch(book.id, value);
  };

  const batchPicker = (
    <div className="flex items-center gap-1.5">
      <label className="text-[11px] text-text-dim whitespace-nowrap">Đợt đầu:</label>
      <div className="flex gap-0.5">
        {BATCH_PRESETS.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setCustom(false);
              chooseBatch(n);
            }}
            className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
              !custom && batch === n
                ? 'bg-gold/20 border-gold text-gold font-medium'
                : 'bg-bg-hover border-border-main text-text-secondary hover:border-border-hover'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
            custom ? 'bg-gold/20 border-gold text-gold font-medium' : 'bg-bg-hover border-border-main text-text-secondary hover:border-border-hover'
          }`}
        >
          Tự chọn
        </button>
      </div>
      {custom && (
        <input
          type="number"
          min={0}
          aria-label="Số chương đăng đợt đầu"
          defaultValue={batch}
          onBlur={e => chooseBatch(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="w-16 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center"
        />
      )}
      <span className="text-[10px] text-text-dim">chương</span>
    </div>
  );

  const progress = plan ? planProgress(plan) : null;

  if (!plan) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full">
        {batchPicker}
        <span className="text-[11px] text-text-dim">rồi</span>
        <DripIntervalInput />
        <span className="text-[11px] text-text-dim">(nhịp chung, luân phiên với các truyện khác đang nổi bảng)</span>
        <div className="ml-auto">
          <Tooltip
            content={normalUploadBusy ? 'Truyện đang có tiến trình upload thường, chờ nó xong hoặc hủy nó trước' : 'Bắt đầu đăng nhỏ giọt cho truyện này'}
            side="top"
          >
            <button
              type="button"
              disabled={normalUploadBusy}
              onClick={() => engine.startPlan({ bookId: book.id, bookTitle: book.title, account, initialBatch: batch })}
              className="px-4 py-1.5 bg-gold text-bg-primary font-bold text-xs rounded-lg hover:bg-gold/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <TrendingUp size={14} /> Bắt đầu nổi bảng
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${DRIP_STATUS_CLASS[plan.status]}`}>
          {DRIP_STATUS_LABEL[plan.status]}
        </span>
        {batchPicker}
        <div className="ml-auto flex items-center gap-2">
          {plan.status === 'running' ? (
            <button
              type="button"
              onClick={() => engine.pause(book.id)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-hover border border-border-main text-text-primary hover:border-gold/50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Pause size={13} /> Tạm dừng
            </button>
          ) : (
            <button
              type="button"
              onClick={() => engine.resume(book.id)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gold text-bg-primary hover:bg-gold/90 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Play size={13} /> Tiếp tục
            </button>
          )}
          {confirmStop ? (
            <>
              <button
                type="button"
                onClick={() => engine.remove(book.id)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-crimson text-white hover:bg-crimson/90 transition-colors cursor-pointer"
              >
                Dừng hẳn
              </button>
              <button
                type="button"
                onClick={() => setConfirmStop(false)}
                className="px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer"
              >
                Thôi
              </button>
            </>
          ) : (
            <Tooltip content="Bỏ chế độ nổi bảng của truyện này, quay về đăng ngay như bình thường" side="top">
              <button
                type="button"
                onClick={() => setConfirmStop(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-crimson/10 text-crimson hover:bg-crimson/20 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Square size={12} /> Dừng hẳn
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <DripIntervalInput className="text-[11px]" />
        <span className="text-[11px] text-text-dim">(nhịp chung cho mọi truyện)</span>
      </div>
      {progress && (
        <div className="flex items-center gap-2">
          <DripProgressBar posted={progress.posted} total={progress.total} className="flex-1 max-w-md" />
          <span className="text-[11px] text-text-secondary whitespace-nowrap">
            {progress.posted}/{progress.total} chương đã lên TTC
          </span>
        </div>
      )}
      <p className="text-[11px] text-text-dim">{describePlan(plan)}</p>
      {activity && (
        <p className="text-[11px] text-gold flex items-center gap-1.5">
          <Loader2 size={12} className="motion-safe:animate-spin" /> {activity}
        </p>
      )}
      {!activity && plan.status === 'running' && plan.caughtUp && (
        <p className="text-[11px] text-text-secondary">Đã đăng hết chương trong folder, sẽ tự đăng tiếp khi folder có chương mới.</p>
      )}
      {plan.lastError && <p className="text-[11px] text-crimson break-words">{plan.lastError}</p>}
    </div>
  );
}
