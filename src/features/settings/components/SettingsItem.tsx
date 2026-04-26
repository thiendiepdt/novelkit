import type { ReactNode } from 'react';

interface SettingsItemProps {
  label: ReactNode;
  description?: string;
  children: ReactNode;
}

export function SettingsItem({ label, description, children }: SettingsItemProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-bg-hover/30 rounded-xl transition-colors border border-transparent hover:border-border-main">
      <div className="flex-1">
        <label className="text-sm font-medium text-text-primary block">{label}</label>
        {description && (
          <span className="text-xs text-text-dim block mt-1">{description}</span>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center justify-end min-w-[120px]">
        {children}
      </div>
    </div>
  );
}

// Common Inputs
export function SettingsToggle({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-gold' : 'bg-bg-hover border border-border-main'}`}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

export function SettingsNumber({ value, onChange, min, max, step }: { value: number, onChange: (v: number) => void, min?: number, max?: number, step?: number }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      className="w-24 px-3 py-1.5 bg-bg-card border border-border-main rounded-lg text-sm text-text-primary focus:border-gold focus:outline-none transition-colors text-right"
    />
  );
}


