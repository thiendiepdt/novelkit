import { useState } from 'react';
import Select from './Select';

// ─── Constants ─────────────────────────────────────────────
const LIMIT_OPTIONS = [10, 16, 20, 30, 50];

// ─── Types ─────────────────────────────────────────────────
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}

// ─── Component ─────────────────────────────────────────────
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled,
  limit,
  onLimitChange,
}: PaginationProps) {
  const [goToValue, setGoToValue] = useState('');

  const handleGoTo = () => {
    const page = parseInt(goToValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setGoToValue('');
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Limit selector */}
      {onLimitChange && limit && (
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-text-dim">Hiển thị:</label>
          <Select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            disabled={disabled}
            className="pl-1.5 pr-6 py-1 bg-bg-primary border border-border-main rounded text-xs text-text-primary cursor-pointer focus:outline-none focus:border-gold/50"
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="bg-bg-primary text-text-primary">
                {opt}/trang
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Prev button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1 || disabled}
        className="px-2.5 py-1 text-xs font-medium rounded-lg border border-border-main bg-bg-card text-text-secondary hover:border-gold hover:text-gold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ← Trước
      </button>

      {/* Page number buttons */}
      <div className="flex gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
          .reduce<(number | 'dots')[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('dots');
            acc.push(p);
            return acc;
          }, [])
          .map((item, i) =>
            item === 'dots' ? (
              <span key={`dots-${i}`} className="text-text-dim text-xs px-1 flex items-end pb-1">
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item as number)}
                disabled={disabled}
                className={`min-w-[28px] h-7 text-xs rounded-lg border transition-colors cursor-pointer ${
                  currentPage === item
                    ? 'bg-gold/20 border-gold/50 text-gold font-semibold'
                    : 'border-border-main bg-bg-card text-text-secondary hover:border-gold hover:text-gold'
                }`}
              >
                {item}
              </button>
            ),
          )}
      </div>

      {/* Next button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages || disabled}
        className="px-2.5 py-1 text-xs font-medium rounded-lg border border-border-main bg-bg-card text-text-secondary hover:border-gold hover:text-gold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Sau →
      </button>

      {/* Go to page */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={goToValue}
          onChange={(e) => setGoToValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleGoTo();
          }}
          placeholder={`1-${totalPages}`}
          min={1}
          max={totalPages}
          disabled={disabled}
          className="w-16 px-1.5 py-1 bg-bg-hover border border-border-main rounded text-xs text-text-primary text-center placeholder:text-text-secondary/70 focus:outline-none focus:border-gold/50"
        />
        <button
          onClick={handleGoTo}
          disabled={disabled || !goToValue}
          className="px-2 py-1 text-xs rounded-lg border border-border-main bg-bg-card text-text-secondary hover:border-gold hover:text-gold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Go
        </button>
      </div>
    </div>
  );
}
