import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DripBookControls } from './DripBookControls';
import { DripContext } from '../drip/dripContextDefs';
import type { DripEngine, DripPlan, DripSnapshot } from '../drip/dripEngine';
import type { TtcStory } from '../types';

const BOOK = { id: 42, title: 'Truyện A' } as TtcStory;

function renderControls(plans: DripPlan[], opts: { normalUploadBusy?: boolean; activity?: DripSnapshot['activity'] } = {}) {
  const engine = {
    startPlan: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    remove: vi.fn(),
    setInitialBatch: vi.fn(),
  };
  const snapshot: DripSnapshot = { intervalMinutes: 5, lastTurnAt: 0, nextPostAt: 0, activity: opts.activity ?? null, plans, history: [] };
  render(
    <DripContext.Provider value={{ engine: engine as unknown as DripEngine, snapshot }}>
      <DripBookControls book={BOOK} account="me" normalUploadBusy={opts.normalUploadBusy ?? false} />
    </DripContext.Provider>,
  );
  return engine;
}

const plan = (extra: Partial<DripPlan> = {}): DripPlan => ({
  bookId: 42,
  bookTitle: 'Truyện A',
  account: 'me',
  initialBatch: 200,
  status: 'running',
  createdAt: 0,
  ...extra,
});

describe('DripBookControls', () => {
  it('starts a plan with the chosen initial batch on the story account', () => {
    const engine = renderControls([]);
    fireEvent.click(screen.getByRole('button', { name: '200' }));
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu nổi bảng/ }));
    expect(engine.startPlan).toHaveBeenCalledWith({ bookId: 42, bookTitle: 'Truyện A', account: 'me', initialBatch: 200 });
  });

  it('takes a custom initial batch', () => {
    const engine = renderControls([]);
    fireEvent.click(screen.getByRole('button', { name: 'Tự chọn' }));
    const input = screen.getByLabelText('Số chương đăng đợt đầu');
    fireEvent.change(input, { target: { value: '350' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu nổi bảng/ }));
    expect(engine.startPlan).toHaveBeenCalledWith(expect.objectContaining({ initialBatch: 350 }));
  });

  it('cannot start while a normal upload of the story runs', () => {
    renderControls([], { normalUploadBusy: true });
    expect((screen.getByRole('button', { name: /Bắt đầu nổi bảng/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('pauses, resumes and stops after confirmation', () => {
    const engine = renderControls([plan({ lastError: 'HTTP 500' })], { activity: { bookId: 42, text: 'Đang đăng nhỏ giọt chương 201' } });
    // getBy* throws when the text is missing
    screen.getByText('Đang chạy');
    screen.getByText('HTTP 500');
    screen.getByText(/Đang đăng nhỏ giọt chương 201/);

    fireEvent.click(screen.getByRole('button', { name: /Tạm dừng/ }));
    expect(engine.pause).toHaveBeenCalledWith(42);

    fireEvent.click(screen.getByRole('button', { name: /Dừng hẳn/ }));
    expect(engine.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dừng hẳn' }));
    expect(engine.remove).toHaveBeenCalledWith(42);
  });

  it('resumes a paused plan', () => {
    const engine = renderControls([plan({ status: 'paused' })]);
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục/ }));
    expect(engine.resume).toHaveBeenCalledWith(42);
  });
});
