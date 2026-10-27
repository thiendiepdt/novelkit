import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  flushPersistentStore,
  initPersistentStore,
  resetPersistentStoreForTests,
  storeGet,
  storeRemove,
  storeSet,
} from './persistentStore';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));

const setDesktop = (on: boolean) => {
  if (on) (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  else delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
};

describe('persistentStore', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    localStorage.clear();
    resetPersistentStoreForTests();
  });
  afterEach(() => setDesktop(false));

  it('uses localStorage on the web', async () => {
    await initPersistentStore();
    expect(invokeMock).not.toHaveBeenCalled();
    storeSet('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
    expect(storeGet('k')).toBe('v');
    storeRemove('k');
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('copies every localStorage key into the desktop store on its first run', async () => {
    setDesktop(true);
    localStorage.setItem('nk_global_settings', '{"ai":{"provider":"openai"}}');
    localStorage.setItem('nk_book_settings', '{"12":{}}');
    localStorage.setItem('something_else', 'x');
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'user_store_load') return null;
      if (cmd === 'user_store_import') return true;
      throw new Error(cmd);
    });

    await initPersistentStore();

    const imported = invokeMock.mock.calls.find((c) => c[0] === 'user_store_import')![1] as { items: Record<string, string> };
    expect(imported.items).toEqual({
      nk_global_settings: '{"ai":{"provider":"openai"}}',
      nk_book_settings: '{"12":{}}',
      something_else: 'x',
    });
    expect(storeGet('nk_global_settings')).toBe('{"ai":{"provider":"openai"}}');
    // The webview copy is left alone for older versions.
    expect(localStorage.getItem('nk_book_settings')).toBe('{"12":{}}');
  });

  it('reads the desktop file afterwards and ignores localStorage', async () => {
    setDesktop(true);
    localStorage.setItem('nk_global_settings', 'stale');
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'user_store_load') return { nk_global_settings: 'fresh' };
      return undefined;
    });

    await initPersistentStore();

    expect(storeGet('nk_global_settings')).toBe('fresh');
    expect(invokeMock.mock.calls.some((c) => c[0] === 'user_store_import')).toBe(false);
    storeSet('nk_global_settings', 'newer');
    expect(localStorage.getItem('nk_global_settings')).toBe('stale');
  });

  it('sends writes to Rust one after the other, in call order', async () => {
    setDesktop(true);
    const order: string[] = [];
    let releaseFirst: () => void = () => {};
    invokeMock.mockImplementation(async (cmd: string, args: { key?: string; value?: string }) => {
      if (cmd === 'user_store_load') return {};
      if (cmd === 'user_store_set' && args.value === '1') {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      order.push(`${cmd}:${args?.key}=${args?.value ?? ''}`);
    });
    await initPersistentStore();

    storeSet('k', '1');
    storeSet('k', '2');
    storeRemove('k');
    // Reads see the latest value at once.
    expect(storeGet('k')).toBeNull();

    await vi.waitFor(() => expect(invokeMock.mock.calls.filter((c) => c[0] === 'user_store_set')).toHaveLength(1));
    releaseFirst();
    await flushPersistentStore();
    expect(order).toEqual(['user_store_set:k=1', 'user_store_set:k=2', 'user_store_remove:k=']);
  });

  it('falls back to localStorage when the desktop store cannot be loaded', async () => {
    setDesktop(true);
    invokeMock.mockRejectedValue('boom');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await initPersistentStore();
    storeSet('k', 'v');

    expect(localStorage.getItem('k')).toBe('v');
    error.mockRestore();
  });
});
