import { useCallback, useSyncExternalStore } from 'react';

const supported = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * Whether a CSS media query matches, kept current while the window is resized.
 * False where `matchMedia` is missing (server rendering, jsdom).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => supported() && window.matchMedia(query).matches,
    () => false,
  );
}
