import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountSwitcher } from './AccountSwitcher';
import type { TtcAccountInfo } from '../types';

const MAIN: TtcAccountInfo = { username: 'thiendiepdt', displayName: 'Thương Hải Hoành Lưu', needsLogin: false };
const ALT: TtcAccountInfo = { username: 'acc_phu', displayName: 'Acc Phụ', needsLogin: true };

function renderSwitcher(active = MAIN) {
  const handlers = { onSwitch: vi.fn(), onAdd: vi.fn(), onLogout: vi.fn() };
  render(<AccountSwitcher accounts={[MAIN, ALT]} active={active} {...handlers} />);
  return handlers;
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { expanded: false }));

describe('AccountSwitcher', () => {
  it('shows the active account and lists every account in the menu', () => {
    renderSwitcher();
    expect(screen.getByText('Thương Hải Hoành Lưu')).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();

    openMenu();
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(screen.getByText('Cần đăng nhập lại')).toBeTruthy();
  });

  it('switches to another account and closes the menu', () => {
    const { onSwitch } = renderSwitcher();
    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Acc Phụ/ }));
    expect(onSwitch).toHaveBeenCalledWith('acc_phu');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does nothing when the active account is picked again', () => {
    const { onSwitch } = renderSwitcher();
    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Thương Hải/ }));
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('adds an account and logs the active one out', () => {
    const { onAdd, onLogout } = renderSwitcher();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Thêm tài khoản/ }));
    expect(onAdd).toHaveBeenCalledTimes(1);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Đăng xuất tài khoản này/ }));
    expect(onLogout).toHaveBeenCalledWith('thiendiepdt');
  });

  it('closes on Escape', () => {
    renderSwitcher();
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
