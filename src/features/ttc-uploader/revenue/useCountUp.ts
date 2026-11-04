import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 900;

/**
 * A number that runs up (or down) to `target` instead of jumping, easing out. A new
 * target mid-run continues from the value on screen. With reduced motion it jumps.
 */
export function useCountUp(target: number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduce ? 0 : DURATION_MS;
    let start: number | null = null;
    let raf = requestAnimationFrame(function frame(t) {
      start ??= t;
      const p = duration ? Math.min(1, (t - start) / duration) : 1;
      const value = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      shownRef.current = value;
      setShown(value);
      if (p < 1) raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return shown;
}
