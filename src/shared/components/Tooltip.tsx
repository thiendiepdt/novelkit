import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  /** Tooltip text/content. If empty/falsy, the tooltip is disabled and children render as-is. */
  content?: ReactNode;
  side?: Side;
  /** Delay (ms) before showing on hover. */
  delay?: number;
  /** Extra classes for the inline wrapper that hosts the hover target. */
  className?: string;
  children: ReactNode;
}

const GAP = 8;

/**
 * Lightweight, theme-styled tooltip. Renders into a portal with fixed
 * positioning so it is never clipped by overflow-hidden ancestors (toolbars,
 * scroll areas). Shows on hover and keyboard focus; hides on leave/blur/scroll.
 */
export function Tooltip({ content, side = 'top', delay = 250, className = '', children }: TooltipProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const computePosition = useCallback(() => {
    const el = wrapperRef.current?.firstElementChild ?? wrapperRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    switch (side) {
      case 'bottom': setCoords({ top: r.bottom + GAP, left: r.left + r.width / 2 }); break;
      case 'left':   setCoords({ top: r.top + r.height / 2, left: r.left - GAP }); break;
      case 'right':  setCoords({ top: r.top + r.height / 2, left: r.right + GAP }); break;
      default:       setCoords({ top: r.top - GAP, left: r.left + r.width / 2 });
    }
  }, [side]);

  const show = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      computePosition();
      setOpen(true);
    }, delay);
  }, [computePosition, delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  // Hide when the page scrolls or resizes (position would otherwise go stale).
  useEffect(() => {
    if (!open) return;
    const onMove = () => hide();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, hide]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!content) return <>{children}</>;

  const translate =
    side === 'bottom' ? 'translate(-50%, 0)' :
    side === 'left'   ? 'translate(-100%, -50%)' :
    side === 'right'  ? 'translate(0, -50%)' :
                        'translate(-50%, -100%)';

  return (
    <span
      ref={wrapperRef}
      className={`inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: 'fixed', top: coords.top, left: coords.left, transform: translate }}
            className="pointer-events-none z-[9999] max-w-xs rounded-lg border border-border-gold bg-bg-glass px-2.5 py-1.5 text-xs leading-snug text-text-primary shadow-xl backdrop-blur-md"
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
}

export default Tooltip;
