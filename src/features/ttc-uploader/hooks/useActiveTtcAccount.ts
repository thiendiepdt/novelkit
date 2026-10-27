import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/shared/utils/platform';
import type { TtcAccountsView } from '../types';

/**
 * Username of the active TTC account, read from the saved list without asking TTC
 * (for views that only need to know whose books to show, like the settings page).
 * Null while loading, on the web, or with no account.
 */
export function useActiveTtcAccount(): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    invoke<TtcAccountsView>('ttc_list_accounts')
      .then((view) => {
        if (!cancelled) setActive(view.active);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return active;
}
