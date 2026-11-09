import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

/** A matchMedia stand-in for "(max-height: Npx)" driven by a fake window height. */
function fakeWindow(height: number) {
  const listeners = new Set<() => void>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => {
    const max = Number(/max-height:\s*(\d+)px/.exec(query)?.[1]);
    return {
      get matches() {
        return height <= max;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return {
    resize(next: number) {
      height = next;
      listeners.forEach((fn) => fn());
    },
    listeners,
    restore() {
      window.matchMedia = original;
    },
  };
}

describe('useMediaQuery', () => {
  let win: ReturnType<typeof fakeWindow> | null = null;
  afterEach(() => {
    win?.restore();
    win = null;
  });

  it('follows the window as it is resized', () => {
    win = fakeWindow(768);
    const { result, unmount } = renderHook(() => useMediaQuery('(max-height: 900px)'));
    expect(result.current).toBe(true);

    act(() => win!.resize(1080));
    expect(result.current).toBe(false);
    act(() => win!.resize(900));
    expect(result.current).toBe(true);

    unmount();
    expect(win.listeners.size).toBe(0);
  });

  it('is false without matchMedia', () => {
    const original = window.matchMedia;
    // @ts-expect-error jsdom has none; simulate it explicitly
    delete window.matchMedia;
    const { result } = renderHook(() => useMediaQuery('(max-height: 900px)'));
    expect(result.current).toBe(false);
    window.matchMedia = original;
  });
});
