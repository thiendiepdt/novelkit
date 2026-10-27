import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { TtcAccountInfo, TtcAccountsView, TtcLoginPoll } from '../types';

const EMPTY: TtcAccountsView = { active: null, accounts: [] };
const POLL_MS = 2000;

/** Rust commands reject with a bare string, JS code with an Error: show either. */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  return fallback;
}

/**
 * The TTC accounts logged into the app and the active one: startup check, adding an
 * account through the login window, switching, logging one out.
 */
export function useTtcAuth() {
  const [view, setView] = useState<TtcAccountsView>(EMPTY);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setLoggingIn(false);
  }, []);

  // Startup: show the saved accounts at once, then check the active one with TTC.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await invoke<TtcAccountsView>('ttc_list_accounts');
        if (cancelled) return;
        setView(saved);
        if (saved.active !== null) {
          const verified = await invoke<TtcAccountsView>('ttc_verify_active');
          if (!cancelled) setView(verified);
        }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e, 'Không kiểm tra được tài khoản TTC'));
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /** Open the TTC login window (logged out) and wait for the new account. Also used to log in again. */
  const addAccount = useCallback(async () => {
    setError(null);
    try {
      await invoke('ttc_open_login');
    } catch (e) {
      setError(errorMessage(e, 'Không mở được cửa sổ đăng nhập'));
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    setLoggingIn(true);
    pollRef.current = setInterval(async () => {
      try {
        const poll = await invoke<TtcLoginPoll>('ttc_check_session');
        if (poll.state === 'added') {
          setView(poll.accounts);
          stopPolling();
        } else if (poll.state === 'closed') {
          stopPolling();
        }
      } catch {
        // TTC unreachable for a moment: keep waiting while the window is open
      }
    }, POLL_MS);
  }, [stopPolling]);

  const switchAccount = useCallback(async (username: string) => {
    setError(null);
    setSwitching(true);
    try {
      setView(await invoke<TtcAccountsView>('ttc_switch_account', { username }));
    } catch (e) {
      setError(errorMessage(e, 'Không chuyển được tài khoản'));
    } finally {
      setSwitching(false);
    }
  }, []);

  /** Log an account out of the app (default: the active one); the next one becomes active. */
  const logout = useCallback(async (username?: string) => {
    setError(null);
    try {
      setView(await invoke<TtcAccountsView>('ttc_logout', { username: username ?? null }));
    } catch (e) {
      setError(errorMessage(e, 'Không đăng xuất được'));
    }
  }, []);

  const active: TtcAccountInfo | null = view.accounts.find((a) => a.username === view.active) ?? null;

  return {
    accounts: view.accounts,
    active,
    checkingSession,
    loggingIn,
    switching,
    error,
    clearError: () => setError(null),
    addAccount,
    switchAccount,
    logout,
  };
}

export type TtcAuth = ReturnType<typeof useTtcAuth>;
