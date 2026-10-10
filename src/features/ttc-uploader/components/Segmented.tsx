/**
 * One-click choice between a few options: a single bordered track with the active
 * option filled, so the current value stands out and no dropdown has to be opened.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  /** Accessible name of the group (the visible label sits next to it). */
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 p-1 bg-bg-hover border border-border-main rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer disabled:cursor-default ${
            value === opt.value
              ? 'bg-gold text-bg-primary font-semibold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-card disabled:hover:bg-transparent disabled:hover:text-text-secondary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
