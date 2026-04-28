import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { copyToClipboard } from '@/shared/utils/clipboard';
import { Book, ChevronLeft, ChevronRight, Copy, Check, X } from 'lucide-react';

interface FullscreenPreviewProps {
  text: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string | ReactNode;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export default function FullscreenPreview({ text, isOpen, onClose, title, onNext, onPrev, hasNext, hasPrev }: FullscreenPreviewProps) {
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: 'rgba(0, 0, 0, 0.95)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border-main shrink-0"
        style={{ background: 'rgba(18, 18, 18, 0.98)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-gold text-sm font-semibold flex items-center gap-1.5">
            {title || <><Book size={16} /> Xem trước</>}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(hasPrev || hasNext) && (
            <div className="flex items-center gap-1 mr-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="text-text-secondary hover:text-gold disabled:opacity-30 disabled:hover:text-text-secondary disabled:cursor-not-allowed px-2.5 py-1.5 transition-colors"
                title="Phần trước"
              >
                 <ChevronLeft size={16} />
              </button>
              <div className="w-[1px] h-4 bg-white/10" />
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="text-text-secondary hover:text-gold disabled:opacity-30 disabled:hover:text-text-secondary disabled:cursor-not-allowed px-2.5 py-1.5 transition-colors"
                title="Phần tiếp theo"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <button
            onClick={handleCopy}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
              copied
                ? 'bg-jade/20 border-jade/40 text-jade'
                : 'bg-bg-card border-border-main text-text-secondary hover:border-border-gold hover:text-gold'
            }`}
          >
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text-primary transition-colors duration-200 p-1.5 rounded-lg hover:bg-white/5 flex items-center justify-center"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-[800px] mx-auto">
          <div className="text-[15px] md:text-base leading-[1.9] md:leading-[2] text-text-primary whitespace-pre-wrap break-words">
            {text}
          </div>
        </div>
      </div>

      {/* Bottom hint (mobile) */}
      <div className="sm:hidden text-center py-2 text-[10px] text-text-dim border-t border-border-main/50">
        Vuốt để cuộn · Nhấn ✕ để đóng
      </div>
    </div>
  );
}
