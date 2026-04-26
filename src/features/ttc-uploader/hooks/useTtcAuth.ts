import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Manages TTC authentication state: session checking, login polling, and logout.
 */
export function useTtcAuth() {
  const [session, setSession] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check existing session on mount
  useEffect(() => {
    invoke<string | null>('ttc_get_session')
      .then((s) => {
        setSession(s);
        setCheckingSession(false);
      })
      .catch(() => setCheckingSession(false));
  }, []);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Login: open TTC login window, then poll for session cookie
  const handleLogin = useCallback(async () => {
    try {
      await invoke('ttc_open_login');

      pollRef.current = setInterval(async () => {
        try {
          const s = await invoke<string | null>('ttc_check_session');
          if (s) {
            setSession(s);
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch {
          // Login window might be closed
        }
      }, 2000);
    } catch (e) {
      console.error('Failed to open login window:', e);
    }
  }, []);

  // Logout: clear session state and reset
  const handleLogout = useCallback(async () => {
    await invoke('ttc_logout');
    setSession(null);
  }, []);

  return {
    session,
    checkingSession,
    handleLogin,
    handleLogout,
  };
}
