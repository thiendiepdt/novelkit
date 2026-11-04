import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '@/shared/utils/platform';
import type { TtcAccountsView } from '../types';

/** Emitted by the Rust side (`ttc::session`) whenever the list or the active account changes. */
export const ACCOUNTS_CHANGED_EVENT = 'ttc://accounts-changed';

/**
 * Username of the active TTC account, read from the saved list without asking TTC
 * (for views that only need to know whose data to show, like the settings page or the
 * revenue ticker), and kept current when the account is switched, added or logged out.
 * Null while loading, on the web, with no account, or for a migrated session whose
 * username is not known yet.
 */
export function useActiveTtcAccount(): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    const apply = (view: TtcAccountsView) => {
      if (!cancelled) setActive(view.active || null);
    };
    invoke<TtcAccountsView>('ttc_list_accounts').then(apply).catch(() => {});
    const unlisten = listen<TtcAccountsView>(ACCOUNTS_CHANGED_EVENT, (e) => apply(e.payload));
    return () => {
      cancelled = true;
      unlisten.then((stop) => stop()).catch(() => {});
    };
  }, []);
  return active;
}
