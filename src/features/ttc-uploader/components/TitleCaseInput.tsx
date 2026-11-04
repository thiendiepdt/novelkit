import type { InputHTMLAttributes } from 'react';
import { toTitleCase } from '../utils/titleCase';

const INPUT_CLASS =
  'w-full px-3 py-2 bg-bg-hover border border-border-main rounded-lg text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-gold/50';

/** Text input with TTC's "Aa" button: capitalize the first letter of every word. */
export function TitleCaseInput({
  value,
  onValueChange,
  readOnly,
  ...rest
}: { value: string; onValueChange: (value: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const canConvert = !readOnly && toTitleCase(value) !== value;
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        readOnly={readOnly}
        className={`${INPUT_CLASS} pr-12 ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
        {...rest}
      />
      <button
        type="button"
        disabled={!canConvert}
        onClick={() => onValueChange(toTitleCase(value))}
        title="Viết hoa chữ cái đầu mỗi từ"
        aria-label="Viết hoa chữ cái đầu mỗi từ"
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-6 rounded text-xs font-bold transition-colors ${
          canConvert ? 'bg-gold text-bg-primary cursor-pointer hover:bg-gold/90' : 'bg-bg-card text-text-dim cursor-default'
        }`}
      >
        Aa
      </button>
    </div>
  );
}
