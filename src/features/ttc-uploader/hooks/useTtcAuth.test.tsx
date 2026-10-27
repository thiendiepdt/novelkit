import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTtcAuth } from './useTtcAuth';
import type { TtcAccountsView, TtcLoginPoll } from '../types';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));

const A = { username: 'a', displayName: 'Tài khoản A', needsLogin: false };
const B = { username: 'b', displayName: 'Tài khoản B', needsLogin: false };
const view = (active: string | null, ...accounts: (typeof A)[]): TtcAccountsView => ({ active, accounts });

type Handlers = Record<string, (args: Record<string, unknown>) => unknown>;
function mockBackend(handlers: Handlers) {
  invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
    const handler = handlers[cmd];
    if (!handler) throw new Error(`unexpected invoke ${cmd}`);
    return handler(args ?? {});
  });
}

describe('useTtcAuth', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('shows the saved accounts, then the verified state of the active one', async () => {
    mockBackend({
      ttc_list_accounts: () => view('a', A, B),
      ttc_verify_active: () => view('a', { ...A, needsLogin: true }, B),
    });
    const { result } = renderHook(() => useTtcAuth());

    await waitFor(() => expect(result.current.checkingSession).toBe(false));
    expect(result.current.active).toEqual({ ...A, needsLogin: true });
    expect(result.current.accounts).toHaveLength(2);
  });

  it('skips the TTC check when no account is saved', async () => {
    mockBackend({ ttc_list_accounts: () => view(null) });
    const { result } = renderHook(() => useTtcAuth());

    await waitFor(() => expect(result.current.checkingSession).toBe(false));
    expect(result.current.active).toBeNull();
    expect(invokeMock.mock.calls.map((c) => c[0])).toEqual(['ttc_list_accounts']);
  });

  it('adds an account through the login window and makes it active', async () => {
    let poll: TtcLoginPoll = { state: 'waiting' };
    mockBackend({
      ttc_list_accounts: () => view('a', A),
      ttc_verify_active: () => view('a', A),
      ttc_open_login: () => undefined,
      ttc_check_session: () => poll,
    });
    const { result } = renderHook(() => useTtcAuth());
    await waitFor(() => expect(result.current.checkingSession).toBe(false));

    vi.useFakeTimers();
    await act(async () => {
      await result.current.addAccount();
    });
    expect(result.current.loggingIn).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.loggingIn).toBe(true);

    poll = { state: 'added', username: 'b', accounts: view('b', A, B) };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.loggingIn).toBe(false);
    expect(result.current.active?.username).toBe('b');

    // Polling stopped.
    const polls = invokeMock.mock.calls.filter((c) => c[0] === 'ttc_check_session').length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'ttc_check_session')).toHaveLength(polls);
  });

  it('stops waiting when the login window is closed', async () => {
    mockBackend({
      ttc_list_accounts: () => view('a', A),
      ttc_verify_active: () => view('a', A),
      ttc_open_login: () => undefined,
      ttc_check_session: () => ({ state: 'closed' }),
    });
    const { result } = renderHook(() => useTtcAuth());
    await waitFor(() => expect(result.current.checkingSession).toBe(false));

    vi.useFakeTimers();
    await act(async () => {
      await result.current.addAccount();
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.loggingIn).toBe(false);
    expect(result.current.active?.username).toBe('a');
  });

  it('switches and logs out through the backend', async () => {
    mockBackend({
      ttc_list_accounts: () => view('a', A, B),
      ttc_verify_active: () => view('a', A, B),
      ttc_switch_account: (args) => view(String(args.username), A, B),
      ttc_logout: () => view('a', A),
    });
    const { result } = renderHook(() => useTtcAuth());
    await waitFor(() => expect(result.current.checkingSession).toBe(false));

    await act(async () => {
      await result.current.switchAccount('b');
    });
    expect(result.current.active?.username).toBe('b');

    await act(async () => {
      await result.current.logout('b');
    });
    expect(invokeMock).toHaveBeenLastCalledWith('ttc_logout', { username: 'b' });
    expect(result.current.active?.username).toBe('a');
    expect(result.current.accounts).toHaveLength(1);
  });

  it('reports a failed switch and keeps the current account', async () => {
    mockBackend({
      ttc_list_accounts: () => view('a', A, B),
      ttc_verify_active: () => view('a', A, B),
      ttc_switch_account: () => {
        throw 'Không có tài khoản b trong app';
      },
    });
    const { result } = renderHook(() => useTtcAuth());
    await waitFor(() => expect(result.current.checkingSession).toBe(false));

    await act(async () => {
      await result.current.switchAccount('b');
    });
    expect(result.current.error).toBe('Không có tài khoản b trong app');
    expect(result.current.active?.username).toBe('a');
  });
});
