import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip } from '@/shared/components';

interface ChineseWarningProps {
  chineseChars: string[];
}

export default function ChineseWarning({ chineseChars }: ChineseWarningProps) {
  const [expanded, setExpanded] = useState(false);
  const displayLimit = 20;
  const hasMore = chineseChars.length > displayLimit;
  const displayChars = expanded ? chineseChars : chineseChars.slice(0, displayLimit);

  return (
    <div className="mt-4 bg-crimson/10 border border-crimson/30 rounded-xl p-4 animate-copy-success">
      <div className="flex items-start gap-3">
        <AlertTriangle size={24} className="shrink-0 text-crimson" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-crimson mb-1">
            Phát hiện {chineseChars.length} ký tự tiếng Trung!
          </h3>
          <p className="text-xs text-text-secondary mb-3 leading-relaxed">
            Nội dung có chứa chữ Trung chưa được dịch. Kiểm tra lại trước khi đăng.
          </p>

          {/* Chinese characters display */}
          <div className="flex flex-wrap gap-1.5">
            {displayChars.map((char, i) => (
              <Tooltip
                key={i}
                content={`Mã ký tự Unicode: U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`}
                side="top"
              >
                <span
                  className="inline-flex items-center justify-center bg-crimson/20 border border-crimson/30 text-crimson text-sm font-medium rounded-lg w-8 h-8 transition-all duration-200 hover:bg-crimson/30 hover:scale-110 cursor-default"
                >
                  {char}
                </span>
              </Tooltip>
            ))}
            {hasMore && !expanded && (
              <Tooltip content="Hiện toàn bộ ký tự tiếng Trung còn lại" side="top">
                <button
                  onClick={() => setExpanded(true)}
                  className="inline-flex items-center justify-center bg-crimson/10 border border-crimson/20 text-crimson text-[10px] font-medium rounded-lg px-2 h-8 hover:bg-crimson/20 transition-colors duration-200"
                >
                  +{chineseChars.length - displayLimit}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
