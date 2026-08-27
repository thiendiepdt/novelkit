import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Tooltip } from './Tooltip';

export interface MiniMapMarker {
  /** Character offset in the text where this marker starts */
  charOffset: number;
  label: string;
}

interface MiniMapTextareaProps {
  value: string;
  rows?: number;
  className?: string;
  readOnly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  id?: string;
  style?: React.CSSProperties;
  /** Markers to show on the minimap (e.g. part boundaries) */
  markers?: MiniMapMarker[];
  /** Hide the minimap panel (useful for very large texts) */
  hideMinimap?: boolean;
}

export default function MiniMapTextarea({ value, rows = 12, className = '', readOnly, onChange, placeholder, id, style, markers, hideMinimap }: MiniMapTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const minimapContentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const dragStartY = useRef(0);
  const dragStartScroll = useRef(0);

  // Calculate line numbers for each marker
  const markerLines = useMemo(() => {
    if (!markers || !value) return [];
    const totalLines = value.split('\n').length;
    return markers.map(m => {
      const textBefore = value.substring(0, m.charOffset);
      const lineNumber = textBefore.split('\n').length - 1; // 0-indexed
      return { ...m, lineNumber, totalLines };
    });
  }, [markers, value]);

  const syncMinimap = useCallback(() => {
    const textarea = textareaRef.current;
    const viewport = viewportRef.current;
    const minimap = minimapRef.current;
    const minimapContent = minimapContentRef.current;
    if (!textarea || !viewport || !minimap || !minimapContent) return;

    const scrollRatio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight || 1);
    const visibleRatio = textarea.clientHeight / textarea.scrollHeight;

    // Viewport height relative to minimap
    const minimapVisibleHeight = minimap.clientHeight;
    const viewportHeight = Math.max(20, visibleRatio * minimapVisibleHeight);
    const viewportTop = scrollRatio * (minimapVisibleHeight - viewportHeight);

    viewport.style.height = `${viewportHeight}px`;
    viewport.style.top = `${viewportTop}px`;

    // Scroll minimap content proportionally
    const contentScrollMax = minimapContent.scrollHeight - minimap.clientHeight;
    if (contentScrollMax > 0) {
      minimapContent.style.transform = `translateY(-${scrollRatio * contentScrollMax}px)`;
    }
  }, []);

  useEffect(() => {
    syncMinimap();
  }, [value, syncMinimap]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const observer = new ResizeObserver(() => syncMinimap());
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [syncMinimap]);

  const scrollToCharOffset = useCallback((charOffset: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Create a hidden mirror div to measure exact pixel position
    const mirror = document.createElement('div');
    const computed = window.getComputedStyle(textarea);

    // Copy all relevant styles to match textarea rendering
    mirror.style.cssText = `
      position: absolute; visibility: hidden; overflow: hidden;
      white-space: pre-wrap; word-wrap: break-word;
      width: ${textarea.clientWidth}px;
      font-family: ${computed.fontFamily};
      font-size: ${computed.fontSize};
      line-height: ${computed.lineHeight};
      letter-spacing: ${computed.letterSpacing};
      padding: ${computed.padding};
      border: ${computed.border};
      box-sizing: border-box;
    `;

    // Insert text up to the offset, then a marker span
    const textBefore = value.substring(0, charOffset);
    const beforeNode = document.createTextNode(textBefore);
    const marker = document.createElement('span');
    marker.textContent = '|';

    mirror.appendChild(beforeNode);
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const markerTop = marker.offsetTop;
    document.body.removeChild(mirror);

    // Center the marker in the visible area
    const targetScrollTop = markerTop - textarea.clientHeight / 2;
    textarea.scrollTop = Math.max(0, targetScrollTop);
    syncMinimap();
  }, [value, syncMinimap]);

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const textarea = textareaRef.current;
    const minimap = minimapRef.current;
    if (!textarea || !minimap) return;

    const rect = minimap.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = clickY / rect.height;

    textarea.scrollTop = ratio * (textarea.scrollHeight - textarea.clientHeight);
    syncMinimap();
  }, [syncMinimap]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScroll.current = textareaRef.current?.scrollTop || 0;
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const textarea = textareaRef.current;
      const minimap = minimapRef.current;
      if (!textarea || !minimap) return;

      const deltaY = e.clientY - dragStartY.current;
      const minimapHeight = minimap.clientHeight;
      const scrollRange = textarea.scrollHeight - textarea.clientHeight;
      const scrollDelta = (deltaY / minimapHeight) * scrollRange;

      textarea.scrollTop = dragStartScroll.current + scrollDelta;
      syncMinimap();
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, syncMinimap]);

  const hasMarkers = !hideMinimap && markerLines.length > 0;
  const showMinimap = !hideMinimap;

  return (
    <div className="relative flex w-full">
      <textarea
        ref={textareaRef}
        readOnly={readOnly}
        value={value}
        onChange={onChange}
        onScroll={syncMinimap}
        className={`flex-1 scrollbar-hide ${showMinimap ? 'minimap-textarea' : ''} ${className}`}
        rows={rows}
        placeholder={placeholder}
        id={id}
        style={style}
      />
      {/* Marker labels - outside minimap, to the left, desktop only */}
      {hasMarkers && (
        <div
          className="absolute top-0 bottom-0 hidden md:block"
          style={{
            right: '64px',
            width: '28px',
            zIndex: 11,
          }}
        >
          {markerLines.map((marker, i) => {
            const topPercent = (marker.lineNumber / marker.totalLines) * 100;
            return (
              <Tooltip key={i} content={`Nhảy tới ${marker.label}`} side="left">
                <button
                  onClick={() => scrollToCharOffset(marker.charOffset)}
                  className="absolute text-gold hover:text-gold-light hover:bg-gold/15 transition-all active:scale-95"
                  style={{
                    top: `${topPercent}%`,
                    right: '2px',
                    transform: 'translateY(-50%)',
                    fontSize: '9px',
                    lineHeight: '14px',
                    fontFamily: 'sans-serif',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: 'rgba(18, 18, 18, 0.9)',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    border: '1px solid rgba(201, 169, 110, 0.35)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {marker.label}
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
      {/* Minimap - desktop only */}
      {showMinimap && <div
        ref={minimapRef}
        className="absolute right-0 top-0 bottom-0 overflow-hidden cursor-pointer select-none hidden md:block"
        style={{
          width: '64px',
          background: 'rgba(255,255,255,0.02)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          opacity: isHovering || isDragging ? 1 : 0.5,
          transition: 'opacity 0.2s',
        }}
        onClick={handleMinimapClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Minimap content */}
        <div
          ref={minimapContentRef}
          className="pointer-events-none select-none"
          style={{
            fontSize: '1.8px',
            lineHeight: '2.4px',
            fontFamily: 'monospace',
            color: 'rgba(224,221,216,0.5)',
            padding: '4px 3px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            letterSpacing: '-0.2px',
          }}
        >
          {value}
        </div>
        {/* Viewport indicator */}
        <div
          ref={viewportRef}
          onMouseDown={handleDragStart}
          className="absolute left-0 right-0"
          style={{
            background: isHovering || isDragging
              ? 'rgba(201, 169, 110, 0.12)'
              : 'rgba(201, 169, 110, 0.08)',
            border: '1px solid rgba(201, 169, 110, 0.2)',
            borderRadius: '2px',
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'background 0.2s',
            minHeight: '20px',
          }}
        />
        {/* Part marker lines (inside minimap) */}
        {markerLines.map((marker, i) => {
          const topPercent = (marker.lineNumber / marker.totalLines) * 100;
          return (
            <div
              key={i}
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: `${topPercent}%`,
                height: '1px',
                background: 'rgba(201, 169, 110, 0.5)',
                zIndex: 10,
              }}
            />
          );
        })}
      </div>}
    </div>
  );
}
