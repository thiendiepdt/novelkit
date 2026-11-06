import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DripModal } from './DripModal';
import { DripContext } from '../drip/dripContextDefs';
import type { DripEngine, DripPlan, DripSnapshot } from '../drip/dripEngine';

const plan = (extra: Partial<DripPlan>): DripPlan => ({
  bookId: 1,
  bookTitle: 'Truyện A',
  account: 'me',
  initialBatch: 100,
  status: 'running',
  createdAt: 0,
  ...extra,
});

function renderModal(snapshot: Partial<DripSnapshot>) {
  const engine = { setIntervalMinutes: vi.fn(), pause: vi.fn(), resume: vi.fn(), remove: vi.fn(), pauseAll: vi.fn(), resumeAll: vi.fn() };
  const full: DripSnapshot = { intervalMinutes: 2, lastTurnAt: 0, nextPostAt: 0, activity: null, plans: [], history: [], ...snapshot };
  render(
    <DripContext.Provider value={{ engine: engine as unknown as DripEngine, snapshot: full }}>
      <DripModal account="me" onClose={() => {}} onOpenBook={() => {}} />
    </DripContext.Provider>,
  );
  return engine;
}

describe('DripModal', () => {
  it('shows the overall progress and the time left at the current interval', () => {
    renderModal({
      plans: [
        plan({ bookId: 1, ttcChapters: 300, localChapters: 500 }),
        plan({ bookId: 2, bookTitle: 'Truyện B', ttcChapters: 100, localChapters: 160 }),
      ],
    });
    screen.getByText(/400\/660 chương đã lên TTC/);
    // 200 + 60 chapters left, one every 2 minutes
    screen.getByText(/Còn 260 chương nhỏ giọt ≈ 8 giờ 40 phút/);
    screen.getByText('300/500');
  });

  it('applies a new interval on Enter', () => {
    const engine = renderModal({ plans: [plan({})] });
    const input = screen.getByLabelText(/Số phút giữa hai lần đăng/);
    fireEvent.change(input, { target: { value: '0.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(engine.setIntervalMinutes).toHaveBeenCalledWith(0.5);
  });

  it('lists the upload history, failures included', () => {
    renderModal({
      plans: [plan({})],
      history: [
        { at: Date.now(), bookId: 1, bookTitle: 'Truyện A', action: 'nhỏ giọt chương 101', error: 'HTTP 500' },
        { at: Date.now() - 60_000, bookId: 1, bookTitle: 'Truyện A', action: 'đợt đầu chương 1–100' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: /Lịch sử đăng/ }));
    screen.getByText(/nhỏ giọt chương 101 · lỗi: HTTP 500/);
    screen.getByText('đợt đầu chương 1–100');
  });
});
