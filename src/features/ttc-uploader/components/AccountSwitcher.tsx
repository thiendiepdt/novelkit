import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LogOut, UserPlus } from 'lucide-react';
import type { TtcAccountInfo } from '../types';
import { accountLabel } from '../utils/accountLabel';

interface AccountSwitcherProps {
  accounts: TtcAccountInfo[];
  active: TtcAccountInfo;
  /** A switch or a login window is in progress: the menu stays usable but says so. */
  busy?: boolean;
  onSwitch: (username: string) => void;
  onAdd: () => void;
  onLogout: (username: string) => void;
}

/**
 * The active TTC account, with a menu to switch to another one, add one, or log the
 * active one out of the app (like the account menu of Gmail or Slack).
 */
export function AccountSwitcher({ accounts, active, busy, onSwitch, onAdd, onLogout }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="bg-bg-card border border-border-main rounded-xl px-4 py-2 flex items-center gap-2.5 hover:border-border-hover transition-colors cursor-pointer"
      >
        <div className={`w-2 h-2 rounded-full ${active.needsLogin ? 'bg-crimson' : 'bg-jade'}`} />
        <span className="text-xs font-medium text-text-primary max-w-48 truncate">{accountLabel(active)}</span>
        {active.username && <span className="text-[11px] text-text-dim hidden sm:inline">@{active.username}</span>}
        {busy && <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin" aria-label="Đang xử lý" />}
        <ChevronDown size={14} className="text-text-dim" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Tài khoản TTC"
          className="absolute right-0 mt-2 w-72 bg-bg-card border border-border-main rounded-xl shadow-2xl z-40 py-1.5"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div className="px-3 py-1.5 text-[10px] text-text-dim uppercase tracking-wider font-semibold">Tài khoản TiemTruyenChu</div>
          {accounts.map((account) => {
            const isActive = account.username === active.username;
            return (
              <button
                key={account.username || '(legacy)'}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => choose(() => !isActive && onSwitch(account.username))}
                className={`w-full px-3 py-2 flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  isActive ? 'bg-gold/10' : 'hover:bg-bg-hover'
                }`}
              >
                <span className="w-4 flex justify-center text-gold">{isActive && <Check size={14} />}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-text-primary truncate">{accountLabel(account)}</span>
                  {account.username && <span className="block text-[11px] text-text-dim truncate">@{account.username}</span>}
                </span>
                {account.needsLogin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-crimson/15 text-crimson font-semibold whitespace-nowrap">
                    Cần đăng nhập lại
                  </span>
                )}
              </button>
            );
          })}
          <div className="my-1.5 border-t border-border-main" />
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onAdd)}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-sm text-gold hover:bg-bg-hover transition-colors cursor-pointer"
          >
            <span className="w-4 flex justify-center">
              <UserPlus size={14} />
            </span>
            Thêm tài khoản
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(() => onLogout(active.username))}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-sm text-text-secondary hover:text-crimson hover:bg-bg-hover transition-colors cursor-pointer"
          >
            <span className="w-4 flex justify-center">
              <LogOut size={14} />
            </span>
            Đăng xuất tài khoản này
          </button>
        </div>
      )}
    </div>
  );
}
