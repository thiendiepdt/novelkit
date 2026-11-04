import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { RevenueTicker } from './RevenueTicker';
import { RevenueContext } from './revenueContextDefs';
import { emptyDay } from './ledger';
import type { RevenueEngine, RevenueSnapshot } from './revenueEngine';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const snapshot: RevenueSnapshot = {
  account: 'thiendiepdt',
  todayKey: '2026-11-04',
  today: { ...emptyDay(), hoa: 3870, count: 43 },
  days: {},
  covered: [],
  syncing: false,
  error: null,
  lastSyncAt: null,
};
const engine = { loadDay: async () => null, refresh: async () => {} } as unknown as RevenueEngine;

describe('RevenueTicker', () => {
  it('opens the details outside the header, whose backdrop-filter would trap a fixed overlay', async () => {
    render(
      <RevenueContext.Provider value={{ engine, snapshot }}>
        <header>
          <RevenueTicker />
        </header>
      </RevenueContext.Provider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Doanh thu hôm nay/ }));
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('header')).toBeNull();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });
});
